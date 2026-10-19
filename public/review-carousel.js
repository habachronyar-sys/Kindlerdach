// Native horizontal scrolling remains available without JavaScript.
(() => {
  const track = document.querySelector('#review-track');
  if (!track) return;
  let cards = [...track.children];
  if (cards.length < 2) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pauseButton = document.querySelector('#reviews-pause');
  let paused = reducedMotion.matches;
  let hovering = false;
  let focused = false;
  let dragging = false;
  let visible = false;
  let resumeAt = 0;
  let cycleWidth = 0;
  let previousTime = 0;
  let travel = 0;
  let dragX = 0;
  let dragScroll = 0;
  let animationFrame = 0;
  let resumeTimer;

  function canAnimate() {
    return cycleWidth && visible && !document.hidden && !paused && !hovering && !focused && !dragging && performance.now() >= resumeAt;
  }
  function wake() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousTime = 0;
    if (canAnimate()) animationFrame = requestAnimationFrame(animate);
  }

  // Identical copies provide the seam, without inventing extra reviews.
  // Assistive technology only reads the three original cards.
  function copyCard(card) {
    const copy = card.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('inert', '');
    copy.classList.add('review-copy');
    return copy;
  }
  function addCopies() {
    track.querySelectorAll('.review-copy').forEach(copy => copy.remove());
    cards = [...track.children];
    if (cards.length < 2) return;
    track.prepend(...cards.map(copyCard));
    track.append(...cards.map(copyCard));
  }
  addCopies();

  function measure() {
    if (cards.length < 2) { cycleWidth = 0; return; }
    const newWidth = cards[0].offsetLeft - track.firstElementChild.offsetLeft;
    const fraction = cycleWidth ? ((track.scrollLeft % cycleWidth) + cycleWidth) % cycleWidth / cycleWidth : 0;
    cycleWidth = newWidth;
    track.scrollLeft = cycleWidth * (1 + fraction);
    wake();
  }
  function wrap() {
    if (!cycleWidth || dragging) return;
    if (track.scrollLeft < cycleWidth * 0.5) track.scrollLeft += cycleWidth;
    else if (track.scrollLeft >= cycleWidth * 1.5) track.scrollLeft -= cycleWidth;
  }
  function rest() {
    resumeAt = performance.now() + 4500;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(wake, 4501);
    wake();
  }
  function updatePauseButton() {
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Laufband starten' : 'Laufband pausieren';
    wake();
  }
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    updatePauseButton();
  });
  reducedMotion.addEventListener('change', event => {
    paused = event.matches;
    updatePauseButton();
  });
  function step(direction) {
    if (cards.length < 2) return;
    rest();
    track.scrollLeft += direction * (cards[1].offsetLeft - cards[0].offsetLeft);
    wrap();
  }
  document.querySelector('#reviews-previous').addEventListener('click', () => step(-1));
  document.querySelector('#reviews-next').addEventListener('click', () => step(1));
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  track.addEventListener('mouseenter', () => { hovering = true; wake(); });
  track.addEventListener('mouseleave', () => { hovering = false; wake(); });
  track.addEventListener('focusin', () => { focused = true; wake(); });
  track.addEventListener('focusout', () => { focused = false; rest(); });
  track.addEventListener('wheel', event => {
    rest();
    // Trackpads retain native horizontal scrolling. Vertical mouse-wheel
    // input moves through the reviews while the pointer is over the track.
    if (!event.ctrlKey && !event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? track.clientWidth : 1;
      track.scrollLeft += event.deltaY * unit;
      wrap();
    }
  }, { passive: false });
  track.addEventListener('pointerdown', event => {
    rest();
    if (event.target.closest('button, a')) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragging = true;
    dragX = event.clientX;
    dragScroll = track.scrollLeft;
    track.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
  });
  track.addEventListener('pointermove', event => {
    if (dragging) track.scrollLeft = dragScroll - (event.clientX - dragX);
  });
  function release() {
    dragging = false;
    track.classList.remove('is-dragging');
    rest();
    wrap();
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('lostpointercapture', release);
  track.addEventListener('scroll', wrap, { passive: true });
  new ResizeObserver(measure).observe(track);
  document.addEventListener('reviews:updated', () => {
    cycleWidth = 0;
    travel = 0;
    addCopies();
    measure();
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    wake();
  }).observe(track);
  document.addEventListener('visibilitychange', wake);
  function animate(time) {
    const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
    previousTime = time;
    if (canAnimate()) {
      // Decreasing scrollLeft makes the cards travel from left to right.
      travel += elapsed * 0.028;
      const pixels = Math.floor(travel);
      track.scrollLeft -= pixels;
      travel -= pixels;
      wrap();
    }
    animationFrame = canAnimate() ? requestAnimationFrame(animate) : 0;
  }
  measure();
  updatePauseButton();
  wake();
})();
