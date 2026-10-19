(() => {
  const track = document.querySelector('#review-track');
  const list = document.querySelector('#all-review-list');
  if (!track || !list) return;
  const disclosure = document.querySelector('#all-reviews');
  const disclosureLabel = document.querySelector('#all-reviews-label');
  const connectionLabel = document.querySelector('#reviews-connection-status');
  const connection = document.querySelector('.reviews-connection');
  const source = document.querySelector('.reviews-source');
  let signature = '';
  let hasGoogleData = false;
  let requestPending = false;
  let timer;

  // The documented excerpts remain readable until the business owner grants
  // Google access. A missing connection never pretends to be a live feed.
  track.querySelectorAll('.review:not(.review-copy)').forEach(card => list.append(card.cloneNode(true)));

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function dateLabel(date) {
    const parsed = new Date(date);
    return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(parsed) : '';
  }
  function reviewCard(review, fullText, index) {
    const card = element('figure', 'review');
    if (fullText) card.id = `full-review-${index}`;
    const stars = element('div', 'review-stars', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating));
    stars.setAttribute('aria-label', `${review.rating} von 5 Sternen`);
    const quote = element('blockquote');
    quote.append(element('p', fullText ? '' : 'review-excerpt', review.text || 'Bewertung ohne Text.'));
    const caption = element('figcaption');
    const initials = review.author.trim().split(/\s+/).slice(0, 2).map(name => [...name][0] || '').join('').toLocaleUpperCase('de');
    const avatar = element('span', 'review-avatar', initials);
    avatar.setAttribute('aria-hidden', 'true');
    const attribution = element('span');
    attribution.append(element('strong', '', review.author));
    const time = element('time', '', dateLabel(review.createdAt));
    if (time.textContent) time.dateTime = review.createdAt;
    attribution.append(time);
    caption.append(avatar, attribution);
    card.append(stars, quote, caption);
    if (!fullText && review.text.length > 160) {
      const read = element('button', 'review-read-more', 'Vollständige Bewertung lesen ↓');
      read.type = 'button';
      read.addEventListener('click', () => {
        disclosure.open = true;
        const destination = document.getElementById(`full-review-${index}`);
        destination.tabIndex = -1;
        destination.focus({ preventScroll: true });
        destination.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      });
      quote.append(read);
    }
    return card;
  }
  function updateSummary(data) {
    const average = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.averageRating);
    document.querySelector('#reviews-average').textContent = average;
    document.querySelector('#reviews-total-label').textContent = `${data.totalReviewCount} Google-Bewertungen`;
    const heroScore = document.querySelector('.rating-score');
    heroScore.replaceChildren(document.createTextNode(average), element('span', '', '/ 5'));
    document.querySelector('.rating-summary strong').textContent = `${data.totalReviewCount} Google-Bewertungen`;
    const rounded = Math.max(0, Math.min(5, Math.round(data.averageRating)));
    document.querySelectorAll('.rating-stars').forEach(stars => { stars.textContent = '★'.repeat(rounded) + '☆'.repeat(5 - rounded); });
    document.querySelector('.google-rating').setAttribute('aria-label', `Google-Bewertung: ${average} von 5 bei ${data.totalReviewCount} Bewertungen`);
    document.querySelector('.rating-source').textContent = `Quelle: Google · abgerufen am ${dateLabel(data.fetchedAt)}`;
    connection.classList.add('is-connected');
    connection.classList.toggle('is-stale', data.status === 'stale');
    const stamp = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(data.fetchedAt));
    connectionLabel.textContent = data.status === 'stale' ? `Letzter Abgleich ${stamp} Uhr · Aktualisierung verzögert` : `Mit Google verbunden · Abgleich ${stamp} Uhr`;
    source.textContent = `Quelle: Google-Unternehmensprofil. ${data.reviews.length} abrufbare Rezensionen aus vollständig abgefragten Ergebnisseiten. Automatischer Abgleich alle 30 Sekunden bei geöffneter Seite; neue Rezensionen erscheinen, sobald Google sie über die Schnittstelle bereitstellt. Ohne Filter nach Sternebewertung.`;
    disclosureLabel.textContent = `Alle ${data.reviews.length} abrufbaren Bewertungen hier lesen`;
  }
  function validData(data) {
    return data?.source === 'google-business-profile' && data.complete === true && Array.isArray(data.reviews) && Number.isFinite(data.averageRating) && data.averageRating >= 0 && data.averageRating <= 5 && Number.isInteger(data.totalReviewCount) && data.totalReviewCount >= 0 && Number.isFinite(Date.parse(data.fetchedAt)) && data.reviews.every(review => typeof review.author === 'string' && typeof review.text === 'string' && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
  }
  function stopPolling() {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  async function refresh() {
    if (requestPending || document.hidden) return;
    requestPending = true;
    try {
      const response = await fetch('/api/reviews', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) stopPolling();
        if (response.status === 503) {
          const error = await response.json();
          if (error.code === 'GOOGLE_NOT_CONFIGURED') {
            // No needless polling before a real account connection exists.
            stopPolling();
            if (!hasGoogleData) connectionLabel.textContent = '3 verfügbare Auszüge · Google-Verbindung noch nicht freigegeben';
          }
        }
        throw new Error('Review source unavailable');
      }
      const data = await response.json();
      if (!validData(data)) throw new Error('Invalid review response');
      hasGoogleData = true;
      updateSummary(data);
      const nextSignature = JSON.stringify(data.reviews);
      if (signature !== nextSignature) {
        signature = nextSignature;
        const oldScroll = list.scrollTop;
        track.replaceChildren(...data.reviews.map((review, index) => reviewCard(review, false, index)));
        list.replaceChildren(...data.reviews.map((review, index) => reviewCard(review, true, index)));
        if (!data.reviews.length) {
          track.append(element('p', 'review-empty', 'Für dieses Profil sind noch keine Rezensionen abrufbar.'));
          list.append(element('p', 'review-empty', 'Noch keine Rezensionen vorhanden.'));
        }
        if (disclosure.open) list.scrollTop = oldScroll;
        document.dispatchEvent(new Event('reviews:updated'));
      }
    } catch {
      if (hasGoogleData) {
        connection.classList.add('is-stale');
        connectionLabel.textContent = 'Letzter geladener Stand · Google-Abgleich derzeit nicht möglich';
      }
    } finally { requestPending = false; }
  }
  // Initial fetching is same-origin: no visitor data goes to Google.
  function onVisibilityChange() { if (!document.hidden) refresh(); }
  // Live reviews stay off unless a deployment explicitly opts in.
  if (document.documentElement.dataset.reviewsApi === 'enabled') {
    timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    refresh();
  }
})();
