// Azioni della scheda: Registra chiamata, Segna demo inviata, Aggiungi nota.
import { h } from '../dom.js';
import { addDaysISO } from '../format.js';
import { openSheet, field, statoNome } from '../ui.js';

const MAX_TENTATIVI = 3; // al 3° "Non risponde" la funzione registra_chiamata chiude come Perso

/**
 * Registra chiamata: esito → l'app propone stato, azione e data → nota → Salva.
 * Il salvataggio è UNA chiamata RPC registra_chiamata: l'app non aggiorna
 * stato e contatore a mano. Risolve con l'esito scelto, o null se annullato.
 */
export function registraChiamata({ sb, prospect, esiti, motivi }) {
  return new Promise((resolve) => {
    let esito = null;
    let saved = null;

    // --- esito ---
    const esitiList = h('div', { class: 'choice-list', role: 'radiogroup', 'aria-labelledby': 'rc-esito-label' },
      esiti.map((e) => {
        const id = `rc-esito-${e.id}`;
        const input = h('input', { type: 'radio', name: 'esito', id, value: String(e.id) });
        input.addEventListener('change', () => selectEsito(e));
        return h('label', { class: 'choice', for: id }, input, h('span', {}, e.nome));
      }));

    // --- proposte (compaiono dopo aver scelto l'esito) ---
    const statoInfo = h('p', { class: 'proposal' });
    const avviso = h('p', { class: 'proposal-warning', hidden: true });

    const azione = h('input', { id: 'rc-azione', autocomplete: 'off' });
    const data = h('input', { id: 'rc-data', type: 'date' });
    const azioneBox = h('div', { class: 'form-2col' },
      field('rc-azione', 'Prossima azione', azione),
      field('rc-data', 'Data', data));

    const motivo = h('select', { id: 'rc-motivo', 'aria-describedby': 'rc-error' },
      h('option', { value: '' }, 'Scegli il motivo'),
      motivi.map((m) => h('option', { value: String(m.id) }, m.nome)));
    const motivoBox = field('rc-motivo', 'Motivo (obbligatorio)', motivo);

    const prezzo = h('input', { id: 'rc-prezzo', type: 'number', inputmode: 'decimal', min: '0', step: '0.01' });
    const prezzoBox = field('rc-prezzo', 'Prezzo proposto (€)', prezzo);

    const nota = h('textarea', { id: 'rc-nota', rows: '3' });
    const notaBox = field('rc-nota', 'Nota (facoltativa)', nota);

    const details = h('div', { class: 'form', hidden: true },
      statoInfo, avviso, azioneBox, motivoBox, prezzoBox, notaBox);

    const error = h('p', { class: 'form-error', id: 'rc-error', role: 'alert', hidden: true });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Salva chiamata');
    const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');

    const form = h('form', { class: 'form', novalidate: true },
      h('p', { class: 'field-label', id: 'rc-esito-label' }, 'Esito'),
      esitiList,
      details,
      error,
      h('div', { class: 'dialog-actions' }, cancel, submit));

    function selectEsito(e) {
      esito = e;
      error.hidden = true;
      details.hidden = false;
      submit.disabled = false;

      const nuovoStato = e.stato_dopo ?? prospect.stato;
      statoInfo.replaceChildren(
        'Stato: ',
        e.stato_dopo && e.stato_dopo !== prospect.stato
          ? h('strong', {}, `${statoNome(prospect.stato)} → ${statoNome(nuovoStato)}`)
          : h('strong', {}, `${statoNome(prospect.stato)} (invariato)`));

      // Avviso chiusura automatica al terzo tentativo senza risposta
      const tentativi = (prospect.tentativi_senza_risposta ?? 0) + (e.incrementa_tentativi ? 1 : 0);
      if (e.incrementa_tentativi) {
        avviso.hidden = false;
        avviso.textContent = tentativi >= MAX_TENTATIVI
          ? `È il ${tentativi}° tentativo senza risposta: il prospect passerà da solo a Perso (irraggiungibile).`
          : `Tentativo senza risposta n. ${tentativi} di ${MAX_TENTATIVI}.`;
      } else {
        avviso.hidden = true;
      }

      // Azione e data proposte (modificabili prima di salvare)
      const hasAzione = Boolean(e.azione_proposta);
      azioneBox.hidden = !hasAzione;
      azione.value = e.azione_proposta ?? '';
      data.value = hasAzione && e.giorni_proposti != null ? addDaysISO(e.giorni_proposti, e.giorni_lavorativi) : '';

      motivoBox.hidden = !e.richiede_motivo;
      if (!e.richiede_motivo) motivo.value = '';
      motivo.removeAttribute('aria-invalid');

      // "Accetta": chiedere il prezzo se manca
      const chiediPrezzo = e.stato_dopo === 'vinto' && prospect.prezzo_proposto == null;
      prezzoBox.hidden = !chiediPrezzo;
      if (!chiediPrezzo) prezzo.value = '';
    }

    const dialog = openSheet(`Registra chiamata`, form, { labelId: 'rc-title' });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(saved));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!esito) return;
      error.hidden = true;

      if (esito.richiede_motivo && !motivo.value) {
        motivo.setAttribute('aria-invalid', 'true');
        error.textContent = 'Scegli il motivo per cui è perso.';
        error.hidden = false;
        motivo.focus();
        return;
      }
      const hasAzione = !azioneBox.hidden;
      if (hasAzione && azione.value.trim() && !data.value) {
        error.textContent = 'Scegli la data della prossima azione.';
        error.hidden = false;
        data.focus();
        return;
      }
      const prezzoVal = prezzoBox.hidden || prezzo.value === '' ? null : Number(prezzo.value);
      if (prezzoVal != null && (Number.isNaN(prezzoVal) || prezzoVal < 0)) {
        error.textContent = 'Scrivi il prezzo come numero, ad esempio 900.';
        error.hidden = false;
        prezzo.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Salvataggio…';
      const { error: err } = await sb.rpc('registra_chiamata', {
        p_prospect_id: prospect.id,
        p_esito_id: esito.id,
        p_testo: nota.value.trim() || null,
        p_prossima_azione: hasAzione ? (azione.value.trim() || null) : null,
        p_prossima_azione_data: hasAzione ? (data.value || null) : null,
        p_motivo_perso_id: esito.richiede_motivo ? Number(motivo.value) : null,
        p_prezzo_proposto: prezzoVal,
      });
      submit.disabled = false;
      submit.textContent = 'Salva chiamata';

      if (err) {
        error.textContent = 'Chiamata non salvata. Controlla la connessione e riprova.';
        error.hidden = false;
        return;
      }
      saved = esito;
      dialog.close();
    });
  });
}

