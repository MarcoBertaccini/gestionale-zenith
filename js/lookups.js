// Valori fissi letti dalle tabelle (mai scritti nel codice), con cache in memoria.
import { sb } from './supabase.js';

const cache = new Map();

function load(key, query) {
  if (!cache.has(key)) {
    const p = query().then(({ data, error }) => {
      if (error) { cache.delete(key); throw error; }
      return data;
    });
    cache.set(key, p);
  }
  return cache.get(key);
}

const fisso = (table) => () =>
  sb.from(table).select('id, nome').eq('attivo', true).order('ordine', { ascending: true });

export const getTagSito = () => load('tag_sito', fisso('tag_sito'));
export const getOrigini = () => load('origini', fisso('origini'));
export const getMotiviPerso = () => load('motivi_perso', fisso('motivi_perso'));
export const getEsiti = () => load('esiti_chiamata', () =>
  sb.from('esiti_chiamata').select('*').eq('attivo', true).order('ordine', { ascending: true }));
export const getProfili = () => load('profili', () =>
  sb.from('profili').select('id, nome').order('nome', { ascending: true }));

/** Da chiamare al logout, così un altro utente non vede dati in cache. */
export function clearLookups() {
  cache.clear();
}
