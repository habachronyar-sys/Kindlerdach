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
const draftLink = document.querySelector('#email-draft');
document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector('#service').value = link.dataset.service; });
});
function validate(field) {
  let error = '';
  if (!field.value.trim()) error = field.id === 'message' ? 'Bitte beschreiben Sie kurz Ihr Vorhaben.' : field.id === 'email' ? 'Bitte geben Sie Ihre E-Mail-Adresse ein.' : 'Bitte geben Sie Ihren Namen ein.';
  else if (field.id === 'email' && !field.validity.valid) error = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  else if (field.id === 'message' && field.value.trim().length < 10) error = 'Bitte beschreiben Sie Ihr Vorhaben mit mindestens 10 Zeichen.';
  field.setAttribute('aria-invalid', String(Boolean(error)));
  field.setAttribute('aria-describedby', `${field.id}-error`);
  document.querySelector(`#${field.id}-error`).textContent = error;
  return !error;
}
form?.querySelectorAll('[required]').forEach(field => {
  field.addEventListener('blur', () => { if (field.value || field.hasAttribute('aria-invalid')) validate(field); });
  field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validate(field); });
});
form?.addEventListener('input', () => {
  draftLink.hidden = true;
  draftLink.removeAttribute('href');
  status.textContent = '';
});
form?.addEventListener('submit', event => {
  event.preventDefault();
  const fields = [...form.querySelectorAll('[required]')];
  const results = fields.map(validate);
  if (results.includes(false)) {
    fields[results.indexOf(false)].focus();
    status.textContent = 'Bitte prüfen Sie die markierten Felder.';
    return;
  }
  const data = new FormData(form);
  const text = `Guten Tag,\r\n\r\n${data.get('message').trim()}\r\n\r\nAnfrage: ${data.get('service')}\r\nName: ${data.get('name').trim()}\r\nE-Mail: ${data.get('email').trim()}\r\nTelefon: ${data.get('phone').trim() || 'Nicht angegeben'}\r\n`;
  draftLink.href = `mailto:kindler-dach@gmx.de?subject=${encodeURIComponent(`Dachanfrage: ${data.get('service')}`)}&body=${encodeURIComponent(text)}`;
  draftLink.hidden = false;
  status.textContent = 'Ihr Entwurf ist vorbereitet. Öffnen Sie jetzt Ihr E-Mail-Programm, prüfen Sie die Nachricht und senden Sie sie dort ab. Es wurde noch keine Nachricht versendet. Falls kein E-Mail-Programm eingerichtet ist, schreiben Sie direkt an kindler-dach@gmx.de.';
});
