Spec – Gestionale prospect Zenith Studio (v1)

Versione: 5 novembre 2026 · Autore: Marco Bertaccini

Obiettivo

Un gestionale minimo per non perdere più nessun prospect della vendita di siti web: ogni prospect vivo ha sempre uno stato e una prossima azione con data.

	•	Utenti: Marco e Sara, ognuno con il proprio login, che vedono gli stessi prospect.
	•	Uso tipico: da telefono, durante e subito dopo le chiamate. Mobile-first.
	•	Ambito: solo l'attività di vendita siti di Zenith Studio. Strumento interno, non un prodotto da vendere.
	•	Problema che risolve: prospect sparsi su più fogli Google Sheets; si perdono richiami, esiti delle chiamate e coordinamento con Sara.
	•	Ingressi dati: inserimento manuale dall'app, caricamento da parte di Claude via chat, lead dal form del sito zenith-studio.it.

Stato attuale del backend (già fatto, NON ricreare)

Il database è già creato, popolato e testato. Code costruisce solo l'interfaccia.

	•	Progetto Supabase: zenith-studio
	•	URL: https://xrpexwjpljqwgsynxpja.supabase.co
	•	Chiave publishable (pubblica, va nel frontend): sb_publishable_by17IPWZl-4UsI6uy8WQ5w_Xz3oBKAb
	•	Utenti già creati: Marco e Sara. Registrazione pubblica disattivata.
	•	Dati: 61 prospect importati da Da_chiamare_Ravenna (stato Da chiamare, non assegnati, senza data).
	•	Valori fissi, RLS, trigger e funzione registra_chiamata già attivi.

Stack e architettura

Web app statica su GitHub Pages che parla direttamente con Supabase, sul modello dell'app casadue. Nessun server proprio.

Pezzo	Tecnologia	Chi lo costruisce
Database, RLS, valori fissi, utenti	Supabase zenith-studio	Claude (chat) – FATTO
Facciata	HTML/CSS/JS statico + supabase-js, GitHub Pages	Claude Code
Automazioni pianificate	n8n su n8n.zenith-studio.it	Claude (chat)
Regole nel database	Funzioni e trigger Postgres	Claude (chat) – FATTO

	•	Repo: gestionale-zenith
	•	Indirizzo: gestionale.zenith-studio.it (CNAME su Cloudflare verso GitHub Pages, da aggiungere a fine lavori; serve il file CNAME nel repo)
	•	Stile: interfaccia chiara, neutra e professionale. Niente tema scuro.
	•	Il progetto Supabase è tenuto sveglio dal workflow n8n "Supabase keep-alive".

Pipeline

Sette stati, salvati come testo controllato in prospects.stato:
da_chiamare, non_risponde, interessato, demo_inviata, trattativa, vinto, perso.

Da chiamare --sì alla demo--> Interessato --demo mandata--> Demo inviata --vuole pensarci--> Trattativa --accetta--> Vinto
     |                            ^
     +--non risponde--> Non risponde --poi dice sì--+
                            |
                            +--3° tentativo senza risposta (automatico)--> Perso
Qualunque stato aperto --non interessato--> Perso (motivo obbligatorio)

Lo stato si cambia con Registra chiamata o Segna demo inviata, ma resta modificabile a mano dalla Scheda.

Modello dati

Otto tabelle nello schema public, più la tabella leads già esistente (form del sito).

prospects

Gruppo	Campi
Anagrafica	id uuid, nome_attivita (obbligatorio), settore, citta, telefono, email, sito, referente
Vendita	stato, prossima_azione text, prossima_azione_data date, assegnato_a → profili, tentativi_senza_risposta int, motivo_perso_id → motivi_perso, prezzo_proposto numeric (€)
Origine	origine_id → origini, lead_id → leads
Analisi sito	note_sito text; i tag stanno in prospect_tag
Per la demo	servizi, distintivi, obiettivo_sito, tono, sito_riferimento, logo_colori, foto, slug_demo, link_demo
Sistema	created_at, updated_at (trigger), creato_da → profili (default auth.uid())

