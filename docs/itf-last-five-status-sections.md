## 2026-11-16 — Ultimi cinque tabelloni della verifica partecipazioni ITF

Il run 43772687372 conserva 134 dei 139 tabelloni richiesti. Restano cinque sezioni in quattro tornei: J-J200-ARG-2026-001 (G-S-M-KO, G-S-Q-KO), J-J30-LAT-2026-006, J-J30-TUN-2026-005 e J-J30-TUR-2026-009 (G-S-Q-KO). I tentativi browser terminano con Failed to fetch; l'errore generico non prova da solo CORS o una particolare risposta HTTP.

Il recupero mirato abilita un'opzione esplicita: dopo un errore di rete del fetch in pagina, una GET attraverso il client della stessa sessione Playwright legge soltanto GetDrawsheet/GetEventFilters sul dominio ufficiale. Usa lo stesso contesto di cookie, timeout di 30 secondi, nessun cambio di identità e nessuna risoluzione di challenge. Risposte HTTP non 2xx e protezioni della fonte non sono accettate come documenti. I chiamanti esistenti non abilitano il percorso alternativo per default. I tre tentativi totali restano limitati.

Il workflow manuale riprende per default 43772687372. Piano provato sui documenti reali: 187 coppie, 134 sezioni riutilizzate, cinque residue in quattro tornei. Nessuna scrittura D1/R2, nessun rilancio automatico, nessuna inferenza di partecipazioni giocate da W/O o da dati mancanti.

Validazione locale: 20 test superati, inclusi errori HTTP JSON, challenge, dominio non consentito, fallimenti permanenti e regressioni del recupero. Esito live dei cinque tabelloni ancora da verificare dopo pubblicazione e avvio manuale.
