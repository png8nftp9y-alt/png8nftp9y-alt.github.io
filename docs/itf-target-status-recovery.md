## 2026-11-15 — Recupero mirato degli stati ITF

Obiettivo: completare la verifica delle 187 coppie giocatore/torneo rimaste senza prova di gioco, senza inventare partecipazioni. Il run 43767061098 ha salvato 13 dei 139 tabelloni richiesti; gli altri sono stati bloccati da Incapsula e il servizio alternativo non risultava configurato.

Il workflow resta esclusivamente manuale. Riutilizza gli artifact del run indicato, valida i documenti salvati e pianifica solo le sezioni mancanti, con un torneo per runner. Il lettore browser già usato dal motore ITF viene richiamato per le letture dirette fallite; il nuovo filtro opzionale limita anche la lettura browser alle sezioni richieste. I percorsi esistenti senza filtro restano invariati. Nessun tentativo di risoluzione automatica dei challenge: se la fonte resta bloccata, l'errore viene conservato e il job resta rosso.

Ogni documento riuscito viene salvato prima di proseguire; gli artifact vengono caricati anche in caso di errore. Nessuna scrittura D1/R2, nessuna cancellazione e nessun rilancio automatico. W/O, codici NP/WO e gli altri stati ufficiali sono conservati; il ritrovamento nel tabellone non viene dichiarato incontro giocato. Giocatori non ritrovati restano unresolved.

Verifica locale: 10 test mirati superati, inclusi riuso senza richieste, recupero solo delle sezioni mancanti, persistenza errori browser, slot null, W/O, errore di checkpoint e filtro effettivo del lettore browser. Piano eseguito sui 13 documenti reali del run: 187 coppie, 13 sezioni riutilizzate, 126 sezioni residue in 73 tornei. La lettura browser live e l'esito remoto restano da verificare con un nuovo avvio manuale.
