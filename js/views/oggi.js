// Schermata Oggi: prospect in ritardo (in rosso) e da sentire oggi.
import { h, pageHeader } from '../dom.js';
import { formatDate, todayISO } from '../format.js';
import { callButton, skeleton, errorBox } from '../ui.js';

const CHIUSI = '(vinto,perso)';

export default async function oggi(main, { sb, state }) {
  let soloMiei = true; // "solo miei" attivo di default, a ogni apertura
  let loading = false;

  // --- intestazione e interruttore ---
  const now = new Date();
  const weekday = now.toLocaleDateString('it-IT', { weekday: 'long' });
  const sub = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${formatDate(now)}`;

  const toggle = h('input', {
    type: 'checkbox', id: 'solo-miei', class: 'switch-input', role: 'switch',
  });
  toggle.checked = soloMiei;
  toggle.addEventListener('change', () => {
    soloMiei = toggle.checked;
    load({ quiet: false });
  });

  const toolbar = h('div', { class: 'toolbar' },
    h('label', { class: 'switch', for: 'solo-miei' },
      toggle,
      h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
      h('span', {}, 'Solo miei'),
    ),
  );

  const content = h('div', { class: 'oggi-content', 'aria-live': 'polite' });

  main.append(h('div', { class: 'page-head-row' }, pageHeader('Oggi', sub), toolbar), content);

  // --- caricamento ---
  async function load({ quiet }) {
    if (loading) return;
    loading = true;
    if (!quiet) content.replaceChildren(skeleton());
    content.setAttribute('aria-busy', 'true');

    const today = todayISO();
    let query = sb
      .from('prospects')
      .select('id, nome_attivita, citta, telefono, prossima_azione, prossima_azione_data')
      .lte('prossima_azione_data', today)
      .not('stato', 'in', CHIUSI)
      .order('prossima_azione_data', { ascending: true })
      .order('nome_attivita', { ascending: true });
    if (soloMiei) query = query.eq('assegnato_a', state.user.id);

    const { data, error } = await query;
    loading = false;
    content.removeAttribute('aria-busy');
    if (!content.isConnected) return;

    if (error) {
      content.replaceChildren(errorBox(() => load({ quiet: false })));
      return;
    }

    const late = data.filter((p) => p.prossima_azione_data < today);
    const due = data.filter((p) => p.prossima_azione_data === today);
    content.replaceChildren(...render(late, due));
  }

  function render(late, due) {
    if (!late.length && !due.length) return [emptyState()];
    const parts = [];
    if (late.length) parts.push(section('oggi-late', 'In ritardo', late, true));
    parts.push(due.length
      ? section('oggi-today', 'Da fare oggi', due, false)
      : h('section', { class: 'group', 'aria-labelledby': 'oggi-today' },
          h('h2', { class: 'group-title', id: 'oggi-today' }, 'Da fare oggi'),
          h('p', { class: 'group-empty' }, 'Niente in programma per oggi oltre ai ritardi.')));
    return parts;
  }

  function emptyState() {
    if (soloMiei) {
      return h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Niente in programma per te oggi.'),
        h('p', {}, 'Nessun tuo prospect ha un’azione per oggi o in ritardo.'),
        h('button', {
          type: 'button', class: 'btn btn-secondary',
          onclick: () => { toggle.checked = false; toggle.dispatchEvent(new Event('change')); },
        }, 'Mostra anche quelli degli altri'),
      );
    }
    return h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, 'Niente in programma oggi.'),
      h('p', {}, 'Nessun prospect ha un’azione per oggi o in ritardo.'),
      h('a', { class: 'btn btn-secondary', href: '#/lista' }, 'Apri la lista prospect'),
    );
  }

  // Quando si torna all'app dopo una telefonata, aggiorna senza scheletro
  const onVisible = () => {
    if (document.visibilityState === 'visible') load({ quiet: true });
  };
  document.addEventListener('visibilitychange', onVisible);

  load({ quiet: false });

  return {
    title: 'Oggi',
    cleanup: () => document.removeEventListener('visibilitychange', onVisible),
  };
}

// ---------- pezzi di interfaccia ----------

function section(id, title, rows, late) {
  return h('section', { class: `group${late ? ' group-late' : ''}`, 'aria-labelledby': id },
    h('h2', { class: 'group-title', id },
      title, ' ', h('span', { class: 'group-count tabular' }, String(rows.length))),
    h('ul', { class: 'rows', role: 'list' }, rows.map((p) => row(p, late))),
  );
}

function row(p, late) {
  const action = p.prossima_azione?.trim() || 'Nessuna azione indicata';

  return h('li', { class: `row${late ? ' row-late' : ''}` },
    h('a', { class: 'row-main', href: `#/prospect/${p.id}` },
      h('span', { class: 'row-name' }, p.nome_attivita),
      h('span', { class: 'row-city' }, p.citta ?? ''),
      h('span', { class: 'row-action' },
        h('span', { class: 'row-action-text' }, action),
        late ? h('span', { class: 'row-late-date tabular' }, `dal ${formatDate(p.prossima_azione_data)}`) : null,
      ),
    ),
    callButton(p),
  );
}
