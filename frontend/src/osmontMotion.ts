// Osmont-style motion layer: scroll reveal for [data-anim] / cards / rows, and a minimal cursor follower.
// Purely visual; no app logic.
const REVEAL_SELECTOR = '[data-anim], .panel, .os-reveal, .page-heading';

function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: [0, 0.1, 0.2] },
  );
  const scan = (root: ParentNode) => {
    root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
      if (el.dataset.osObserved) return;
      el.dataset.osObserved = '1';
      el.classList.add('os-will-reveal');
      io.observe(el);
    });
  };
  scan(document);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n instanceof HTMLElement) scan(n.parentNode ?? n); });
  }).observe(document.body, { childList: true, subtree: true });
}

function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot = document.createElement('div');
  dot.className = 'os-cursor';
  document.body.appendChild(dot);
  let x = -100, y = -100, cx = -100, cy = -100;
  window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  window.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement | null;
    dot.classList.toggle('is-hover', !!t?.closest('a,button,[role="button"],input,select,textarea,.dash-card,tr'));
  }, { passive: true });
  const tick = () => {
    cx += (x - cx) * 0.18; cy += (y - cy) * 0.18;
    dot.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  tick();
}

export function initOsmontMotion() {
  const start = () => { initReveal(); initCursor(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}

// Safety net: never leave content hidden if an observer misses it.
window.setInterval(() => {
  document.querySelectorAll('.os-will-reveal:not(.is-in)').forEach((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
  });
}, 1200);
