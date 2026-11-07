// Tastiera sul telefono: si chiude quando si scorre la pagina o si tocca
// fuori dai campi, come nelle app native. iOS di suo la lascia aperta.

const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]), textarea';
const INTERACTIVE = 'input, textarea, select, button, a, label, summary, [role=button]';
const SOGLIA = 10; // px di movimento oltre i quali è uno scorrimento, non un tocco

export function setupKeyboardDismiss() {
  let start = null;

  const focusedField = () => {
    const el = document.activeElement;
    return el && el.matches?.(TEXT_FIELD) ? el : null;
  };

  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = t ? { x: t.clientX, y: t.clientY, moved: false } : null;
  }, { passive: true });

  // Scorrimento: chiude la tastiera (tranne se si scorre dentro il campo stesso)
  document.addEventListener('touchmove', (e) => {
    if (!start || start.moved) return;
    const t = e.touches[0];
    if (!t || Math.hypot(t.clientX - start.x, t.clientY - start.y) < SOGLIA) return;
    start.moved = true;
    const field = focusedField();
    if (field && !field.contains(e.target)) field.blur();
  }, { passive: true });

  // Tocco su una zona vuota (non un campo, bottone o link): chiude la tastiera
  document.addEventListener('touchend', (e) => {
    const wasTap = start && !start.moved;
    start = null;
    if (!wasTap) return;
    const field = focusedField();
    if (field && !e.target.closest?.(INTERACTIVE)) field.blur();
  }, { passive: true });

  // Invio nella ricerca: chiude la tastiera per vedere i risultati
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('input[type=search]')) e.target.blur();
  });
}
