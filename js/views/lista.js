// Lista prospect: ricerca, filtri e creazione di un nuovo prospect.
import { h, pageHeader } from '../dom.js';
import { formatDate, todayISO } from '../format.js';
import { STATI, statoBadge, callButton, skeleton, errorBox, normalize } from '../ui.js';
import { getTagSito, getOrigini, getProfili } from '../lookups.js';

const FILTRI_KEY = 'zenith-lista-filtri';
const FILTRI_VUOTI = { q: '', stato: '', citta: '', settore: '', tag: '', origine: '', assegnato: '' };
const CHIUSI = new Set(['vinto', 'perso']);
const COLONNE = 'id, nome_attivita, citta, settore, telefono, stato, prossima_azione, prossima_azione_data, assegnato_a, origine_id, prospect_tag(tag_id)';

export default async function lista(main, { sb, state }) {
  let rows = [];
  let lookups = { tag: [], origini: [], profili: [] };
  let filtri = readFiltri();

  // ---------- struttura ----------
  const countText = h('p', { class: 'page-sub tabular' }, ' ');
  const nuovoBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: true }, plusIcon(), 'Nuovo prospect');

  const search = h('input', {
    type: 'search', id: 'lista-q', placeholder: 'Cerca per nome attività',
    autocomplete: 'off', enterkeyhint: 'search',
  });
  search.value = filtri.q;

  const filtriBtn = h('button', {
    type: 'button', class: 'btn btn-secondary filter-toggle',
    'aria-expanded': 'false', 'aria-controls': 'lista-filtri',
  });
  const azzeraBtn = h('button', { type: 'button', class: 'btn btn-quiet', hidden: true }, 'Azzera filtri');
  const panel = h('div', { class: 'filters', id: 'lista-filtri', hidden: true });

  const status = h('div', { class: 'list-status', role: 'status' });
  const content = h('div', { class: 'list-content' });

  main.append(
    h('div', { class: 'page-head-row' },
      h('header', { class: 'page-header' }, h('h1', { class: 'page-title' }, 'Prospect'), countText),
      nuovoBtn),
    h('div', { class: 'search-row' },
      h('label', { class: 'visually-hidden', for: 'lista-q' }, 'Cerca per nome attività'),
      search,
      filtriBtn),
    panel,
    h('div', { class: 'filter-summary' }, azzeraBtn),
    status,
    content,
  );

  const desktop = window.matchMedia('(min-width: 900px)').matches;
  setPanelOpen(desktop || activeCount() > 0);

  // ---------- eventi ----------
  search.addEventListener('input', () => { filtri.q = search.value; saveAndRender(); });
  filtriBtn.addEventListener('click', () => setPanelOpen(panel.hidden));
  azzeraBtn.addEventListener('click', () => {
    filtri = { ...FILTRI_VUOTI, q: filtri.q };
    for (const sel of panel.querySelectorAll('select')) sel.value = '';
    saveAndRender();
  });
  nuovoBtn.addEventListener('click', () => openNuovo());

  function setPanelOpen(open) {
    panel.hidden = !open;
    filtriBtn.setAttribute('aria-expanded', String(open));
    updateFiltriBtn();
  }

  function updateFiltriBtn() {
    const n = activeCount();
    filtriBtn.replaceChildren(filterIcon(), n ? `Filtri (${n})` : 'Filtri');
    azzeraBtn.hidden = n === 0;
  }

  function activeCount() {
    return ['stato', 'citta', 'settore', 'tag', 'origine', 'assegnato'].filter((k) => filtri[k]).length;
  }

  function saveAndRender() {
    writeFiltri(filtri);
    updateFiltriBtn();
    renderList();
  }

  // ---------- caricamento ----------
  async function load() {
    content.replaceChildren(skeleton(6));
    content.setAttribute('aria-busy', 'true');
    try {
      const [res, tag, origini, profili] = await Promise.all([
        sb.from('prospects').select(COLONNE).order('nome_attivita', { ascending: true }),
        getTagSito(), getOrigini(), getProfili(),
      ]);
      if (res.error) throw res.error;
      rows = res.data.sort(byNome);
      lookups = { tag, origini, profili };
    } catch {
      content.removeAttribute('aria-busy');
      if (content.isConnected) content.replaceChildren(errorBox(load));
      return;
    }
    content.removeAttribute('aria-busy');
    if (!content.isConnected) return;
    buildFilters();
    nuovoBtn.disabled = false;
    renderList();
  }

  // ---------- filtri ----------
  function buildFilters() {
    const distinct = (key) => [...new Set(rows.map((r) => r[key]?.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'it'));

    const assegnati = [
      ...lookups.profili.map((p) => ({ id: p.id, nome: p.id === state.user.id ? `${p.nome || 'Io'} (io)` : (p.nome || 'Senza nome') })),
      { id: 'none', nome: 'Non assegnato' },
    ];

    const defs = [
      ['stato', 'Stato', STATI.map((s) => [s.id, s.nome])],
      ['citta', 'Città', distinct('citta').map((c) => [c, c])],
      ['settore', 'Settore', distinct('settore').map((c) => [c, c])],
      ['tag', 'Problema del sito', lookups.tag.map((t) => [String(t.id), t.nome])],
      ['origine', 'Origine', lookups.origini.map((o) => [String(o.id), o.nome])],
      ['assegnato', 'Assegnato a', assegnati.map((a) => [a.id, a.nome])],
    ];

    panel.replaceChildren(...defs.map(([key, label, options]) => {
      const id = `f-${key}`;
      // Se un valore salvato non esiste più (es. città rinominata), lo azzera
      if (filtri[key] && !options.some(([v]) => v === filtri[key])) filtri[key] = '';
      const select = h('select', { id },
        h('option', { value: '' }, 'Tutti'),
        options.map(([v, t]) => h('option', { value: v }, t)));
      select.value = filtri[key];
      select.addEventListener('change', () => { filtri[key] = select.value; saveAndRender(); });
      return h('div', { class: 'field' }, h('label', { for: id }, label), select);
    }));
    updateFiltriBtn();
  }

  function matches(r) {
    const q = normalize(filtri.q);
    if (q && !normalize(r.nome_attivita).includes(q)) return false;
    if (filtri.stato && r.stato !== filtri.stato) return false;
    if (filtri.citta && r.citta?.trim() !== filtri.citta) return false;
    if (filtri.settore && r.settore?.trim() !== filtri.settore) return false;
    if (filtri.tag && !r.prospect_tag?.some((t) => String(t.tag_id) === filtri.tag)) return false;
    if (filtri.origine && String(r.origine_id) !== filtri.origine) return false;
    if (filtri.assegnato === 'none' && r.assegnato_a) return false;
    if (filtri.assegnato && filtri.assegnato !== 'none' && r.assegnato_a !== filtri.assegnato) return false;
    return true;
  }

  // ---------- elenco ----------
  function renderList() {
    if (!content.isConnected || content.getAttribute('aria-busy')) return;
    const visible = rows.filter(matches);
    const filtered = filtri.q || activeCount();
    countText.textContent = filtered
      ? `${visible.length} di ${rows.length} prospect`
      : `${rows.length} prospect`;

    if (!rows.length) {
      content.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Ancora nessun prospect.'),
        h('p', {}, 'Aggiungi il primo: bastano nome e telefono.'),
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => openNuovo() }, 'Nuovo prospect')));
      return;
    }
    if (!visible.length) {
      content.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Nessun prospect corrisponde.'),
        h('p', {}, 'Prova a cambiare la ricerca o i filtri.'),
        h('button', {
          type: 'button', class: 'btn btn-secondary',
          onclick: () => {
            filtri = { ...FILTRI_VUOTI };
            search.value = '';
            for (const sel of panel.querySelectorAll('select')) sel.value = '';
            saveAndRender();
          },
        }, 'Azzera ricerca e filtri')));
      return;
    }

    const today = todayISO();
    content.replaceChildren(h('ul', { class: 'rows', role: 'list' }, visible.map((r) => listRow(r, today))));
  }

  // ---------- nuovo prospect ----------
  function openNuovo() {
    const dialog = nuovoDialog({
      sb, state, origini: lookups.origini, rows,
      onCreated: (p) => {
        rows = [...rows, p].sort(byNome);
        buildFilters();
        renderList();
        status.replaceChildren(h('p', { class: 'notice' },
          `Creato ${p.nome_attivita}. `,
          h('a', { href: `#/prospect/${p.id}` }, 'Apri la scheda')));
      },
    });
    main.append(dialog);
    dialog.showModal();
  }

  load();

  return {
    title: 'Prospect',
    cleanup: () => main.querySelector('dialog[open]')?.close(),
  };
}

