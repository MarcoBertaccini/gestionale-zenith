// Router a hash (#/oggi, #/lista, #/prospect/<id>): funziona su GitHub Pages senza server.

const routes = [];
let ctxRef = null;
let firstRender = true;

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
  ctxRef = null;
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

  main.replaceChildren();
  main.setAttribute('aria-busy', 'true');
  try {
    const title = await r.view(main, { ...ctxRef, params: m.slice(1) });
    document.title = title ? `${title} – Gestionale Zenith` : 'Gestionale Zenith';
  } finally {
    main.removeAttribute('aria-busy');
  }

  // Dopo un cambio pagina il focus va al contenuto (per lettori di schermo e tastiera)
  if (!firstRender) main.focus({ preventScroll: true });
  firstRender = false;
  window.scrollTo(0, 0);
}
