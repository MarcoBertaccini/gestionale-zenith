// Avvio dell'app: sessione, login, struttura e router.
import { sb } from './supabase.js';
import { signIn, signOut, loadProfile, loginErrorMessage } from './auth.js';
import { route, startRouter, stopRouter } from './router.js';
import { clearLookups } from './lookups.js';
import oggi from './views/oggi.js';
import lista from './views/lista.js';
import scheda from './views/scheda.js';

route(/^\/oggi$/, 'oggi', oggi);
route(/^\/lista$/, 'lista', lista);
route(/^\/prospect\/([0-9a-f-]{36})$/i, 'lista', scheda);

const $ = (id) => document.getElementById(id);
const boot = $('boot');
const loginView = $('login-view');
const shell = $('shell');

// Stato condiviso con le schermate (utente e profilo)
const state = { user: null, profile: null };

// ---------- Login ----------

const form = $('login-form');
const emailInput = $('login-email');
const passwordInput = $('login-password');
const errorBox = $('login-error');
const submitBtn = $('login-submit');
const toggleBtn = $('toggle-password');

function showLoginError(message, fields = []) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  for (const input of [emailInput, passwordInput]) {
    if (fields.includes(input)) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function clearLoginError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
  emailInput.removeAttribute('aria-invalid');
  passwordInput.removeAttribute('aria-invalid');
}

toggleBtn.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  toggleBtn.textContent = show ? 'Nascondi' : 'Mostra';
  toggleBtn.setAttribute('aria-pressed', String(show));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearLoginError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !emailInput.checkValidity()) {
    showLoginError('Scrivi un indirizzo email valido.', [emailInput]);
    emailInput.focus();
    return;
  }
  if (!password) {
    showLoginError('Scrivi la password.', [passwordInput]);
    passwordInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Accesso in corso…';
  try {
    await signIn(email, password);
    // L'ingresso nell'app lo gestisce onAuthStateChange (SIGNED_IN)
  } catch (error) {
    showLoginError(loginErrorMessage(error), [emailInput, passwordInput]);
    passwordInput.select();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Accedi';
  }
});

// ---------- Uscita ----------

$('logout').addEventListener('click', async (event) => {
  const btn = event.currentTarget;
  btn.disabled = true;
  try {
    await signOut();
  } catch {
    // Anche se la rete non risponde, la sessione locale viene comunque rimossa
    showLogin();
  } finally {
    btn.disabled = false;
  }
});

// ---------- Cambio vista ----------

function showLogin() {
  stopRouter();
  clearLookups();
  try { sessionStorage.removeItem('zenith-lista-filtri'); } catch { /* ignora */ }
  state.user = null;
  state.profile = null;
  boot.hidden = true;
  shell.hidden = true;
  loginView.hidden = false;
  document.title = 'Accedi – Gestionale Zenith';
  passwordInput.value = '';
  emailInput.focus();
}

async function enterApp(user) {
  if (state.user?.id === user.id) return; // già dentro (es. refresh del token)
  state.user = user;
  state.profile = await loadProfile(user);

  $('who').textContent = state.profile.nome;
  clearLoginError();
  boot.hidden = true;
  loginView.hidden = true;
  shell.hidden = false;
  startRouter({ sb, state });
}

// INITIAL_SESSION arriva subito con la sessione salvata (o null).
// Le chiamate a Supabase si fanno fuori dal callback, come consigliato da supabase-js.
sb.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (session?.user) enterApp(session.user);
    else showLogin();
  }, 0);
});
