# gestionale-zenith

Gestionale interno dei prospect di Zenith Studio. Specifica completa in [spec.md](spec.md).

Web app statica (HTML, CSS, JS) su GitHub Pages che parla direttamente con Supabase.
Nessun build: si apre `index.html` servito da un server statico qualsiasi.

```
python3 -m http.server 8000   # poi http://localhost:8000
```

## Struttura

- `index.html` – login e struttura dell'app (barra in alto, navigazione, contenuto)
- `css/app.css` – stile e colori (solo tema chiaro)
- `js/config.js` – URL Supabase e chiave **publishable** (mai la secret key)
- `js/supabase.js` – client condiviso, sessione persistente
- `js/auth.js` – login, logout, profilo
- `js/router.js` – navigazione a hash: `#/oggi`, `#/lista`, `#/prospect/<id>`
- `js/views/` – una schermata per file
- `vendor/` – supabase-js 2.118.0 (unica libreria)
- `manifest.webmanifest`, `icons/` – aggiunta alla Home dell'iPhone
