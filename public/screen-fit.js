/* Screen-fit layout + ↑/↓ paging (principles 1, 2).
   Reference implementation: sound-bites-html5/js/app.js.

   Markup:
     <header class="topbar">…</header>            sticky app bar
     <main id="home">
       <section class="group" data-solo>…</section>   hero: always its own screen
       <section class="group">…</section>
       …
     </main>
   Pair with no-bounce.css (body is the scroller) and groups.css.

   Usage:
     import { initScreenFit } from './screen-fit.js';
     const fit = initScreenFit();               // defaults below
     fit.relayout();                            // e.g. after showing #home again
*/

export function initScreenFit({
  scroller = document.body,          // the element that scrolls (see no-bounce.css)
  bar = '.topbar',                   // sticky app bar
  container = '#home',               // holds the .group sections
  group = '.group',
  ignoreKeysIn = 'input, textarea, select, [role="radiogroup"], [role="slider"], [contenteditable]',
} = {}) {
  const topbar = document.querySelector(bar);
  const root = document.querySelector(container);
  const barHeight = () => (topbar ? topbar.offsetHeight : 0);

  // --bar-h feeds scroll-margin-top and calc(100dvh - var(--bar-h)) in CSS.
  if (topbar) {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--bar-h', `${barHeight()}px`);
    }).observe(topbar);
  }

  /* Pack groups into screens: consecutive groups share a screen while their
     natural heights fit under the app bar. Leftover height is shared out
     evenly so each screen fills the view exactly. A group taller than the
     view gets a screen to itself. [data-solo] groups always stand alone. */
  function layout() {
    if (!root || root.hidden) return;
    const groups = [...root.querySelectorAll(group)];
    const avail = scroller.clientHeight - barHeight();
    for (const g of groups) g.style.minHeight = '';
    const heights = groups.map((g) => g.getBoundingClientRect().height);

    const screens = [];
    let cur = null;
    groups.forEach((g, i) => {
      const solo = g.hasAttribute('data-solo') || cur?.solo;
      if (cur && !solo && cur.sum + heights[i] <= avail + 1) {
        cur.items.push(i);
        cur.sum += heights[i];
      } else {
        cur = { items: [i], sum: heights[i], solo: g.hasAttribute('data-solo') };
        screens.push(cur);
      }
    });

    for (const sc of screens) {
      const extra = Math.max(0, avail - sc.sum) / sc.items.length;
      sc.items.forEach((i, k) => {
        groups[i].style.minHeight = `${heights[i] + extra}px`;
        groups[i].classList.toggle('screen', k === 0);
      });
    }
  }

  let raf = 0;
  const relayout = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(layout);
  };
  new ResizeObserver(relayout).observe(scroller);
  document.fonts?.ready.then(relayout);
  window.addEventListener('load', relayout);

  /* ↑/↓: to the next/previous .screen start, or one screen height inside a
     group taller than the view. */
  let target = null; // where an in-flight smooth scroll is heading
  scroller.addEventListener('scrollend', () => { target = null; });

  const stops = () => [...(root?.querySelectorAll('.screen') ?? [])].map((s) =>
    Math.round(s.getBoundingClientRect().top + scroller.scrollTop - barHeight()));

  function pageBy(dir) {
    const pos = target ?? scroller.scrollTop;
    const step = scroller.clientHeight - barHeight();
    const max = scroller.scrollHeight - scroller.clientHeight;
    const s = stops();
    let dest;
    if (dir > 0) {
      const next = s.find((t) => t > pos + 4) ?? max;
      dest = Math.min(next, pos + step);
    } else {
      const prev = s.filter((t) => t < pos - 4).pop() ?? 0;
      dest = Math.max(prev, pos - step);
    }
    dest = Math.min(Math.max(dest, 0), max);
    if (dest === Math.round(pos)) return;
    target = dest;
    scroller.scrollTo({ top: dest, behavior: 'smooth' });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (root?.hidden) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest(ignoreKeysIn)) return;
    e.preventDefault();
    pageBy(e.key === 'ArrowDown' ? 1 : -1);
  });

  return { relayout, pageBy };
}
