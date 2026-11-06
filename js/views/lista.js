import { h, pageHeader } from '../dom.js';

// Lista prospect: verrà costruita al punto 3.
export default async function lista(main) {
  main.append(
    pageHeader('Prospect'),
    h('div', { class: 'placeholder' },
      h('strong', {}, 'In arrivo'),
      'Qui potrai cercare, filtrare e aggiungere prospect.'),
  );
  return 'Prospect';
}