interazioni (solo aggiunta, mai modifica né cancellazione): id, prospect_id, created_at, autore_id → profili (default auth.uid(), null se automazione), tipo (chiamata / nota / sistema), esito_id → esiti_chiamata, testo.

prospect_tag: prospect_id, tag_id → tag_sito. PK sulla coppia.

profili: id = id utente Auth (creato in automatico da trigger), nome, whatsapp, riceve_lead.

Valori fissi (tag_sito, origini, motivi_perso, esiti_chiamata): id, nome, ordine, attivo. L'app li legge dalle tabelle (filtrando attivo = true, ordinati per ordine) e non li scrive mai nel codice.

Cancellare un prospect cancella interazioni e tag.

Valori fissi

	•	Tag problemi sito: nessun sito · non mobile · vecchio/datato · niente HTTPS · lento · contatti poco chiari · solo pagina social · niente profilo Google Maps
	•	Origini: scraping · form sito · passaparola · contatto diretto · altro
	•	Motivi perso: prezzo · ha già il sito · non interessato · non decide lui · irraggiungibile · altro

Esiti chiamata – colonne in esiti_chiamata: stato_dopo (null = invariato), azione_proposta, giorni_proposti, giorni_lavorativi, incrementa_tentativi, richiede_motivo.

Esito	Stato dopo	Azione proposta	Data proposta	Note
Non risponde	Non risponde	Richiamare	+1 giorno lavorativo	tentativi +1
Parlato, richiamare	invariato	Richiamare	+1 giorno lavorativo	
Interessato, vuole la demo	Interessato	Mandare demo	+2 giorni	apre sezione Per la demo
Vuole pensarci	Trattativa	Sentire risposta	+3 giorni	
Accetta	Vinto	nessuna	nessuna	chiedere prezzo_proposto se vuoto
Non interessato	Perso	nessuna	nessuna	motivo obbligatorio

L'app calcola la data proposta da giorni_proposti (saltando sabato e domenica se giorni_lavorativi), l'utente può cambiarla prima di salvare.

Schermate e azioni

Quattro schermate, prima per il telefono (390px) poi per il desktop. Aggiungibile alla Home dell'iPhone (manifest e icona). Interfaccia in italiano, date 5/11, ore 24h.

	1.	Login: email e password. Nessun link "registrati". Sessione persistente.
	2.	Oggi (home)
	•	In alto i prospect con prossima_azione_data passata (in ritardo, in rosso); sotto quelli di oggi.
	•	Riga: nome attività, città, prossima azione, bottone Chiama (tel:).
	•	Interruttore "solo miei" (filtra assegnato_a), attivo di default.
	•	Tocco sulla riga → Scheda.
	3.	Lista prospect
	•	Ricerca per nome attività.
	•	Filtri: stato, città, settore, tag, origine, assegnato a (incluso "non assegnato").
	•	+ Nuovo prospect: nome, telefono, città, settore, origine. Stato Da chiamare, assegnato a chi lo crea.
	4.	Scheda prospect
	•	Tutti i campi modificabili, nei gruppi del Modello dati.
	•	Sezione Per la demo visibile solo da Interessato in poi.
	•	Storico interazioni, dal più recente, con autore e data.
	•	Registra chiamata (in evidenza, raggiungibile col pollice): esito → l'app propone stato, azione e data → nota facoltativa → Salva. Il salvataggio si fa con UNA chiamata RPC:
supabase.rpc('registra_chiamata', { p_prospect_id, p_esito_id, p_testo, p_prossima_azione, p_prossima_azione_data, p_motivo_perso_id, p_prezzo_proposto })
La funzione scrive l'interazione, aggiorna il prospect e applica la chiusura automatica al 3° "Non risponde". L'app NON aggiorna stato e contatore a mano. Restituisce il prospect aggiornato.
	•	Segna demo inviata: chiede il link demo, porta a Demo inviata con prossima azione "Sentire se gli piace" a +3 giorni, aggiunge una nota.
	•	Aggiungi nota: interazione di tipo nota, stato invariato.

