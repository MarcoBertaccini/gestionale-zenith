// Formati italiani usati in tutta l'app: date "5/11", ore 24h.

/** Accetta Date o stringa 'YYYY-MM-DD' / ISO. Restituisce "5/11". */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "14:05" */
export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "5/11 14:05" */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Data locale di oggi come 'YYYY-MM-DD' (per confronti con colonne date). */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  // 'YYYY-MM-DD' va letta come data locale, non UTC
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
