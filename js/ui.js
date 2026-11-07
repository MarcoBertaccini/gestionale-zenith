// Pezzi di interfaccia condivisi tra le schermate.
import { h } from './dom.js';

/** Stati della pipeline (vincolo CHECK su prospects.stato, non una tabella). */
export const STATI = [
  { id: 'da_chiamare', nome: 'Da chiamare' },
  { id: 'non_risponde', nome: 'Non risponde' },
  { id: 'interessato', nome: 'Interessato' },
  { id: 'demo_inviata', nome: 'Demo inviata' },
  { id: 'trattativa', nome: 'Trattativa' },
  { id: 'vinto', nome: 'Vinto' },
  { id: 'perso', nome: 'Perso' },
];
const STATO_NOME = Object.fromEntries(STATI.map((s) => [s.id, s.nome]));
export const statoNome = (id) => STATO_NOME[id] ?? id;

export function statoBadge(id) {
  return h('span', { class: `badge badge-${id}` }, statoNome(id));
}

/** "0544 123 456" → "tel:0544123456". Null se non c'è un numero utilizzabile. */
export function telHref(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^00/, '+').replace(/(?!^\+)[^\d]/g, '');
  return cleaned.replace(/\D/g, '').length >= 5 ? `tel:${cleaned}` : null;
}

/** Bottone Chiama (tel:) o "Senza numero". */
export function callButton(p) {
  const tel = telHref(p.telefono);
  return tel
    ? h('a', { class: 'call', href: tel, 'aria-label': `Chiama ${p.nome_attivita}` }, phoneIcon(), h('span', {}, 'Chiama'))
    : h('span', { class: 'call call-none' }, 'Senza numero');
}

export function phoneIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z');
  svg.append(path);
  return svg;
}

/** Righe grigie durante il caricamento. */
export function skeleton(rows = 4) {
  return h('div', { class: 'skeleton', 'aria-hidden': 'true' },
    Array.from({ length: rows }, () => h('div', { class: 'skeleton-row' },
      h('div', { class: 'skeleton-lines' }, h('span'), h('span'), h('span')),
      h('div', { class: 'skeleton-call' }),
    )),
  );
}

export function errorBox(retry, what = 'i prospect') {
  return h('div', { class: 'empty empty-error', role: 'alert' },
    h('p', { class: 'empty-title' }, `Non riesco a caricare ${what}.`),
    h('p', {}, 'Controlla la connessione e riprova.'),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: retry }, 'Riprova'),
  );
}

/** Confronto testo senza maiuscole né accenti. */
export function normalize(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Dialog modale (foglio dal basso sul telefono). Esc, Annulla e tocco sullo
 * sfondo chiudono; alla chiusura il dialog si rimuove e il focus torna dove era.
 */
export function openSheet(title, body, { labelId = `sheet-${Math.random().toString(36).slice(2, 8)}`, initialFocus } = {}) {
  const opener = document.activeElement;
  const dialog = h('dialog', { class: 'sheet', 'aria-labelledby': labelId },
    h('h2', { class: 'sheet-title', id: labelId }, title),
    body);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener?.isConnected) opener.focus();
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  (document.getElementById('main') ?? document.body).append(dialog);
  dialog.showModal();
  if (initialFocus) initialFocus.focus();
  return dialog;
}

/** Campo con etichetta: field('id', 'Etichetta', input, ...extra) */
export function field(id, label, input, ...extra) {
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, ...extra);
}

// Messaggio da mostrare alla schermata successiva (es. dopo un'eliminazione)
let flash = null;
export const setFlash = (msg) => { flash = msg; };
export const takeFlash = () => { const f = flash; flash = null; return f; };