// Ordine alfabetico italiano, con i numeri in ordine naturale (2 prima di 10)
const byNome = (a, b) => a.nome_attivita.localeCompare(b.nome_attivita, 'it', { numeric: true, sensitivity: 'base' });

// ---------- riga ----------

function listRow(r, today) {
  const late = r.prossima_azione_data && r.prossima_azione_data < today && !CHIUSI.has(r.stato);
  const luogo = [r.citta, r.settore].filter((x) => x?.trim()).join(', ');
  const azione = r.prossima_azione?.trim();

  return h('li', { class: `row${late ? ' row-late' : ''}` },
    h('a', { class: 'row-main', href: `#/prospect/${r.id}` },
      h('span', { class: 'row-name' }, r.nome_attivita),
      h('span', { class: 'row-meta' }, statoBadge(r.stato), luogo ? h('span', { class: 'row-place' }, luogo) : null),
      h('span', { class: 'row-action' },
        azione ? h('span', { class: 'row-action-text' }, azione) : null,
        r.prossima_azione_data
          ? h('span', { class: `tabular ${late ? 'row-late-date' : 'row-date'}` },
              late ? `dal ${formatDate(r.prossima_azione_data)}` : formatDate(r.prossima_azione_data))
          : null),
    ),
    callButton(r),
  );
}

