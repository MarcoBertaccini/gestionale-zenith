import { h, pageHeader } from '../dom.js';

// Scheda prospect: verrà costruita al punto 4.
export default async function scheda(main) {
  main.append(
    pageHeader('Scheda prospect'),
    h('div', { class: 'placeholder' },
      h('strong', {}, 'In arrivo'),
      'Qui vedrai i dati del prospect, lo storico e Registra chiamata.'),
  );
  return 'Scheda prospect';
}
