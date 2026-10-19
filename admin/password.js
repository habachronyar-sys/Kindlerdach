import { createClient } from '@supabase/supabase-js';

const page = document.body.dataset.page;
const statusEl = document.querySelector('#password-status');
// Read the fragment before Supabase consumes it. A stored dashboard session
// alone must never activate this form. Recovery sessions live only in memory.
const fragment = new URLSearchParams(location.hash.slice(1));
const hasRecoveryLink = fragment.get('type') === 'recovery' &&
  Boolean(fragment.get('access_token') && fragment.get('refresh_token'));
let supabase;
let recoveryReady = false;
let recoveryUserId = null;

function showStatus(message, kind = '') {
  statusEl.textContent = message;
  if (kind) statusEl.dataset.kind = kind;
  else delete statusEl.dataset.kind;
}

async function loadClient() {
  const response = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Die Verbindung konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.');
  const config = await response.json();
  if (!config.configured) throw new Error('Die Anmeldung ist derzeit nicht verfügbar. Bitte wenden Sie sich an den Website-Betreiber.');
  supabase = createClient(config.url, config.publishableKey, {
    auth: {
      flowType: 'implicit', persistSession: false, autoRefreshToken: false,
      detectSessionInUrl: page === 'reset-password' && hasRecoveryLink,
    },
  });
}

function resetError(error) {
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code) || error?.status === 429) {
    return 'Zu viele Versuche. Bitte warten Sie einige Minuten, bevor Sie einen neuen Link anfordern.';
  }
  if (error?.code === 'email_address_not_authorized') {
    return 'Der E-Mail-Versand ist noch nicht vollständig eingerichtet. Bitte wenden Sie sich an den Website-Betreiber.';
  }
  return 'Der Link konnte derzeit nicht angefordert werden. Bitte versuchen Sie es später erneut.';
}

async function initializeForgot() {
  await loadClient();
  const form = document.querySelector('#forgot-form');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = false;
  showStatus('');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    showStatus('Link wird angefordert …');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.elements.email.value.trim(), {
        redirectTo: `${location.origin}/admin/reset-password`,
      });
      if (error) {
        showStatus(resetError(error), 'error');
        return;
      }
      // Supabase deliberately hides whether the address belongs to a user.
      showStatus('Wenn für diese Adresse ein Konto besteht, erhalten Sie eine E-Mail zum Zurücksetzen. Prüfen Sie auch Ihren Spam-Ordner. Es wird kein neues Konto angelegt.', 'success');
    } catch {
      showStatus('Der Dienst ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut.', 'error');
    } finally { button.disabled = false; }
  });
}

async function initializeReset() {
  const form = document.querySelector('#reset-form');
  const button = form.querySelector('button[type="submit"]');
  const invalidLink = 'Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.';
  if (!hasRecoveryLink) {
    history.replaceState(null, '', location.pathname);
    showStatus(invalidLink, 'error');
    return;
  }
  try {
    await loadClient();
    // Await SDK initialization so that the fragment has become a session.
    const { data, error } = await supabase.auth.getSession();
    history.replaceState(null, '', location.pathname);
    if (error || !data.session) { showStatus(invalidLink, 'error'); return; }
    const { data: identity, error: identityError } = await supabase.auth.getUser();
    if (identityError || !identity.user) { showStatus(invalidLink, 'error'); return; }
    const { data: authorization, error: authorizationError } = await supabase
      .from('authorized_admins').select('user_id').eq('user_id', identity.user.id).maybeSingle();
    if (authorizationError) throw new Error('Die Zugriffsberechtigung konnte nicht geprüft werden. Bitte versuchen Sie es später mit einem neuen Link.');
    if (!authorization) {
      await supabase.auth.signOut({ scope: 'local' });
      showStatus('Dieses Konto ist nicht für den Inhaberbereich freigeschaltet.', 'error');
      return;
    }
    recoveryReady = true;
    recoveryUserId = identity.user.id;
    form.hidden = false;
    button.disabled = false;
    showStatus('Link bestätigt. Sie können jetzt Ihr neues Passwort festlegen.');
  } catch (error) {
    history.replaceState(null, '', location.pathname);
    showStatus(error.message || 'Der Link konnte nicht geprüft werden. Bitte fordern Sie einen neuen Link an.', 'error');
    return;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!recoveryReady || button.disabled || !form.reportValidity()) return;
    const password = form.elements.password.value;
    if (password.length < 12 || new TextEncoder().encode(password).length > 72) {
      showStatus('Bitte wählen Sie ein Passwort mit mindestens 12 Zeichen. Sehr lange Passwörter oder viele Sonderzeichen können die zulässige Länge überschreiten.', 'error');
      return;
    }
    if (password !== form.elements.confirmation.value) {
      showStatus('Die beiden Passwörter stimmen nicht überein.', 'error');
      form.elements.confirmation.focus();
      return;
    }
    button.disabled = true;
    showStatus('Passwort wird gespeichert …');
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.code === 'same_password') showStatus('Bitte wählen Sie ein anderes Passwort als bisher.', 'error');
        else if (error.code === 'weak_password') showStatus('Dieses Passwort entspricht nicht den Sicherheitsanforderungen. Bitte wählen Sie ein stärkeres Passwort.', 'error');
        else showStatus('Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut oder fordern Sie bei einem abgelaufenen Link einen neuen an.', 'error');
        return;
      }
      if (data?.user?.id !== recoveryUserId) {
        showStatus('Die Änderung konnte nicht bestätigt werden. Prüfen Sie die Anmeldung mit dem neuen Passwort, bevor Sie es erneut versuchen.', 'error');
        return;
      }
      recoveryReady = false;
      form.reset();
      form.hidden = true;
      document.querySelector('#request-another-link').hidden = true;
      showStatus('Ihr Passwort wurde geändert. Sie können sich jetzt mit Ihrem neuen Passwort anmelden.', 'success');
      // Sign-out failure must not undo or conceal the confirmed password change.
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* memory-only session */ }
    } catch {
      showStatus('Die Änderung konnte nicht bestätigt werden. Versuchen Sie die Anmeldung mit dem neuen Passwort, bevor Sie einen weiteren Link anfordern.', 'error');
    } finally { button.disabled = !recoveryReady; }
  });
}

async function initialize() {
  try {
    if (page === 'forgot-password') await initializeForgot();
    else if (page === 'reset-password') await initializeReset();
  } catch {
    showStatus('Die Verbindung konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.', 'error');
  }
}

initialize();
