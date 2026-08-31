// Front-end: initialise StPageFlip, lazy-load photos a spread ahead,
// and keep the whole thing usable with a keyboard.
// The book markup is already in the DOM — this only animates it.

import { PageFlip } from './page-flip.module.js';

const bookEl = document.getElementById('book');
const stage = document.getElementById('stage');
const curtain = document.getElementById('curtain');
const openBtn = document.getElementById('openBtn');
const controls = document.getElementById('controls');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const folio = document.getElementById('folio');
const hint = document.getElementById('hint');

const pages = [...bookEl.querySelectorAll('.page')];

const LEAF_RATIO = 0.72;      // width / height of one page
const CHROME_H = 136;        // room reserved for the controls pill at the bottom

/**
 * Geometry has to be computed, not stretched. StPageFlip's 'stretch' mode sizes
 * to the parent, and the parent here is a centring grid cell with no intrinsic
 * size — which lets the book grow past the viewport and clip the cover.
 * So: measure the space, derive one leaf from it, and pin the size exactly.
 */
function leafSize() {
  const single = window.matchMedia('(max-width: 900px)').matches;
  const availW = Math.max(240, stage.clientWidth - 24);
  const availH = Math.max(320, stage.clientHeight - CHROME_H);

  const widthFromHeight = availH * LEAF_RATIO;
  const widthFromWidth = single ? availW : availW / 2;

  const width = Math.floor(Math.max(240, Math.min(widthFromHeight, widthFromWidth)));
  return { width, height: Math.floor(width / LEAF_RATIO), single };
}

function makeFlip() {
  const { width, height, single } = leafSize();

  // With autoSize off, StPageFlip reads the container's width to decide whether
  // there's room for two leaves: it goes portrait unless the block is at least
  // two pages wide. So the container has to be sized for the spread we want.
  bookEl.style.width = `${single ? width : width * 2}px`;
  bookEl.style.height = `${height}px`;

  const f = new PageFlip(bookEl, {
    width,
    height,
    size: 'fixed',
    // autoSize defaults to true, which slaps width:100% on the container and
    // overrides the fixed geometry entirely — the book then grows past the
    // viewport and clips its own cover. It must be off.
    autoSize: false,
    maxShadowOpacity: 0.5,
    showCover: true,
    usePortrait: true,        // single leaf when there isn't room for two
    mobileScrollSupport: false,
    flippingTime: 780,
    drawShadow: true,
    swipeDistance: 24,
  });
  f.loadFromHTML(pages);
  return f;
}

let flip = makeFlip();

// ---------- Lazy loading ----------
// Load the current spread plus two ahead and one behind. Photos are <img>
// with data-src; the LQIP is already painted as a CSS background underneath,
// so a page that turns before its photo arrives still looks intentional.

function loadNear(index) {
  const from = Math.max(0, index - 2);
  const to = Math.min(pages.length - 1, index + 4);
  for (let i = from; i <= to; i++) {
    for (const img of pages[i].querySelectorAll('img[data-src]')) {
      const picture = img.closest('picture');
      if (picture) {
        for (const s of picture.querySelectorAll('source[data-srcset]')) {
          s.srcset = s.dataset.srcset;
          delete s.dataset.srcset;
        }
      }
      img.src = img.dataset.src;
      delete img.dataset.src;
      if (img.complete) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    }
  }
}

function updateChrome() {
  const i = flip.getCurrentPageIndex();
  const total = flip.getPageCount();
  folio.textContent = `${Math.min(i + 1, total)} / ${total}`;
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i >= total - 1;
  loadNear(i);
}

function bindFlipEvents(f) {
  f.on('flip', () => {
    updateChrome();
    hint.classList.add('gone');
  });
  f.on('changeState', (e) => {
    if (e.data === 'read') updateChrome();
  });
}
bindFlipEvents(flip);

prevBtn.addEventListener('click', () => flip.flipPrev());
nextBtn.addEventListener('click', () => flip.flipNext());

document.addEventListener('keydown', (e) => {
  if (!curtain.classList.contains('gone')) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); flip.flipNext(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flip.flipPrev(); }
  if (e.key === 'Home') { e.preventDefault(); flip.flip(0); }
  if (e.key === 'End') { e.preventDefault(); flip.flip(flip.getPageCount() - 1); }
});

// A fixed-size book can't reflow itself, so rebuild at the new geometry and
// put the reader back on the page they were on.
let resizeTimer;
let lastSize = JSON.stringify(leafSize());
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = JSON.stringify(leafSize());
    if (next === lastSize) return;
    lastSize = next;
    const at = flip.getCurrentPageIndex();
    try { flip.destroy(); } catch {}
    bookEl.innerHTML = '';
    for (const p of pages) bookEl.appendChild(p);
    flip = makeFlip();
    bindFlipEvents(flip);
    flip.turnToPage(Math.min(at, flip.getPageCount() - 1));
    updateChrome();
  }, 240);
});

function open() {
  curtain.classList.add('gone');
  controls.classList.add('ready');
  loadNear(0);
  updateChrome();
  setTimeout(() => hint.classList.add('gone'), 9000);
}

openBtn.addEventListener('click', open);

// Preload the first couple of pages behind the curtain so the opening is instant.
loadNear(0);
updateChrome();
