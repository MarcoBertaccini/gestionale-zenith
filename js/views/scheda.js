// Scheda prospect: dati modificabili per gruppi, storico, azioni.
import { h } from '../dom.js';
import { formatDate, formatDateTime, todayISO } from '../format.js';
import { STATI, statoBadge, statoNome, errorBox, phoneIcon, telHref, openSheet, setFlash } from '../ui.js';
import { getEsiti, getMotiviPerso, getOrigini, getTagSito, getProfili } from '../lookups.js';
import { registraChiamata, segnaDemoInviata, aggiungiNota } from './scheda-azioni.js';

const COLONNE = '*, prospect_tag(tag_id)';
const CHIUSI = new Set(['vinto', 'perso']);
// "Per la demo" visibile da Interessato in poi
const STATI_DEMO = new Set(['interessato', 'demo_inviata', 'trattativa', 'vinto']);
const CAMPI_DEMO = ['servizi', 'distintivi', 'obiettivo_sito', 'tono', 'sito_riferimento', 'logo_colori', 'foto', 'slug_demo', 'link_demo'];

// Gruppi del Modello dati (spec). [colonna, etichetta, tipo]
const GRUPPI = [
  { id: 'anagrafica', titolo: 'Anagrafica', campi: [
    ['nome_attivita', 'Nome attività', 'text'],
    ['referente', 'Referente', 'text'],
    ['telefono', 'Telefono', 'tel'],
    ['email', 'Email', 'email'],
    ['sito', 'Sito attuale', 'url'],
    ['citta', 'Città', 'text'],
    ['settore', 'Settore', 'text'],
  ] },
  { id: 'vendita', titolo: 'Vendita', campi: [
    ['stato', 'Stato', 'stato'],
    ['prossima_azione', 'Prossima azione', 'text'],
    ['prossima_azione_data', 'Data prossima azione', 'date'],
    ['assegnato_a', 'Assegnato a', 'profilo'],
    ['motivo_perso_id', 'Motivo perso', 'motivo'],
    ['prezzo_proposto', 'Prezzo proposto (€)', 'number'],
    ['tentativi_senza_risposta', 'Tentativi senza risposta', 'readonly'],
  ] },
  { id: 'origine', titolo: 'Origine', campi: [
    ['origine_id', 'Origine', 'origine'],
    ['lead_id', 'Richiesta dal sito', 'lead'],
  ] },
  { id: 'analisi', titolo: 'Analisi sito', campi: [
    ['tags', 'Problemi del sito', 'tags'],
    ['note_sito', 'Note sul sito', 'textarea'],
  ] },
  { id: 'demo', titolo: 'Per la demo', campi: [
    ['servizi', 'Servizi', 'textarea'],
    ['distintivi', 'Cosa li distingue', 'textarea'],
    ['obiettivo_sito', 'Obiettivo del sito', 'textarea'],
    ['tono', 'Tono', 'text'],
    ['sito_riferimento', 'Sito di riferimento per lo stile', 'url'],
    ['logo_colori', 'Logo e colori', 'textarea'],
    ['foto', 'Foto', 'textarea'],
    ['slug_demo', 'Slug della demo', 'text'],
    ['link_demo', 'Link della demo', 'url'],
  ] },
];

