// Client Supabase condiviso. La libreria è inclusa in vendor/ (supabase-js 2.118.0).
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

if (!window.supabase?.createClient) {
  throw new Error('supabase-js non caricato: controlla vendor/supabase-js-2.118.0.js');
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,        // sessione persistente (resta loggato)
    autoRefreshToken: true,
    detectSessionInUrl: false,   // niente link magici o registrazione
    storageKey: 'zenith-gestionale-auth',
  },
});
