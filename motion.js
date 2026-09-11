// Content is visible by default. Motion enhances the page without gating access.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
const entered = new WeakSet();
const running = new Map();
const accordions = new Map();
let observer;

const groups = [
  '.hero-copy', '.page-hero-copy', '.contact-title', '.giving-hero .wrap',
  '.fellowship-grid', '.ministry-grid', '.location-grid', '.prayer-times', '.gospel-plan', '.prayer-gallery',
];
const revealSelector = [
  ...groups.map(selector => `${selector} > *`),
  '.intro > div', '.section-heading', '.prayer-intro',
  '.event-radio-grid > *', '.mission-band .wrap > *', '.split-section > *',
  '.scripture .wrap', '.vision-block', '.reading-summary',
  '.scripture-library > div', '.contact-layout > *', '.contact-faq > *',
  '.giving-layout > *', '.word-broadcast > *', '.footer-top > *',
].join(',');
const candidates = [...document.querySelectorAll(revealSelector)];
// Do not animate nested blocks twice or fade children inside a moving parent.
const candidateSet = new Set(candidates);
const targets = candidates.filter(element => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (candidateSet.has(parent)) return false;
  }
  return true;
});

function reveal(element, delay = 0) {
  if (entered.has(element)) return;
  entered.add(element);
  if (reducedMotion.matches || !element.animate) return;
  const animation = element.animate([
    {opacity: 0, transform: 'translateY(16px)'},
    {opacity: 1, transform: 'none'},
  ], {duration: 700, delay, easing, fill: 'backwards'});
  running.set(element, animation);
  const release = () => { if (running.get(element) === animation) running.delete(element); };
  animation.onfinish = release;
  animation.oncancel = release;
}

function startReveals() {
  observer?.disconnect();
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  let anchor;
  try { anchor = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* Invalid fragments should not affect reading. */ }
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    visible.forEach((entry, index) => {
      const element = entry.target;
      observer.unobserve(element);
      // Anchor links and already-focused content should be available immediately.
      if ((anchor && (element.contains(anchor) || anchor.contains(element))) || element.contains(document.activeElement)) {
        entered.add(element);
        return;
      }
      const grouped = groups.some(selector => element.parentElement?.matches(selector));
      reveal(element, grouped ? Math.min(index * 55, 165) : 0);
    });
  }, {threshold: 0, rootMargin: '0px 0px -24px 0px'});
  for (const element of targets) {
    if (entered.has(element)) continue;
    if (element.getBoundingClientRect().bottom < 0) entered.add(element);
    else observer.observe(element);
  }
}

// Only the header's scrolled state changes, at most once per animation frame.
const header = document.querySelector('.site-header');
let headerFrame = 0;
function updateHeader() {
  header?.classList.toggle('is-scrolled', scrollY > 12);
  headerFrame = 0;
}
addEventListener('scroll', () => {
  if (!headerFrame) headerFrame = requestAnimationFrame(updateHeader);
}, {passive: true});
updateHeader();

// Preserve native details behavior when motion is unavailable or unwanted.
for (const details of document.querySelectorAll('details')) {
  const summary = details.querySelector('summary');
  summary?.addEventListener('click', event => {
    if (reducedMotion.matches || !details.animate || event.defaultPrevented) return;
    event.preventDefault();
    const previous = accordions.get(details);
    const opening = previous ? !previous.opening : !details.open;
    const startHeight = details.getBoundingClientRect().height;
    if (previous) {
      previous.animation.onfinish = null;
      previous.animation.oncancel = null;
      previous.animation.cancel();
    }
    const originalOverflow = previous?.originalOverflow ?? details.style.overflow;
    const style = getComputedStyle(details);
    const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    if (opening) details.open = true;
    const endHeight = opening
      ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height + borderHeight;
    details.style.overflow = 'hidden';
    const animation = details.animate([
      {height: `${startHeight}px`}, {height: `${endHeight}px`},
    ], {duration: 340, easing});
    const settle = () => {
      if (accordions.get(details)?.animation !== animation) return;
      details.open = opening;
      details.style.overflow = originalOverflow;
      accordions.delete(details);
    };
    accordions.set(details, {animation, opening, originalOverflow, settle});
    animation.onfinish = settle;
    animation.oncancel = settle;
  });
}

document.addEventListener('focusin', event => {
  for (const element of targets) {
    if (!element.contains(event.target)) continue;
    observer?.unobserve(element);
    entered.add(element);
    running.get(element)?.cancel();
    running.delete(element);
  }
});

function stopMotion() {
  observer?.disconnect();
  for (const animation of running.values()) animation.cancel();
  running.clear();
  for (const state of [...accordions.values()]) {
    state.settle();
    state.animation.cancel();
  }
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) stopMotion();
  else startReveals();
});
addEventListener('pagehide', stopMotion);
addEventListener('pageshow', event => {
  if (event.persisted) { updateHeader(); startReveals(); }
});
startReveals();