Login e sicurezza

	•	Supabase Auth email + password. Registrazione pubblica disattivata.
	•	RLS su tutte le tabelle: utente loggato legge e scrive tutto (stesso team). Anonimo: nessun accesso.
	•	Valori fissi: solo lettura. interazioni: lettura e inserimento, niente update/delete.
	•	leads: inserimento anonimo dal form del sito, lettura solo per loggati.
	•	Nel frontend solo la chiave publishable. Mai la secret key nel repo.

Automazioni

Automazione	Dove	Quando	Cosa fa	Stato
Lead dal sito	Trigger su leads	a ogni lead	Crea prospect Interessato, origine "form sito", azione "Chiamare" oggi, assegnato al profilo con riceve_lead (Marco), + interazione di sistema	FATTO
Chiusura automatica	Funzione registra_chiamata	3° "Non risponde"	Perso, motivo "irraggiungibile", interazione di sistema	FATTO
Riepilogo del mattino	n8n	lun-ven 08:00	WhatsApp dal numero Zenith (GREEN-API) ai profili con whatsapp (per ora solo Marco): in ritardo + oggi, con link all'app. Niente se vuoto	da fare (Claude)

Integrazione con demo-sito-cliente

La scheda prospect è la scheda cliente della skill: Claude Code la legge da Supabase invece di farsela incollare.

Campo della skill	Da dove arriva
Nome attività, Settore, Città	nome_attivita, settore, citta
Sito attuale	sito (vuoto = "nessuno")
Contatti	telefono, email
Note dalla chiamata	interazioni del prospect, in ordine
Problemi del sito	prospect_tag + note_sito
Servizi, Distintivi, Obiettivo, Tono, Riferimento stile, Logo e colori, Foto, Slug	sezione Per la demo

Flusso: "fai la demo per <nome attività>" → Code legge il prospect → costruisce la demo → scrive link_demo e, se Marco conferma, porta a Demo inviata. Modifica alla skill dopo la v1.

Regole per Claude Code

	•	Sempre: leggere questa specifica prima di iniziare; una schermata alla volta, in quest'ordine: 1) Login + struttura base (supabase-js, sessione, navigazione, manifest e icona), 2) Oggi, 3) Lista prospect, 4) Scheda prospect, senza passare alla successiva finché la precedente non è verificata; usare le skill di frontend installate; verificare a 390px e 1440px; leggere i valori fissi dalle tabelle; usare solo la chiave publishable.
	•	Chiedere prima: librerie oltre a supabase-js; schermate o funzioni non elencate.
	•	Mai: modifiche al database (niente tabelle nuove, colonne, trigger, RLS, funzioni, migrazioni né SQL: il backend è già fatto, eventuali modifiche si fanno in chat con Claude, non da Code); salvare una chiamata con update fatti a mano invece che con registra_chiamata; secret key o password nel repo; creare utenti o attivare la registrazione; cancellare righe di interazioni; costruire cose di "Fuori dalla v1".

Fuori dalla v1

Statistiche e dashboard · email automatiche e template · calendario · fatture e pagamenti · allegati · Claude dentro l'app · altre attività di Zenith · app nativa.

Criteri di successo

	☐︎	Marco e Sara fanno login; un'email non registrata non entra.
	☐︎	Un prospect nuovo si crea in meno di 30 secondi.
	☐︎	Registra chiamata con "Non risponde" aggiorna stato, contatore, storico e prossima azione in un solo salvataggio.
	☐︎	Al terzo "Non risponde" il prospect passa da solo a Perso, motivo irraggiungibile.
	☐︎	Un lead dal form del sito compare in Oggi come Interessato.
	☐︎	Alle 08:00 di un feriale Marco riceve il riepilogo WhatsApp.
	☐︎	Senza login la chiave publishable non legge nessun prospect.
	☐︎	Nessuno scroll orizzontale a 390px; Chiama e Registra chiamata raggiungibili col pollice.
	☐︎	Claude Code legge un prospect Interessato e ci costruisce una demo con la skill.