// ---------- dialog Nuovo prospect ----------

function nuovoDialog({ sb, state, origini, rows, onCreated }) {
  const opener = document.activeElement;
  const distinct = (key) => [...new Set(rows.map((r) => r[key]?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'it'));

  const nome = h('input', { id: 'np-nome', name: 'nome', required: true, autocomplete: 'off', 'aria-describedby': 'np-nome-hint np-error' });
  const nomeHint = h('p', { class: 'field-hint', id: 'np-nome-hint', hidden: true });
  const telefono = h('input', { id: 'np-tel', name: 'telefono', type: 'tel', inputmode: 'tel', autocomplete: 'off' });
  const citta = h('input', { id: 'np-citta', name: 'citta', list: 'np-citta-list', autocomplete: 'off' });
  const settore = h('input', { id: 'np-settore', name: 'settore', list: 'np-settore-list', autocomplete: 'off' });
  const origine = h('select', { id: 'np-origine', name: 'origine' },
    h('option', { value: '' }, 'Non indicata'),
    origini.map((o) => h('option', { value: String(o.id) }, o.nome)));
  const error = h('p', { class: 'form-error', id: 'np-error', role: 'alert', hidden: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Crea prospect');
  const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');

  const field = (id, label, input, extra) =>
    h('div', { class: 'field' }, h('label', { for: id }, label), input, extra);

  const form = h('form', { class: 'form', novalidate: true },
    field('np-nome', 'Nome attività', nome, nomeHint),
    field('np-tel', 'Telefono', telefono),
    h('div', { class: 'form-2col' },
      field('np-citta', 'Città', citta),
      field('np-settore', 'Settore', settore)),
    field('np-origine', 'Origine', origine),
    h('datalist', { id: 'np-citta-list' }, distinct('citta').map((c) => h('option', { value: c }))),
    h('datalist', { id: 'np-settore-list' }, distinct('settore').map((c) => h('option', { value: c }))),
    h('p', { class: 'form-note' }, 'Parte come Da chiamare, assegnato a te.'),
    error,
    h('div', { class: 'dialog-actions' }, cancel, submit),
  );

  const dialog = h('dialog', { class: 'sheet', 'aria-labelledby': 'np-title' },
    h('h2', { class: 'sheet-title', id: 'np-title' }, 'Nuovo prospect'),
    form);

  // Avviso (non bloccante) se esiste già un prospect con lo stesso nome
  const esistenti = new Set(rows.map((r) => normalize(r.nome_attivita)));
  nome.addEventListener('input', () => {
    nome.removeAttribute('aria-invalid');
    const dup = esistenti.has(normalize(nome.value));
    nomeHint.hidden = !dup;
    nomeHint.textContent = dup ? 'Esiste già un prospect con questo nome.' : '';
  });

  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener?.isConnected) opener.focus();
  });
  // Tocco sullo sfondo chiude
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const nomeVal = nome.value.trim();
    if (!nomeVal) {
      nome.setAttribute('aria-invalid', 'true');
      error.textContent = 'Scrivi il nome dell’attività.';
      error.hidden = false;
      nome.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creazione…';
    const clean = (v) => v.trim() || null;
    const { data, error: err } = await sb
      .from('prospects')
      .insert({
        nome_attivita: nomeVal,
        telefono: clean(telefono.value),
        citta: clean(citta.value),
        settore: clean(settore.value),
        origine_id: origine.value ? Number(origine.value) : null,
        stato: 'da_chiamare',
        assegnato_a: state.user.id,
      })
      .select(COLONNE)
      .single();
    submit.disabled = false;
    submit.textContent = 'Crea prospect';

    if (err) {
      error.textContent = 'Non sono riuscito a creare il prospect. Controlla la connessione e riprova.';
      error.hidden = false;
      return;
    }
    dialog.close();
    onCreated(data);
  });

  // Il focus va al nome appena il dialog si apre
  queueMicrotask(() => nome.focus());
  return dialog;
}

// ---------- icone ----------

function svgIcon(d, size = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
const plusIcon = () => svgIcon('M12 5v14M5 12h14');
const filterIcon = () => svgIcon('M4 6h16M7 12h10M10 18h4');

// ---------- memoria filtri (solo per la sessione del browser) ----------

function readFiltri() {
  try {
    return { ...FILTRI_VUOTI, ...JSON.parse(sessionStorage.getItem(FILTRI_KEY) || '{}') };
  } catch {
    return { ...FILTRI_VUOTI };
  }
}

function writeFiltri(f) {
  try { sessionStorage.setItem(FILTRI_KEY, JSON.stringify(f)); } catch { /* ignora */ }
}
