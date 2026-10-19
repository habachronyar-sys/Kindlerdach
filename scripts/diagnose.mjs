import { fileURLToPath } from 'node:url';
import { getSupabaseConfig } from '../server/config.mjs';

try { process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url))); }
catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('OFFEN: .env.local konnte nicht sicher gelesen werden. Format und Dateizugriff prüfen.');
    process.exit(1);
  }
}
const config = getSupabaseConfig(process.env);
let failures = 0;
function report(ok, message) {
  console.log(`${ok ? 'OK' : 'OFFEN'}: ${message}`);
  if (!ok) failures++;
}
report(Boolean(config), 'Supabase-URL und Publishable-Key lokal im gültigen Format (noch keine Anbieterprüfung)');
report(config?.url === 'https://lykeruumioxbmcvryrnq.supabase.co' || process.env.SUPABASE_URL === 'https://lykeruumioxbmcvryrnq.supabase.co', 'Projekt-URL entspricht dem angegebenen Kindler-Dach-Projekt');
report(/^[a-f0-9]{64,}$/.test(process.env.SUPABASE_INTAKE_TOKEN || ''), 'Serverseitiges Intake-Token vorhanden');
if (config) {
  const headers = { apikey: config.publishableKey };
  try {
    const auth = await fetch(`${config.url}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(10_000) });
    report(auth.ok, `Supabase Auth akzeptiert den Publishable-Key (HTTP ${auth.status})`);
    if (!auth.ok) throw new Error('AUTH_KEY_REJECTED');
    if (auth.ok) {
      const settings = await auth.json();
      report(settings.disable_signup === true, 'Öffentliche Registrierung in Supabase deaktiviert');
      report(settings.external?.anonymous_users === false, 'Anonyme Anmeldung in Supabase ausdrücklich deaktiviert');
    }
    // Zero rows requested: never fetch or print customer data.
    const read = await fetch(`${config.url}/rest/v1/contact_requests?select=id&limit=0`, { headers, signal: AbortSignal.timeout(10_000) });
    const readDetail = await read.json().catch(() => ({}));
    report([401, 403].includes(read.status) && readDetail.code === '42501', `Anonymer Tabellenzugriff verweigert (HTTP ${read.status}); allein kein vollständiger RLS-Nachweis`);
    // A null token can never pass the RPC's guard and cannot insert a message.
    const rpc = await fetch(`${config.url}/rest/v1/rpc/submit_contact_request`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_intake_token: null, p_name: null, p_email: null, p_phone: null, p_subject: null, p_message: null }),
      signal: AbortSignal.timeout(10_000),
    });
    const detail = await rpc.json().catch(() => ({}));
    report([401, 403].includes(rpc.status) && detail.code === '42501', `Kontakt-RPC vorhanden und ohne Token gesperrt (HTTP ${rpc.status})`);
  } catch (error) {
    report(false, `Weitere Cloud-Prüfungen nicht möglich: ${error.message === 'AUTH_KEY_REJECTED' ? 'API-Key nicht akzeptiert; Tabellen/RLS nicht geprüft' : error.cause?.code || error.name}`);
  }
} else {
  console.log('Cloud-Prüfungen übersprungen: Tragen Sie den echten Publishable-Key in .env.local ein.');
}
console.log('Keine Testnachricht angelegt. Speicherung, Admin-Login und Admin-RLS müssen anschließend separat geprüft werden.');
process.exitCode = failures ? 1 : 0;
