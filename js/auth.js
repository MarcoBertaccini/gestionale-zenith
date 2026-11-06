// Login, logout e profilo dell'utente collegato.
import { sb } from './supabase.js';

/** Messaggio d'errore in italiano, che dice cosa fare. */
export function loginErrorMessage(error) {
  const code = error?.code;
  const status = error?.status;
  if (code === 'invalid_credentials' || status === 400) {
    return 'Email o password non corretti. Controlla e riprova.';
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Troppi tentativi. Aspetta qualche minuto e riprova.';
  }
  if (code === 'user_banned') {
    return 'Questo account è disattivato. Chiedi a Marco di riattivarlo.';
  }
  if (!navigator.onLine || status === 0 || error?.name === 'AuthRetryableFetchError') {
    return 'Nessuna connessione. Controlla la rete e riprova.';
  }
  return 'Accesso non riuscito. Riprova tra poco.';
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  // scope 'local': esce solo da questo dispositivo
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Profilo dalla tabella profili (solo lettura). Se manca, usa l'email. */
export async function loadProfile(user) {
  const fallback = { id: user.id, nome: user.email?.split('@')[0] ?? 'Utente', email: user.email };
  const { data, error } = await sb.from('profili').select('id, nome').eq('id', user.id).maybeSingle();
  if (error || !data) return fallback;
  return { ...fallback, ...data, nome: data.nome || fallback.nome };
}
