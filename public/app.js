const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('is-open');
}
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  navigation.classList.toggle('is-open', expanded);
});
navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);

const lightbox = document.querySelector('#lightbox');
document.querySelectorAll('[data-image]').forEach(button => {
  button.addEventListener('click', () => {
    const image = document.querySelector('#lightbox-image');
    image.src = button.dataset.image;
    image.alt = button.querySelector('img').alt;
    document.querySelector('#lightbox-caption').textContent = button.dataset.caption;
    lightbox.showModal();
  });
});
document.querySelector('.lightbox-close')?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', event => {
  if (event.target === lightbox) {
    const box = lightbox.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) lightbox.close();
  }
});

const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector('#service').value = link.dataset.service; });
});
function validate(field) {
  let error = '';
  if (field.id === 'name' && !field.value.trim()) error = 'Bitte geben Sie Ihren Namen ein.';
  else if (field.id === 'email' && field.value.trim() && !field.validity.valid) error = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  else if (field.id === 'message' && field.value.trim().length < 10) error = 'Bitte beschreiben Sie Ihr Vorhaben mit mindestens 10 Zeichen.';
  field.setAttribute('aria-invalid', String(Boolean(error)));
  field.setAttribute('aria-describedby', `${field.id}-error`);
  const errorMessage = document.querySelector(`#${field.id}-error`);
  if (errorMessage) errorMessage.textContent = error;
  return !error;
}
form?.querySelectorAll('[required]').forEach(field => {
  field.addEventListener('blur', () => { if (field.value || field.hasAttribute('aria-invalid')) validate(field); });
  field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validate(field); });
});
form?.addEventListener('input', () => {
  status.textContent = '';
});
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = [...form.querySelectorAll('[required]')];
  const results = fields.map(validate);
  if (results.includes(false)) {
    fields[results.indexOf(false)].focus();
    status.textContent = 'Bitte prüfen Sie die markierten Felder.';
    return;
  }
  const phone = form.elements.phone;
  const email = form.elements.email;
  const emailValid = !email.value.trim() || email.validity.valid;
  const phoneValid = !phone.value.trim() || (/^\+?[0-9][0-9\s()./-]{5,38}$/.test(phone.value.trim()) && phone.value.replace(/\D/g, '').length >= 6);
  email.setAttribute('aria-invalid', String(!emailValid));
  document.querySelector('#email-error').textContent = emailValid ? '' : 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  phone.setAttribute('aria-invalid', String(!phoneValid));
  document.querySelector('#phone-error').textContent = phoneValid ? '' : 'Bitte prüfen Sie die Telefonnummer.';
  if (!emailValid || !phoneValid || (!phone.value.trim() && !email.value.trim())) {
    if (!phone.value.trim() && !email.value.trim()) status.textContent = 'Bitte geben Sie mindestens eine Telefonnummer oder E-Mail-Adresse an.';
    else if (!emailValid) status.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    else status.textContent = 'Bitte prüfen Sie die Telefonnummer.';
    if (!emailValid) email.focus();
    else if (!phoneValid) phone.focus();
    else email.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const controls = [...form.querySelectorAll('input,select,textarea,button')];
  const payload = Object.fromEntries(new FormData(form));
  controls.forEach(control => { control.disabled = true; });
  button.disabled = true;
  status.textContent = 'Ihre Anfrage wird sicher übermittelt …';
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(response.status === 404 || response.status === 405
        ? 'Der Formularservice ist unter dieser Adresse nicht verfügbar. Bitte kontaktieren Sie uns telefonisch.'
        : 'Die Serverantwort konnte nicht geprüft werden.');
    }
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Die Anfrage konnte nicht gespeichert werden.');
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach(message => { message.textContent = ''; });
    status.textContent = 'Vielen Dank. Ihre Anfrage wurde gespeichert. Der Betrieb meldet sich über Ihre angegebene Kontaktmöglichkeit.';
  } catch (error) {
    status.textContent = ['TimeoutError', 'AbortError'].includes(error.name)
      ? 'Der Server antwortet zu langsam. Die Speicherung ist unklar. Bitte kontaktieren Sie uns telefonisch, bevor Sie erneut senden. Ihre Eingaben bleiben erhalten.'
      : error instanceof TypeError
      ? 'Der Server ist derzeit nicht erreichbar. Ihre Eingaben bleiben erhalten – bitte versuchen Sie es später erneut.'
      : `${error.message} Ihre Eingaben bleiben erhalten – bitte versuchen Sie es erneut.`;
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
});
