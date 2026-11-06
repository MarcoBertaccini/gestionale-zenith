// Piccoli aiuti per costruire il DOM senza innerHTML con dati utente.

/** h('p', { class: 'x' }, 'testo', figlio) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Intestazione standard di pagina: h1 + sottotitolo facoltativo. */
export function pageHeader(title, sub) {
  return h('header', { class: 'page-header' },
    h('h1', { class: 'page-title' }, title),
    sub ? h('p', { class: 'page-sub' }, sub) : null,
  );
}
