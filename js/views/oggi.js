import { h, pageHeader } from '../dom.js';

// Schermata Oggi: verrà costruita al punto 2.
export default async function oggi(main) {
  main.append(
    pageHeader('Oggi'),
    h('div', { class: 'placeholder' },
      h('strong', {}, 'In arrivo nel prossimo passo'),
      'Qui vedrai i prospect in ritardo e quelli da sentire oggi.'),
  );
  return 'Oggi';
}