export default async function scheda(main, { sb, params }) {
  const id = params[0];
  let prospect = null;
  let interazioni = [];
  let lk = null; // valori fissi
  let openGroups = new Set(['anagrafica', 'vendita']);
  let dirty = false;

  const root = h('div', { class: 'scheda' });
  main.append(root);

  // Avviso se si esce dalla pagina con modifiche non salvate
  const onBeforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);

  async function fetchAll() {
    const [p, i, esiti, motivi, origini, tag, profili] = await Promise.all([
      sb.from('prospects').select(COLONNE).eq('id', id).maybeSingle(),
      sb.from('interazioni').select('id, created_at, autore_id, tipo, esito_id, testo')
        .eq('prospect_id', id).order('created_at', { ascending: false }),
      getEsiti(), getMotiviPerso(), getOrigini(), getTagSito(), getProfili(),
    ]);
    if (p.error) throw p.error;
    if (i.error) throw i.error;
    prospect = p.data;
    interazioni = i.data;
    lk = { esiti, motivi, origini, tag, profili };
  }

  async function load(notice) {
    if (!prospect) root.replaceChildren(h('p', { class: 'loading-text', role: 'status' }, 'Caricamento…'));
    root.setAttribute('aria-busy', 'true');
    try {
      await fetchAll();
    } catch {
      root.removeAttribute('aria-busy');
      if (root.isConnected) root.replaceChildren(backLink(), errorBox(() => load(notice), 'la scheda'));
      return;
    }
    root.removeAttribute('aria-busy');
    if (!root.isConnected) return;
    if (!prospect) {
      root.replaceChildren(backLink(), h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Prospect non trovato.'),
        h('p', {}, 'Potrebbe essere stato cancellato.'),
        h('a', { class: 'btn btn-secondary', href: '#/lista' }, 'Torna alla lista')));
      document.title = 'Prospect non trovato – Gestionale Zenith';
      return;
    }
    render(notice);
  }

  // ---------- disegno della pagina ----------
  function render(notice) {
    dirty = false;
    const scrollY = window.scrollY;
    document.title = `${prospect.nome_attivita} – Gestionale Zenith`;

    const today = todayISO();
    const late = prospect.prossima_azione_data && prospect.prossima_azione_data < today && !CHIUSI.has(prospect.stato);
    const luogo = [prospect.citta, prospect.settore].filter((x) => x?.trim()).join(', ');

    // Intestazione
    const head = h('header', { class: 'scheda-head' },
      h('h1', { class: 'page-title' }, prospect.nome_attivita),
      h('p', { class: 'row-meta' }, statoBadge(prospect.stato), luogo ? h('span', { class: 'row-place' }, luogo) : null));

    const status = h('div', { class: 'list-status', role: 'status' },
      notice ? h('p', { class: `notice${notice.warn ? ' notice-warn' : ''}` }, notice.text) : null);

    // Prossima azione
    const next = h('section', { class: `next-card${late ? ' next-late' : ''}`, 'aria-labelledby': 'next-title' },
      h('h2', { class: 'card-label', id: 'next-title' }, 'Prossima azione'),
      prospect.prossima_azione || prospect.prossima_azione_data
        ? h('p', { class: 'next-text' },
            h('span', {}, prospect.prossima_azione || 'Azione non indicata'),
            prospect.prossima_azione_data
              ? h('span', { class: 'next-date tabular' },
                  late ? `in ritardo, era per il ${formatDate(prospect.prossima_azione_data)}` : formatDate(prospect.prossima_azione_data))
              : null)
        : h('p', { class: 'next-text next-none' }, CHIUSI.has(prospect.stato) ? `Chiuso: ${statoNome(prospect.stato)}` : 'Nessuna azione in programma'),
      prospect.stato === 'interessato'
        ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: onDemoInviata }, 'Segna demo inviata')
        : null);

    // Barra azioni (fissa in basso sul telefono, raggiungibile col pollice)
    const tel = telHref(prospect.telefono);
    const actionBar = h('div', { class: 'action-bar' },
      tel
        ? h('a', { class: 'btn btn-secondary action-call', href: tel, 'aria-label': `Chiama ${prospect.nome_attivita}` }, phoneIcon(), h('span', {}, 'Chiama'))
        : h('span', { class: 'btn btn-secondary action-call is-disabled', 'aria-disabled': 'true' }, 'Senza numero'),
      h('button', { type: 'button', class: 'btn btn-primary action-main', onclick: onRegistraChiamata }, 'Registra chiamata'));

    // Storico
    const storico = h('section', { class: 'storico', 'aria-labelledby': 'storico-title' },
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title', id: 'storico-title' }, 'Storico'),
        h('button', { type: 'button', class: 'btn btn-quiet btn-accent', onclick: onNota }, 'Aggiungi nota')),
      interazioni.length
        ? h('ol', { class: 'timeline', role: 'list' }, interazioni.map(eventItem))
        : h('p', { class: 'group-empty' }, 'Ancora nessuna chiamata o nota.'));

    // Dati
    const form = buildForm();

    root.replaceChildren(
      backLink(),
      head,
      h('div', { class: 'scheda-grid' },
        h('div', { class: 'scheda-side' }, status, next, actionBar, storico),
        h('div', { class: 'scheda-main' }, form, dangerZone())));

    window.scrollTo(0, scrollY);
  }

  function eventItem(ev) {
    const esito = lk.esiti.find((e) => e.id === ev.esito_id);
    const autore = ev.autore_id ? (lk.profili.find((p) => p.id === ev.autore_id)?.nome || 'Utente') : 'Automatico';
    const titolo = ev.tipo === 'chiamata'
      ? `Chiamata${esito ? `: ${esito.nome}` : ''}`
      : ev.tipo === 'nota' ? 'Nota' : 'Sistema';
    return h('li', { class: `event event-${ev.tipo}` },
      h('p', { class: 'event-head' },
        h('strong', {}, titolo),
        h('span', { class: 'event-meta tabular' }, `${formatDateTime(ev.created_at)}, ${autore}`)),
      ev.testo ? h('p', { class: 'event-text' }, ev.testo) : null);
  }

  // ---------- modulo dati ----------
  function buildForm() {
    const controls = {};
    const original = {};

    const groups = GRUPPI.map((g) => {
      const fields = g.campi.map(([key, label, type]) => {
        const c = makeControl(key, label, type);
        controls[key] = c;
        original[key] = c.get();
        return c.el;
      });
      const details = h('details', { class: 'group-card', 'data-group': g.id },
        h('summary', {}, h('h2', { class: 'section-title' }, g.titolo)),
        h('div', { class: 'group-fields' }, fields));
      details.open = openGroups.has(g.id);
      details.addEventListener('toggle', () => {
        if (details.open) openGroups.add(g.id); else openGroups.delete(g.id);
      });
      return details;
    });

    const demoGroup = groups.find((d) => d.dataset.group === 'demo');
    const motivoField = controls.motivo_perso_id.el;

    const error = h('p', { class: 'form-error', id: 'scheda-error', role: 'alert', hidden: true });
    const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salva modifiche');
    const undoBtn = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');
    const saveBar = h('div', { class: 'save-bar', hidden: true },
      h('p', { class: 'save-bar-text' }, 'Modifiche non salvate'),
      h('div', { class: 'save-bar-actions' }, undoBtn, saveBtn));

    const form = h('form', { class: 'scheda-form', novalidate: true, 'aria-label': 'Dati del prospect' },
      groups, error, saveBar);

    function refreshVisibility() {
      const stato = controls.stato.get();
      const demoFilled = CAMPI_DEMO.some((k) => controls[k].get());
      demoGroup.hidden = !(STATI_DEMO.has(stato) || demoFilled);
      motivoField.hidden = !(stato === 'perso' || controls.motivo_perso_id.get());
    }

    function refreshDirty() {
      dirty = Object.keys(controls).some((k) => !same(controls[k].get(), original[k]));
      saveBar.hidden = !dirty;
      document.querySelector('.action-bar')?.toggleAttribute('hidden', dirty);
    }

    form.addEventListener('input', () => { refreshVisibility(); refreshDirty(); });
    form.addEventListener('change', () => { refreshVisibility(); refreshDirty(); });
    undoBtn.addEventListener('click', () => render());

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      error.hidden = true;
      for (const c of Object.values(controls)) c.input?.removeAttribute('aria-invalid');

      const fail = (key, msg) => {
        const c = controls[key];
        c.input?.setAttribute('aria-invalid', 'true');
        const group = c.el.closest('details');
        if (group) group.open = true;
        error.textContent = msg;
        error.hidden = false;
        c.input?.focus();
      };

      if (!controls.nome_attivita.get()) return fail('nome_attivita', 'Il nome dell’attività non può essere vuoto.');
      const email = controls.email.get();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('email', 'L’email non sembra valida.');
      const prezzo = controls.prezzo_proposto.get();
      if (prezzo != null && (Number.isNaN(prezzo) || prezzo < 0)) return fail('prezzo_proposto', 'Scrivi il prezzo come numero, ad esempio 900.');
      if (controls.stato.get() === 'perso' && !controls.motivo_perso_id.get()) return fail('motivo_perso_id', 'Per segnare un prospect come perso scegli il motivo.');

      const patch = {};
      for (const [k, c] of Object.entries(controls)) {
        if (k === 'tags' || c.readonly) continue;
        if (!same(c.get(), original[k])) patch[k] = c.get();
      }
      const tagsNow = controls.tags.get();
      const tagsBefore = original.tags;
      const added = tagsNow.filter((t) => !tagsBefore.includes(t));
      const removed = tagsBefore.filter((t) => !tagsNow.includes(t));

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvataggio…';
      try {
        if (Object.keys(patch).length) {
          const { error: e } = await sb.from('prospects').update(patch).eq('id', id);
          if (e) throw e;
        }
        if (removed.length) {
          const { error: e } = await sb.from('prospect_tag').delete().eq('prospect_id', id).in('tag_id', removed);
          if (e) throw e;
        }
        if (added.length) {
          const { error: e } = await sb.from('prospect_tag').insert(added.map((tag_id) => ({ prospect_id: id, tag_id })));
          if (e) throw e;
        }
      } catch {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salva modifiche';
        error.textContent = 'Modifiche non salvate. Controlla la connessione e riprova.';
        error.hidden = false;
        return;
      }
      dirty = false;
      await load({ text: 'Modifiche salvate.' });
    });

    refreshVisibility();
    return form;
  }

  function makeControl(key, label, type) {
    const fid = `sc-${key}`;
    const v = prospect[key];
    const textValue = (input) => () => input.value.trim() || null;

    if (type === 'readonly') {
      return { readonly: true, get: () => v, el: h('div', { class: 'field' }, h('p', { class: 'field-label' }, label), h('p', { class: 'readonly tabular' }, String(v ?? 0))) };
    }
    if (type === 'lead') {
      return { readonly: true, get: () => v, el: h('div', { class: 'field' }, h('p', { class: 'field-label' }, label), h('p', { class: 'readonly' }, v ? 'Sì, arrivato dal form del sito' : 'No')) };
    }
    if (type === 'tags') {
      const selected = new Set((prospect.prospect_tag ?? []).map((t) => t.tag_id));
      const boxes = lk.tag.map((t) => {
        const cb = h('input', { type: 'checkbox', id: `${fid}-${t.id}`, value: String(t.id) });
        cb.checked = selected.has(t.id);
        return { t, cb };
      });
      // tag già associati ma disattivati restano visibili
      return {
        get: () => boxes.filter((b) => b.cb.checked).map((b) => b.t.id).sort((a, b) => a - b),
        el: h('fieldset', { class: 'field tag-field' },
          h('legend', { class: 'field-label' }, label),
          h('div', { class: 'tag-grid' }, boxes.map(({ t, cb }) =>
            h('label', { class: 'tag-option', for: cb.id }, cb, h('span', {}, t.nome))))),
      };
    }

    let input;
    let get;
    if (type === 'textarea') {
      input = h('textarea', { id: fid, rows: '3' });
      input.value = v ?? '';
      get = textValue(input);
    } else if (['stato', 'profilo', 'motivo', 'origine'].includes(type)) {
      const options = {
        stato: STATI.map((s) => [s.id, s.nome]),
        profilo: lk.profili.map((p) => [p.id, p.nome || 'Senza nome']),
        motivo: lk.motivi.map((m) => [String(m.id), m.nome]),
        origine: lk.origini.map((o) => [String(o.id), o.nome]),
      }[type];
      const empty = { profilo: 'Non assegnato', motivo: 'Nessuno', origine: 'Non indicata' }[type];
      input = h('select', { id: fid },
        empty ? h('option', { value: '' }, empty) : null,
        options.map(([val, txt]) => h('option', { value: val }, txt)));
      input.value = v == null ? '' : String(v);
      // valore non più tra quelli attivi: lo mostra comunque per non perderlo
      if (v != null && input.value !== String(v)) {
        input.append(h('option', { value: String(v) }, `${v} (non più attivo)`));
        input.value = String(v);
      }
      get = ['motivo', 'origine'].includes(type)
        ? () => (input.value ? Number(input.value) : null)
        : type === 'stato' ? () => input.value : () => input.value || null;
    } else if (type === 'number') {
      input = h('input', { id: fid, type: 'number', inputmode: 'decimal', min: '0', step: '0.01' });
      input.value = v ?? '';
      get = () => (input.value === '' ? null : Number(input.value));
    } else if (type === 'date') {
      input = h('input', { id: fid, type: 'date' });
      input.value = v ?? '';
      get = () => input.value || null;
    } else {
      const attrs = {
        tel: { type: 'tel', inputmode: 'tel' },
        email: { type: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' },
        url: { type: 'text', inputmode: 'url', autocapitalize: 'none', spellcheck: 'false' },
        text: { type: 'text' },
      }[type];
      input = h('input', { id: fid, autocomplete: 'off', ...attrs, 'aria-describedby': 'scheda-error' });
      input.value = v ?? '';
      get = textValue(input);
    }

    const extra = key === 'telefono' || key === 'sito' || key === 'link_demo' || key === 'email'
      ? fieldLink(key, v) : null;
    return { input, get, el: h('div', { class: 'field' }, h('label', { for: fid }, label), input, extra) };
  }

  // ---------- eliminazione ----------
  function dangerZone() {
    return h('section', { class: 'danger-zone', 'aria-labelledby': 'danger-title' },
      h('h2', { class: 'section-title', id: 'danger-title' }, 'Elimina prospect'),
      h('p', {}, 'Cancella il prospect con tutto lo storico e i tag. Non si può annullare.'),
      h('button', { type: 'button', class: 'btn btn-danger-outline', onclick: onElimina }, 'Elimina prospect'));
  }

  function onElimina() {
    const nome = prospect.nome_attivita;
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');
    const confirm = h('button', { type: 'button', class: 'btn btn-danger' }, 'Elimina');
    const body = h('div', { class: 'form' },
      h('p', {}, 'Stai per eliminare ', h('strong', {}, nome), ' con tutte le chiamate, le note e i tag. Non si può annullare.'),
      error,
      h('div', { class: 'dialog-actions' }, cancel, confirm));
    // Il focus parte su Annulla: l'azione sicura
    const dialog = openSheet('Eliminare il prospect?', body, { labelId: 'del-title', initialFocus: cancel });
    dialog.setAttribute('role', 'alertdialog');
    cancel.addEventListener('click', () => dialog.close());

    confirm.addEventListener('click', async () => {
      error.hidden = true;
      confirm.disabled = true;
      confirm.textContent = 'Eliminazione…';
      const { data, error: err } = await sb.from('prospects').delete().eq('id', id).select('id');
      confirm.disabled = false;
      confirm.textContent = 'Elimina';
      if (err || !data?.length) {
        // Nessuna riga cancellata senza errore = permesso negato dal database (RLS)
        error.textContent = err
          ? 'Non sono riuscito a eliminarlo. Controlla la connessione e riprova.'
          : 'Il database non permette di eliminare questo prospect.';
        error.hidden = false;
        return;
      }
      dirty = false;
      setFlash(`Eliminato ${nome}.`);
      dialog.close();
      location.hash = '#/lista';
    });
  }

  // ---------- azioni ----------
  async function onRegistraChiamata() {
    const esito = await registraChiamata({ sb, prospect, esiti: lk.esiti, motivi: lk.motivi });
    if (!esito) return;
    const before = prospect.stato;
    await load();
    let notice = { text: 'Chiamata salvata.' };
    if (prospect.stato === 'perso' && esito.incrementa_tentativi && before !== 'perso') {
      notice = { text: 'Terzo tentativo senza risposta: il prospect è passato a Perso (irraggiungibile).', warn: true };
    } else if (esito.stato_dopo === 'interessato') {
      openGroups.add('demo');
      notice = { text: 'Chiamata salvata. Compila la sezione Per la demo.' };
    }
    render(notice);
    if (esito.stato_dopo === 'interessato') {
      root.querySelector('[data-group="demo"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function onDemoInviata() {
    const ok = await segnaDemoInviata({ sb, prospect });
    if (!ok) return;
    await load(ok === 'senza-nota'
      ? { text: 'Demo segnata come inviata, ma la nota non è stata salvata. Aggiungila a mano.', warn: true }
      : { text: 'Demo segnata come inviata.' });
  }

  async function onNota() {
    const ok = await aggiungiNota({ sb, prospect });
    if (ok) await load({ text: 'Nota salvata.' });
  }

  load();

  return {
    title: 'Scheda prospect',
    cleanup: () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.querySelector('dialog[open]')?.close();
    },
  };
}

// ---------- aiuti ----------

function backLink() {
  return h('a', { class: 'back-link', href: '#/lista' }, '‹ Prospect');
}

/** Link rapido accanto a telefono, email e siti. */
function fieldLink(key, v) {
  if (!v) return null;
  if (key === 'telefono') {
    const tel = telHref(v);
    return tel ? h('a', { class: 'field-link', href: tel }, 'Chiama questo numero') : null;
  }
  if (key === 'email') return h('a', { class: 'field-link', href: `mailto:${v}` }, 'Scrivi un’email');
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return h('a', { class: 'field-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Apri il sito');
}

function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return (a ?? null) === (b ?? null);
}

