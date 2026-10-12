[object Object]


## 12 ottobre 2026 — Shield TCL: ripristino del percorso completo dopo conflitto

- Run indicato https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190591676, job 114622316695: release guard e installazione browser riusciti; test E2E fallito sul click #removePlayer nascosto, perché la pagina attiva era ancora Calendario.
- Causa verificata sul file del commit e4dc43565d3861cac78125bbeba8a84b58191c27: durante la risoluzione del conflitto della PR #127 è stato troncato il blocco tra l’ingresso nel Calendario Altri e il ritorno a Giocatori. Ripristinate le verifiche di mese/filtro/scroll e il percorso Calendario Altri → Calendario TCL → Giocatori TCL → Giocatori Altri prima del CRUD. Nessun click forzato né rimozione di controlli; codice applicativo e dati invariati.
- Nuovo esito E2E da verificare al relativo run; sintassi controllata prima della pubblicazione. Report nello stesso commit.

- Correzione integrata con PR #129 https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/pull/129, merge f1b4dbc8ae72760dd71ce37457d4edb48f65f592. Sintassi e quattro regressioni di gruppo passate. Run letti una sola volta senza polling: CourtWatch Shield https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190856079 (in_progress); Court Watch global D1 incremental policy https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190856188 (success); Court Watch v3 FITP player entries https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190886889 (queued); Court Watch global D1 incremental policy https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190876534 (in_progress); pages build and deployment https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38190875726 (in_progress). Nuovo esito E2E non ancora certificato.


## 12 ottobre 2026 — TCL: ripristino scroll dopo il caricamento definitivo

- Run 38190856079, job 114623106077 indicato dall’utente: timeout alla riga 163, verifica della posizione nel ritorno Calendario Altri → Calendario TCL. Il passaggio iniziale TCL → Altri e la conservazione di mese/filtro avevano superato i controlli precedenti.
- Il vecchio ripristino avveniva una sola volta con il layout della cache; il caricamento definitivo poteva modificare il layout/scroll successivamente. Ripristino ora completato anche dopo il primo caricamento definitivo, una sola volta. Wheel, touchmove, pointerdown, keydown e cambio route cancellano il ripristino tardivo, evitando di sovrascrivere un’interazione dell’utente; i refresh successivi non lo riapplicano. Nessuna modifica al controllo E2E della posizione.
- Asset JS aggiornato. Regressioni su cache → layout finale, refresh e input/cambio pagina, più test navigazione/calendario; esito del nuovo browser Shield da attestare. Report nello stesso commit.

- PR #130 https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/pull/130 integrata, merge a6be7908491fe5df606bbd1d4c82003651282c5e. 17 test navigazione/cache e 2 test refresh passati, release guard passato. Run letti una sola volta senza polling: CourtWatch Shield https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191164956 (in_progress); Court Watch global D1 incremental policy https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191164874 (success); Court Watch global D1 incremental policy https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191172158 (in_progress); pages build and deployment https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191171842 (in_progress). Esito E2E/deploy ancora da confermare; nessuna dichiarazione di verde sul solo successo dei test locali.

- Chiusura 12 ottobre 2026, 03:16 Europe/Rome: l’utente conferma «tutti verdi» per i run della correzione TCL. Registrata la conferma senza polling/rilanci: Shield https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191164956 ; GitHub Pages https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191171842 ; policy https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/38191164874 . Intervento TCL concluso: etichetta TCL e navigazione speculare con mantenimento pagina/date/filtri/posizione; nessuna ulteriore modifica applicativa in questa chiusura.

## 12 ottobre 2026 — Rollback runtime Altri richiesto dall’utente

- Il deploy 38190705812 è verde ma l’utente conferma che Altri resta inutilizzabile: nessun ripristino live attestato.
- Su richiesta esplicita, ripristinati i file runtime snapshot, aggiunte personali, ricerca, storia personale e avversari dalla versione 048ede8a9ca6231994241de6e2c562babfb1e738 precedente alla PR #120. Ripristinati anche i relativi test e comando check di quella versione. Nessuna cancellazione di giocatori o dati D1; aggiornamenti TCL concorrenti conservati.
- Validazione: 34 test mirati aggiunte/ricerca/snapshot passati; controllo completo Worker ripristinato completato con successo. Test specifici delle funzionalità Sala ritirate non attestano il runtime precedente e non fanno parte del suo comando check. Nessuna dichiarazione di funzionamento live sulla sola base dei test.
- Limite: i dati acquisiti restano presenti; il rollback del codice può esporre lo storico che era già previsto nella versione precedente. Risultati FITP/ITF richiedono verifica separata; priorità ripristino dell’app.
