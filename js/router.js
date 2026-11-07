// Router a hash (#/oggi, #/lista, #/prospect/<id>): funziona su GitHub Pages senza server.

const routes = [];
let ctxRef = null;
let firstRender = true;
let cleanup = null;   // funzione di pulizia della schermata corrente
let renderSeq = 0;    // scarta i render superati da un cambio pagina più recente

export function route(pattern, nav, view) {
  routes.push({ pattern, nav, view });
}

export const DEFAULT_PATH = '/oggi';

export function currentPath() {
  return location.hash.replace(/^#/, '') || DEFAULT_PATH;
}

export function navigate(path) {
  if (currentPath() === path) render();
  else location.hash = path;
}

export function startRouter(ctx) {
  ctxRef = ctx;
  firstRender = true;
  window.addEventListener('hashchange', render);
  render();
}

export function stopRouter() {
  window.removeEventListener('hashchange', render);
  runCleanup();
  ctxRef = null;
}

function runCleanup() {
  if (cleanup) {
    try { cleanup(); } catch { /* ignora */ }
    cleanup = null;
  }
}

async function render() {
  if (!ctxRef) return;
  const path = currentPath();
  const match = routes
    .map((r) => ({ r, m: r.pattern.exec(path) }))
    .find((x) => x.m);

  if (!match) {
    location.replace(`#${DEFAULT_PATH}`);
    return;
  }

  const { r, m } = match;
  const main = document.getElementById('main');

  // Nav attiva
  for (const a of document.querySelectorAll('.tabs a')) {
    if (a.dataset.nav === r.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  runCleanup();
  const seq = ++renderSeq;
  main.replaceChildren();
  main.setAttribute('aria-busy', 'true');
  try {
    // Una schermata restituisce il titolo, oppure { title, cleanup }
    const result = await r.view(main, { ...ctxRef, params: m.slice(1) });
    const title = typeof result === 'string' ? result : result?.title;
    if (seq !== renderSeq) { result?.cleanup?.(); return; }
    cleanup = result?.cleanup ?? null;
    document.title = title ? `${title} – Gestionale Zenith` : 'Gestionale Zenith';
  } finally {
    if (seq === renderSeq) main.removeAttribute('aria-busy');
  }

  // Dopo un cambio pagina il focus va al contenuto (per lettori di schermo e tastiera)
  if (!firstRender) main.focus({ preventScroll: true });
  firstRender = false;
  window.scrollTo(0, 0);
}
