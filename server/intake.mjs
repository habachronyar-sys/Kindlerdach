import { getSupabaseConfig } from './config.mjs';

const services = new Set([
  'Allgemeine Anfrage',
  'Dachdeckung & Sanierung',
  'Abdichtung & Flachdach',
  'Dachfenster & Gauben',
  'Reparatur & Wartung',
  'Dämmung & energetische Sanierung',
  'Dachrinnen & Entwässerung',
  'Blech-, Metall- & Schieferarbeiten',
  'Extensive Dachbegrünung',
]);

const json = (status, payload) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

export function validateContactPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Ungültige Formulardaten.' };
  if (typeof payload.website === 'string' && payload.website.trim()) return { error: 'Die Anfrage konnte nicht verarbeitet werden.' };

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
  const subject = typeof payload.service === 'string' ? payload.service.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!name || name.length > 100) return { error: 'Bitte geben Sie einen Namen mit höchstens 100 Zeichen ein.' };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
  if (phone && (phone.length > 40 || !/^\+?[0-9][0-9\s()./-]{5,38}$/.test(phone) || phone.replace(/\D/g, '').length < 6)) {
    return { error: 'Bitte prüfen Sie die Telefonnummer.' };
  }
  if (!email && !phone) return { error: 'Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an.' };
  if (!services.has(subject)) return { error: 'Bitte wählen Sie eine gültige Art der Anfrage aus.' };
  if (message.length < 10 || message.length > 4000) return { error: 'Die Nachricht muss zwischen 10 und 4.000 Zeichen lang sein.' };
  return { value: { name, email: email || null, phone: phone || null, subject, message } };
}

export async function handleContactRequest(request, env, limiter) {
  if (request.method !== 'POST') return json(405, { error: 'Diese Anfrage ist nicht zulässig.' });
  if (request.headers.get('origin') !== new URL(request.url).origin) return json(403, { error: 'Die Anfrage konnte nicht geprüft werden.' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return json(415, { error: 'Die Formulardaten haben ein ungültiges Format.' });
  }
  if (Number(request.headers.get('content-length')) > 8192) return json(413, { error: 'Die Anfrage ist zu groß.' });

  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!limiter || !clientIp) return json(503, { error: 'Der Anfrageservice ist momentan nicht verfügbar.' });
  let limit;
  try { limit = await limiter.limit({ key: clientIp }); }
  catch {
    console.error('Contact intake unavailable: RATE_LIMIT_UNAVAILABLE');
    return json(503, { error: 'Der Anfrageservice ist momentan nicht verfügbar.' });
  }
  if (!limit.success) return json(429, { error: 'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.' });

  let payload;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json(400, { error: 'Die Formulardaten konnten nicht gelesen werden.' });
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 8192) {
        await reader.cancel();
        return json(413, { error: 'Die Anfrage ist zu groß.' });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const raw = new TextDecoder().decode(bytes);
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Die Formulardaten konnten nicht gelesen werden.' });
  }

  const validation = validateContactPayload(payload);
  if (validation.error) return json(400, { error: validation.error });
  const config = getSupabaseConfig(env);
  if (!config ||
      !/^[a-f0-9]{64,}$/.test(env.SUPABASE_INTAKE_TOKEN || '')) {
    console.error('Contact intake unavailable: SUPABASE_CONFIG_MISSING_OR_INVALID');
    return json(503, { error: 'Der Anfrageservice ist noch nicht vollständig eingerichtet.' });
  }

  let upstream;
  try {
    upstream = await fetch(`${config.url}/rest/v1/rpc/submit_contact_request`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_intake_token: env.SUPABASE_INTAKE_TOKEN,
        p_name: validation.value.name,
        p_email: validation.value.email,
        p_phone: validation.value.phone,
        p_subject: validation.value.subject,
        p_message: validation.value.message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error('Supabase contact RPC failed: NETWORK_OR_TIMEOUT');
    return json(503, { error: 'Die Anfrage konnte derzeit nicht gespeichert werden. Bitte versuchen Sie es später erneut.' });
  }

  if (!upstream.ok) {
    // Log only status/code, never tokens, request bodies or customer data.
    let code = 'UNKNOWN';
    try {
      const detail = await upstream.json();
      if (/^[A-Z0-9_]{1,32}$/.test(detail.code)) code = detail.code;
    } catch { /* An upstream proxy may return non-JSON errors. */ }
    console.error('Supabase contact RPC failed', upstream.status, code);
    return json(503, { error: 'Die Anfrage konnte derzeit nicht gespeichert werden. Bitte versuchen Sie es später erneut.' });
  }
  // PostgREST returns JSON null (200) or an empty body (204) for this void RPC.
  // A proxy's HTML page with HTTP 200 is not a storage confirmation.
  let confirmation;
  try { confirmation = await upstream.text(); }
  catch {
    console.error('Supabase contact RPC failed: CONFIRMATION_UNAVAILABLE');
    return json(503, { error: 'Die Speicherung konnte nicht bestätigt werden. Bitte kontaktieren Sie uns telefonisch, bevor Sie die Anfrage erneut senden.' });
  }
  if (!((upstream.status === 204 && !confirmation) ||
        (upstream.status === 200 && confirmation.trim() === 'null'))) {
    console.error('Supabase contact RPC failed: INVALID_CONFIRMATION');
    return json(503, { error: 'Die Speicherung konnte nicht bestätigt werden. Bitte kontaktieren Sie uns telefonisch, bevor Sie die Anfrage erneut senden.' });
  }
  return json(201, { ok: true });
}
