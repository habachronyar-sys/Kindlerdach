import { createClient } from '@supabase/supabase-js';

const page = document.body.dataset.page;
const statusLabels = {
  new: 'Neu',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
  archived: 'Archiviert',
};
const statusEl = document.querySelector(page === 'login' ? '#login-status' : '#dashboard-status');
let supabase;
let records = [];
let selectedId = null;
let currentView = 'all';
let loadFailed = false;
let refreshTimer;

function clearDashboard() {
  window.clearInterval(refreshTimer);
  records = [];
  selectedId = null;
  document.querySelector('#requests-table')?.replaceChildren();
  document.querySelector('#request-detail')?.close();
  for (const selector of ['#detail-name', '#detail-message', '#detail-email', '#detail-phone', '#admin-identity']) {
    document.querySelector(selector)?.replaceChildren();
  }
  document.querySelectorAll('[data-admin-content]').forEach(element => { element.hidden = true; });
}

function showStatus(element, message, kind = '') {
  if (!element) return;
  element.textContent = message;
  if (kind) element.dataset.kind = kind;
  else delete element.dataset.kind;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function loadClient() {
  const response = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Die Supabase-Konfiguration konnte nicht geladen werden.');
  const config = await response.json();
  if (!config.configured) throw new Error('Supabase ist noch nicht eingerichtet. Bitte folgen Sie der Einrichtungsanleitung.');
  supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

async function isAuthorized(userId) {
  const { data, error } = await supabase
    .from('authorized_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Die Admin-Berechtigung konnte nicht geprüft werden.');
  return Boolean(data);
}

async function initializeLogin() {
  const form = document.querySelector('#login-form');
  await loadClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Der Anmeldestatus konnte nicht geprüft werden.');
  if (data.session) {
    if (await isAuthorized(data.session.user.id)) {
      location.replace('/admin');
      return;
    }
    await supabase.auth.signOut();
    showStatus(statusEl, 'Dieses Konto ist nicht für das Dashboard freigeschaltet.', 'error');
  }

  form.querySelector('button[type="submit"]').disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(statusEl, 'Anmeldung wird geprüft …');
    const formData = new FormData(form);
    try {
      const { data: login, error: loginError } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email')).trim(),
        password: String(formData.get('password')),
      });
      if (loginError) {
        showStatus(statusEl, 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.', 'error');
        return;
      }
      if (!await isAuthorized(login.user.id)) {
        await supabase.auth.signOut();
        showStatus(statusEl, 'Dieses Konto ist nicht für das Dashboard freigeschaltet.', 'error');
        return;
      }
      location.replace('/admin');
    } catch (error) {
      showStatus(statusEl, error.message || 'Die Anmeldung konnte nicht abgeschlossen werden.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function displayContact(record) {
  const wrapper = document.createElement('span');
  const values = [record.email, record.phone].filter(Boolean);
  wrapper.textContent = values.join(' · ') || 'Keine Kontaktmöglichkeit';
  return wrapper;
}

function renderStats() {
  const total = document.querySelector('#stat-total');
  const newCount = document.querySelector('#stat-new');
  const openCount = document.querySelector('#stat-open');
  if (loadFailed) {
    total.textContent = newCount.textContent = openCount.textContent = '—';
    return;
  }
  total.textContent = String(records.length);
  newCount.textContent = String(records.filter(record => record.status === 'new').length);
  openCount.textContent = String(records.filter(record => ['new', 'in_progress'].includes(record.status)).length);
}

function getVisibleRecords() {
  const query = document.querySelector('#request-search').value.trim().toLocaleLowerCase('de');
  const status = document.querySelector('#status-filter').value;
  return records.filter(record => {
    if (currentView === 'active' && record.status === 'archived') return false;
    if (currentView === 'archive' && record.status !== 'archived') return false;
    if (status !== 'all' && record.status !== status) return false;
    const haystack = [record.name, record.subject, record.email, record.phone, record.message].filter(Boolean).join(' ').toLocaleLowerCase('de');
    return !query || haystack.includes(query);
  });
}

function renderRequests() {
  const table = document.querySelector('#requests-table');
  const empty = document.querySelector('#requests-empty');
  const rows = getVisibleRecords();
  table.replaceChildren();
  empty.hidden = rows.length > 0;
  empty.textContent = loadFailed ? 'Die Anfragen konnten nicht geladen werden.' : 'Keine passenden Kontaktanfragen vorhanden.';
  for (const record of rows) {
    const row = document.createElement('tr');
    const cells = [
      formatDate(record.created_at),
      record.name,
      record.subject,
      displayContact(record),
    ];
    for (const value of cells) {
      const cell = document.createElement('td');
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value;
      row.append(cell);
    }
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.dataset.status = record.status;
    badge.textContent = statusLabels[record.status] || 'Unbekannt';
    statusCell.append(badge);
    row.append(statusCell);
    const actionCell = document.createElement('td');
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'table-action';
    action.textContent = 'Öffnen';
    action.setAttribute('aria-label', `Anfrage von ${record.name} öffnen`);
    action.addEventListener('click', () => openDetails(record.id));
    actionCell.append(action);
    row.append(actionCell);
    table.append(row);
  }
}

function renderDashboard() {
  renderStats();
  renderRequests();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.admin-nav button').forEach(button => {
    const selected = button.dataset.view === view;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#requests-heading').textContent = view === 'archive'
    ? 'Archivierte Anfragen'
    : view === 'active' ? 'Offene Kontaktanfragen' : 'Kontaktanfragen';
  if (view === 'archive') document.querySelector('#status-filter').value = 'all';
  renderRequests();
}

function setOptionalLink(element, value, scheme) {
  element.replaceChildren();
  if (!value) {
    element.textContent = 'Nicht angegeben';
    return;
  }
  const link = document.createElement('a');
  link.textContent = value;
  link.href = `${scheme}:${value}`;
  element.append(link);
}

function openDetails(id) {
  const record = records.find(item => item.id === id);
  if (!record) return;
  selectedId = id;
  document.querySelector('#detail-name').textContent = record.name;
  document.querySelector('#detail-date').textContent = `Eingegangen am ${formatDate(record.created_at)}`;
  document.querySelector('#detail-subject').textContent = record.subject;
  document.querySelector('#detail-message').textContent = record.message;
  setOptionalLink(document.querySelector('#detail-email'), record.email, 'mailto');
  setOptionalLink(document.querySelector('#detail-phone'), record.phone, 'tel');
  document.querySelector('#detail-status-select').value = record.status;
  showStatus(document.querySelector('#detail-status'), '');
  document.querySelector('#mark-read').disabled = Boolean(record.read_at);
  document.querySelector('#mark-read').textContent = record.read_at ? 'Bereits gelesen' : 'Als gelesen markieren';
  document.querySelector('#request-detail').showModal();
}

async function reloadRequests() {
  const dashboardStatus = document.querySelector('#dashboard-status');
  showStatus(dashboardStatus, 'Anfragen werden geladen …');
  try {
  // Recheck the allowlist on every refresh: revoked access is not an empty inbox.
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user || !await isAuthorized(identity.user.id)) {
    clearDashboard();
    location.replace('/admin/login');
    return;
  }
  const loaded = [];
  // Supabase normally caps a response at 1,000 rows. Fetch bounded pages so
  // older requests remain searchable and the total is not silently truncated.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase
      .from('contact_requests')
      .select('id, created_at, name, phone, email, subject, message, status, read_at, updated_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 99);
    if (error) throw new Error('Die Anfragen konnten nicht geladen werden. Prüfen Sie die Verbindung und die Admin-Berechtigung.');
    loaded.push(...data);
    if (data.length < 100) break;
  }
  records = loaded;
  loadFailed = false;
  renderDashboard();
  showStatus(dashboardStatus, `Zuletzt aktualisiert: ${new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' }).format(new Date())} Uhr`, 'success');
  } catch (error) {
    records = [];
    loadFailed = true;
    document.querySelector('#request-detail').close();
    renderDashboard();
    showStatus(dashboardStatus, error.message || 'Die Verbindung konnte nicht geprüft werden.', 'error');
  }
}

async function updateRequest(values, successMessage) {
  const { data, error } = await supabase
    .from('contact_requests')
    .update(values)
    .eq('id', selectedId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    showStatus(document.querySelector('#detail-status'), 'Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.', 'error');
    return false;
  }
  showStatus(document.querySelector('#detail-status'), successMessage, 'success');
  await reloadRequests();
  const latest = records.find(record => record.id === selectedId);
  if (latest) {
    document.querySelector('#detail-status-select').value = latest.status;
    document.querySelector('#mark-read').disabled = Boolean(latest.read_at);
    document.querySelector('#mark-read').textContent = latest.read_at ? 'Bereits gelesen' : 'Als gelesen markieren';
  }
  return true;
}

async function initializeDashboard() {
  await loadClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Der Anmeldestatus konnte nicht geprüft werden.');
  if (!data.session) {
    location.replace('/admin/login');
    return;
  }
  if (!await isAuthorized(data.session.user.id)) {
    await supabase.auth.signOut();
    location.replace('/admin/login');
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      clearDashboard();
      location.replace('/admin/login');
    }
  });
  document.querySelectorAll('[data-admin-content]').forEach(element => { element.hidden = false; });
  document.querySelector('#admin-identity').textContent = data.session.user.email || '';
  document.querySelector('#sign-out').addEventListener('click', async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      showStatus(document.querySelector('#dashboard-status'), 'Abmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.', 'error');
      return;
    }
    location.replace('/admin/login');
  });
  document.querySelector('#refresh-requests').addEventListener('click', reloadRequests);
  document.querySelector('#request-search').addEventListener('input', renderRequests);
  document.querySelector('#status-filter').addEventListener('change', renderRequests);
  document.querySelectorAll('.admin-nav button').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  document.querySelector('#close-detail').addEventListener('click', () => document.querySelector('#request-detail').close());
  document.querySelector('#save-status').addEventListener('click', async () => {
    const status = document.querySelector('#detail-status-select').value;
    if (!statusLabels[status]) return;
    await updateRequest({ status }, 'Der Status wurde gespeichert. Eine Kundenbenachrichtigung wird nicht versendet.');
  });
  document.querySelector('#mark-read').addEventListener('click', async () => {
    await updateRequest({ read_at: new Date().toISOString() }, 'Die Anfrage wurde als gelesen markiert.');
  });
  document.querySelector('#delete-request').addEventListener('click', async () => {
    const record = records.find(item => item.id === selectedId);
    if (!record || !window.confirm(`Die Anfrage von ${record.name} endgültig löschen?`)) return;
    const { data, error: deleteError } = await supabase
      .from('contact_requests')
      .delete()
      .eq('id', selectedId)
      .select('id')
      .maybeSingle();
    if (deleteError || !data) {
      showStatus(document.querySelector('#detail-status'), 'Die Anfrage konnte nicht gelöscht werden.', 'error');
      return;
    }
    document.querySelector('#request-detail').close();
    await reloadRequests();
  });
  await reloadRequests();
  refreshTimer = window.setInterval(() => {
    reloadRequests().catch(() => showStatus(statusEl, 'Die Verbindung oder Admin-Berechtigung konnte nicht geprüft werden.', 'error'));
  }, 60_000);
}

async function initialize() {
  try {
    if (page === 'login') await initializeLogin();
    else await initializeDashboard();
  } catch (error) {
    showStatus(statusEl, error.message || 'Der Admin-Bereich konnte nicht geladen werden.', 'error');
  }
}

initialize();