/**
 * Segna demo inviata: chiede il link, porta a Demo inviata con prossima
 * azione "Sentire se gli piace" a +3 giorni e aggiunge una nota.
 */
export function segnaDemoInviata({ sb, prospect }) {
  return new Promise((resolve) => {
    let saved = false;
    const link = h('input', { id: 'dm-link', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://', 'aria-describedby': 'dm-error' });
    link.value = prospect.link_demo ?? '';
    const data = h('input', { id: 'dm-data', type: 'date' });
    data.value = addDaysISO(3);
    const nota = h('textarea', { id: 'dm-nota', rows: '2' });
    const error = h('p', { class: 'form-error', id: 'dm-error', role: 'alert', hidden: true });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Segna demo inviata');
    const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');

    const form = h('form', { class: 'form', novalidate: true },
      field('dm-link', 'Link della demo', link),
      h('p', { class: 'proposal' }, 'Stato: ', h('strong', {}, `${statoNome(prospect.stato)} → Demo inviata`)),
      field('dm-data', 'Sentire se gli piace il', data),
      field('dm-nota', 'Nota (facoltativa)', nota),
      error,
      h('div', { class: 'dialog-actions' }, cancel, submit));

    const dialog = openSheet('Segna demo inviata', form, { labelId: 'dm-title', initialFocus: link });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(saved));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      error.hidden = true;
      const url = link.value.trim();
      if (!url) {
        link.setAttribute('aria-invalid', 'true');
        error.textContent = 'Incolla il link della demo.';
        error.hidden = false;
        link.focus();
        return;
      }
      if (!data.value) {
        error.textContent = 'Scegli quando sentirlo.';
        error.hidden = false;
        data.focus();
        return;
      }
      link.removeAttribute('aria-invalid');
      submit.disabled = true;
      submit.textContent = 'Salvataggio…';

      const { error: err1 } = await sb.from('prospects').update({
        stato: 'demo_inviata',
        link_demo: url,
        prossima_azione: 'Sentire se gli piace',
        prossima_azione_data: data.value,
      }).eq('id', prospect.id);

      let err2 = null;
      if (!err1) {
        const extra = nota.value.trim();
        ({ error: err2 } = await sb.from('interazioni').insert({
          prospect_id: prospect.id,
          tipo: 'nota',
          testo: `Demo inviata: ${url}${extra ? `\n${extra}` : ''}`,
        }));
      }
      submit.disabled = false;
      submit.textContent = 'Segna demo inviata';

      if (err1) {
        error.textContent = 'Non salvato. Controlla la connessione e riprova.';
        error.hidden = false;
        return;
      }
      saved = err2 ? 'senza-nota' : true;
      dialog.close();
    });
  });
}

/** Aggiungi nota: interazione di tipo nota, stato invariato. */
export function aggiungiNota({ sb, prospect }) {
  return new Promise((resolve) => {
    let saved = false;
    const testo = h('textarea', { id: 'nt-testo', rows: '4', 'aria-describedby': 'nt-error' });
    const error = h('p', { class: 'form-error', id: 'nt-error', role: 'alert', hidden: true });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salva nota');
    const cancel = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Annulla');
    const form = h('form', { class: 'form', novalidate: true },
      field('nt-testo', 'Nota', testo),
      error,
      h('div', { class: 'dialog-actions' }, cancel, submit));

    const dialog = openSheet('Aggiungi nota', form, { labelId: 'nt-title', initialFocus: testo });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(saved));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const t = testo.value.trim();
      if (!t) {
        testo.setAttribute('aria-invalid', 'true');
        error.textContent = 'Scrivi la nota.';
        error.hidden = false;
        testo.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Salvataggio…';
      const { error: err } = await sb.from('interazioni').insert({ prospect_id: prospect.id, tipo: 'nota', testo: t });
      submit.disabled = false;
      submit.textContent = 'Salva nota';
      if (err) {
        error.textContent = 'Nota non salvata. Controlla la connessione e riprova.';
        error.hidden = false;
        return;
      }
      saved = true;
      dialog.close();
    });
  });
}

