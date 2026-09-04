# Court Watch v3 — report completo di progetto e passaggio di consegne

Revisione documento: **2026-09-04.111**

- 4 settembre 2026 — Rettificato il primo gate successivo alla correzione cookie Tennis Europe: il run `33825290937` ha dimostrato che la nuova sessione legge correttamente le liste su tutte le shard, ma alcuni tornei a squadre privi di una pagina Acceptance list rispondono legittimamente con HTTP 302. Il controllo non tratta più ogni 302 come errore tecnico; restano bloccanti la ricomparsa effettiva della cookie wall, i timeout e gli errori di acquisizione. La distinzione impedisce sia falsi verdi sia falsi rossi.

- 4 settembre 2026 — Risolto il blocco ripetuto del workflow Tennis Europe live. Gli artefatti del run `33824046036` dimostravano che tutte le 16 shard terminavano formalmente, ma 15 ricevevano HTTP 302 verso la cookie wall e acquisivano zero liste; il solo shard con sessione valida leggeva 5.048 partecipanti. La sessione di consenso ora segue i redirect, conserva tutti i cookie `Set-Cookie`, legge e invia il solo consenso tecnico disponibile e verifica con uno smoke test che la cookie wall non ricompaia. Inoltre una shard con errori termina esplicitamente con exit code 2: un accesso incompleto non può più essere dichiarato riuscito né arrivare al merge. L'ultima copia valida resta protetta fino a una pubblicazione integralmente verificata.

- 4 settembre 2026 — Agenda Tennis Europe: mantenuto nel corpo soltanto il nome del torneo, senza ripetere il luogo già disponibile nella scheda torneo; numero/nome del campo spostato sotto l'orario nella prima colonna. Il parser Europe live e storico conserva ora esplicitamente il qualificatore ufficiale `Not before` nel campo booleano `notBefore`; il renderer lo presenta come `N.B. HH:MM` e riconosce anche record compatibili nei quali la frase sia incorporata nell'orario. Gli orari realmente mancanti restano `—`.

- 3 settembre 2026 — Ripristinata su richiesta la dimensione originaria delle bandiere (`18×12 px`), mantenendo il nuovo SVG messicano piatto e correttamente decodificabile.

- 3 settembre 2026 — Individuata con verifica sul sito pubblicato la causa della bandiera messicana invisibile: `flags/mx.svg` terminava con errore di codifica e l'immagine risultava completa ma con dimensioni naturali zero. Introdotto `mx-flat.svg`, SVG pulito e rettangolare, collegato esplicitamente a `MEX`; dimensione visiva portata da 18×12 a 24×16 pixel. Confermata inoltre sul sito la classifica corrente di Anna Gambarini `3.4`, proveniente dalla fonte canonica `players.json`.

- 3 settembre 2026 — Nella pagina giocatore le partite restano raggruppate per torneo, ma ciascuna partita occupa ora una singola riga a tutta larghezza, coerentemente con la pagina torneo.

- 3 settembre 2026 — Le bandiere delle nazionalità sono nuovamente rettangolari e piatte: rimossa la resa emoji ondulata e adottato un elemento `<img>` esplicito verso gli SVG locali, evitando il precedente problema dello sfondo CSS invisibile.

- La configurazione pubblica `players.json` è inoltre la fonte canonica dei profili nel client anche quando la proiezione D1 è più recente; D1 non può quindi più far oscillare temporaneamente classifica, circolo o tessera del giocatore.

- 3 settembre 2026 — Consolidata navigazione e consistenza dell'agenda. Le bandiere usano ora emoji Unicode derivate dal codice IOC/ISO e non dipendono dal caricamento di un asset SVG; il caso `MEX → MX` mostra quindi sempre la bandiera messicana. Corretto il generatore D1 dei giocatori: `players.json` corrente ha precedenza su `data.json` legacy, che aveva temporaneamente sovrascritto classifiche aggiornate (per esempio Anna Gambarini 3.4 e Daniele Gelli 3.5) con valori vecchi. In agenda il clic sulla scheda match apre il torneo, mentre il nome del giocatore apre la sua pagina. Nella pagina torneo il nome del giocatore apre la relativa pagina. La pagina giocatore è ora una singola colonna di tornei, con le rispettive partite raggruppate sotto ciascun torneo. Il fallback Europe introdotto nella revisione precedente resta permanente nel client e conserva l'ultima raccolta valida contro risposte D1 vuote o transitorie.

- 3 settembre 2026 — Eliminata l'intermittenza dell'agenda Tennis Europe: una risposta D1 temporaneamente vuota o fallita non sostituisce più la raccolta Europe valida già caricata e conservata nella cache; D1 resta primario e una nuova raccolta Europe non vuota sostituisce normalmente la precedente. Completata l'eccezione Kufstein nello stesso schema dei match automatici con ora `11:00`, campo `CC Sparkasse`, avversario Lucca Becerra e nazionalità `MEX`, visualizzata con bandiera messicana dal renderer generale. Le future modifiche generali al rendering dell'agenda si applicano quindi anche a questo record manuale.

- 3 settembre 2026 — Inserita come eccezione persistente la finale del Bonus Draw U12 maschile di Kufstein del 25 luglio: Edoardo Grimoldi vincitore per W/O su Lucca Becerra, verificata nel tabellone ufficiale Tennis Europe. Il record manuale è un input versionato sia per il client sia per l'import D1 e non viene perso dai successivi aggiornamenti automatici. Corretto inoltre il timestamp della spia di ritardo: il client usa il più recente tra la proiezione effettivamente selezionata e i JSON essenziali, invece di fermarsi al primo timestamp disponibile. Testo di agenda, giocatori, calendario e schede reso selezionabile; una selezione attiva non attiva la navigazione interna.

- 3 settembre 2026 — Introdotta la politica persistente per gli indirizzi FITP mancanti: il P.U.C. resta primario; quando non pubblica `Address`, il merge consulta il registro versionato delle sedi verificate sul web; i tornei contenenti `Centro Estivo FITP` sono esplicitamente esenti. Ogni nuovo caso non esente e non risolto produce un warning bloccante per la completezza con URL di ricerca Google, senza dedurre automaticamente sedi ambigue. Verificati e registrati gli indirizzi dei nove tornei correnti interessati (otto sedi, con Ronchi Mare ricorrente); il Master Kinder conserva entrambe le sedi. Rebuild: 161/164 competizioni FITP uniche con indirizzo, tre sole esenzioni Centro Estivo e zero casi obbligatori irrisolti. Completata inoltre la normalizzazione visiva: circolo, indirizzo e città non restano interamente maiuscoli, mentre la sigla provinciale resta maiuscola.

- 3 settembre 2026 — Eliminato il falso lampeggio intermittente dell'indicatore di ritardo. La soglia client era esattamente 30 minuti, uguale alla cadenza nominale del workflow aggregato FITP (`17,47 * * * *`), quindi il normale ritardo di accodamento ed esecuzione di GitHub Actions faceva apparire brevemente l'avviso prima della generazione successiva. La soglia è ora 45 minuti: nessuna frequenza o acquisizione è stata modificata e non è stato aggiunto polling; un aggiornamento realmente mancato continua a produrre l'avviso.

- 3 settembre 2026 — Corretto il selettore progressivo che si richiudeva dopo la scelta dell'anno: la ricostruzione del pannello rimuoveva il pulsante originario prima che il clic raggiungesse il gestore globale, facendolo classificare erroneamente come clic esterno. I clic interni al selettore ora non propagano al documento, consentendo correttamente il percorso anni → mesi → giorni.

- 3 settembre 2026 — Sostituite le due barre temporali separate con una sola barra nell'intestazione dell'agenda: `≪`/`≫` cambiano mese, `‹`/`›` cambiano giorno e il pulsante centrale mostra la data. Rimossa la barra mesi sopra il calendario. Il pulsante data apre ora un selettore personalizzato progressivo anni → mesi → giorni, con ritorno tra i livelli; la selezione finale aggiorna insieme agenda e calendario. L'agenda mantiene lo scorrimento naturale della pagina, senza area di scroll interna.

- 3 settembre 2026 — Sostituito su richiesta lo scorrimento interno dell'agenda con una pagina a scorrimento naturale. L'agenda torna ad avere altezza determinata dal suo contenuto; la barra del calendario con titolo, mese e frecce usa ora `position: sticky` e resta in alto durante lo scorrimento, con sfondo e livello dedicati per non sovrapporsi in modo illeggibile al calendario.

- 3 settembre 2026 — Corretto immediatamente il riferimento JavaScript inesistente `dateFmt` introdotto nell'etichetta accessibile dei nuovi pulsanti-giorno. L'eccezione interrompeva `renderCalendar()` e impediva la successiva esecuzione di `renderPlayers()`, facendo sparire insieme calendario e colonna giocatori. L'etichetta ora usa il formatter esistente `fmt`; aggiornato il cache-buster del client.

- 3 settembre 2026 — Sincronizzata l'agenda con il calendario: ogni numero del giorno è ora un pulsante accessibile e il clic imposta immediatamente l'agenda su quella data, aggiornando coerentemente anche il mese quando viene selezionato un giorno esterno. Stabilizzata inoltre la posizione dei comandi del mese assegnando all'agenda un'altezza costante con scorrimento interno delle partite, così la barra del calendario non sale o scende al variare del numero di incontri. Verificati gli indirizzi FITP pubblicati: 330 relazioni hanno un indirizzo, ma soltanto due indirizzi unici contengono un civico effettivo (`Via della Repubblica 116` e `Via S. Maria Nuova 15`); `Via 2 Giugno` è una denominazione stradale. I civici forniti dal P.U.C. vengono conservati e mostrati.

- 3 settembre 2026 — Uniformata ulteriormente l'intestazione delle pagine torneo FITP: anche gli indirizzi ricevuti interamente in maiuscolo vengono presentati in forma leggibile e la località mantiene sempre la sigla della provincia in maiuscolo dopo la città (`Nome circolo, Indirizzo, Città PROVINCIA`). La modifica resta limitata alla pagina torneo e non aggiunge il circolo al calendario. Aggiornato il cache-buster del client. Elencate e ricontrollate le 12 competizioni uniche le cui 40 relazioni giocatore-torneo non hanno indirizzo perché il dettaglio ufficiale P.U.C. pubblica i relativi campi vuoti.

- 3 settembre 2026 — Verifica post-workflow del commit venue: i run verdi avevano pubblicato correttamente la mappa Tennis Europe con `TC Pully`, `TC Bachten De Kupe` e `Teniski Klub Doboj`, ma `entries-engine.mjs` continuava a costruire le 46 schede dalle sole entry di accettazione e non univa la mappa ufficiale; conseguenza misurata: 43/46 venue nella proiezione. Corretto il merge ordinario per collegare anche Tennis Europe a `source_tennis_europe_tournaments_sharded.json` tramite `competitionId`, come già avviene per ITF e FITP. La stessa verifica certifica ITF 4/4 con circolo e FITP 370/370 con circolo. Per FITP restano 40 relazioni giocatore-torneo senza indirizzo, corrispondenti a 12 competizioni uniche: non è un ritardo del workflow; per tali competizioni la risposta ufficiale P.U.C. restituisce letteralmente `Address`, `Municipality`, `Province` e `impianti` vuoti (verificato direttamente, per esempio, sul Lemon Bowl). Nessun indirizzo viene inventato o dedotto dai tabelloni; occorre acquisirlo da un'ulteriore fonte ufficiale del circolo.

- 3 settembre 2026 — Completata la correzione strutturale delle sedi torneo sui tre circuiti. ITF non usa più il campo `venue` del calendario globale come nome del circolo, perché quel campo coincide spesso con la sola città: le acceptance shard leggono ora `Venue Name` e `Venue Address` dalla pagina ufficiale già aperta per il factsheet e li propagano nelle entry; il merge ordinario privilegia tali metadati e include una verifica esplicita per i quattro tornei ITF oggi visibili (Cuneo, Niš, Szentes e Compiègne). Tennis Europe conserva ora il circolo presente nel risultato di ricerca ufficiale anche quando la homepage non viene interpretata; certificati `TC Pully`, `TC Bachten De Kupe` e `Teniski Klub Doboj`, mantenendo `Tennis Club Crema`. FITP conserva esclusivamente i metadati principali della pagina torneo P.U.C. (`TennisClub`, `Address`, `Municipality`), non i tabelloni, e non sostituisce più un circolo o indirizzo già valido con una risposta temporaneamente vuota. Nell'intestazione della pagina torneo FITP la forma è `Nome circolo, indirizzo, città`; i nomi interamente maiuscoli vengono convertiti in forma leggibile preservando sigle come ASD, SSD, SRL, TC e FITP. Il calendario continua a mostrare soltanto città e Paese. Eliminato il rebuild rapido FITP duplicato, che partiva insieme al workflow completo; i publish FITP e Tennis Europe ora si riallineano all'ultimo `main` e rieseguono `entries-engine.mjs` prima del commit, impedendo la ripubblicazione di una proiezione aggregata più vecchia. Aggiornato il cache-buster del client. Verificati sintassi di tutti i moduli modificati, assenza di riferimenti al workflow eliminato e `git diff --check`; la certificazione dei conteggi pubblici viene eseguita dopo i workflow automatici avviati dal commit.

- 3 settembre 2026 — Rimosso integralmente il `guarded isolated merge`: eliminati il workflow semiorario `.github/workflows/courtwatch-v3-merge-isolated.yml` e lo script `src/v3/merge-isolated-engines.mjs`. Il processo era un ricostruttore aggiuntivo della proiezione aggregata, non un motore di acquisizione, e scriveva gli stessi file prodotti dai workflow FITP, Tennis Europe e ITF, introducendo concorrenza e possibilità di ripubblicare snapshot meno recenti. Restano operativi i motori dei tre circuiti e `entries-engine.mjs`, richiamato dai rispettivi workflow. La precedente attribuzione dell'avviso di ritardo alla soglia di 25 giocatori non era dimostrata per l'episodio osservato dall'utente: la soglia spiegava il fallimento del singolo run `33782092308`, non necessariamente l'avviso precedente. Al momento della richiesta di rimozione l'indicatore di ritardo non era presente. Verificati riferimenti residui, workflow alternativi di pubblicazione e diff limitato alle due eliminazioni e al report.

- 3 settembre 2026 — Individuata e rimossa la causa concreta dell'avviso di aggiornamento in ritardo osservato dopo il commit venue: il merge isolato conservava un gate obsoleto di almeno 25 giocatori e terminava con exit code 2, mentre il roster attivo e corretto è di 23. Il limite di sicurezza è stato riallineato a 20 per continuare a intercettare riduzioni anomale senza bloccare il roster corrente. Il fallimento riguardava la pubblicazione della generazione aggregata, non l'acquisizione ITF; run interessato `33782092308`. La correzione viene verificata con un nuovo run del merge prima della certificazione finale.

- 3 settembre 2026 — Estesa la sede ufficiale alle schede torneo ITF e FITP mantenendo invariato il calendario, che continua a mostrare soltanto città e Paese. Il merge ITF collega ora le entry alla mappa globale ufficiale per `competitionId` e propaga `venue`; verifica locale: 4/4 tornei ITF visibili con venue, a fronte di 1.062/1.062 record della mappa sorgente dotati di sede. Per FITP il nome del circolo proviene dal catalogo ufficiale (`club`/`TennisClub`) e l'indirizzo dalla risposta P.U.C. di dettaglio (`Address`); entrambi vengono conservati nella cache, nelle entry e nella proiezione torneo. Il refresh automatico forza una nuova lettura solo per le competizioni dei giocatori monitorati che non possiedono ancora circolo o indirizzo. Verificati sintassi dei tre motori modificati e rebuild locale: 353/371 sedi FITP già recuperabili dal catalogo prima del backfill P.U.C.; le restanti sedi e gli indirizzi vengono materializzati dal workflow FITP avviato automaticamente dal push. Stato aggiornamenti verificato alle 16:54:11 UTC: 421 tornei, 371 FITP, 46 Tennis Europe, 4 ITF, zero warning; il messaggio UI “dati aggiornati con ritardo” scatta oltre 30 minuti dall'ultima generazione selezionata e può quindi apparire durante l'intervallo tra acquisizione Git e replica D1, pur senza indicare un errore del motore ITF.

- 3 settembre 2026 — Rafforzata la correzione Crema dopo il primo ciclo automatico della mappa Tennis Europe: il markup ufficiale può collocare il referente personale nella sezione della sede, quindi la sola presenza dell’etichetta Venue non è sufficiente. Il parser applica ora un controllo generale che scarta nomi propri di persona privi di termini riconducibili a una struttura sportiva e assegna priorità alle sedi ufficialmente verificate; per l’ID di Crema resta `Tennis Club Crema`. Ripristinata anche la mappa sorgente dopo che il workflow aveva ripubblicato temporaneamente `Jessica Festari`; la proiezione pubblica era rimasta corretta.

- 3 settembre 2026 — Corretta la sede del `Torneo Internazionale Under 16 - Città di Crema` (ID `6A379359-E8F3-42F4-9063-16EFB100DB7B`): `Jessica Festari` è la direttrice/contatto del torneo e non la venue; la sede verificata è `Tennis Club Crema`, Crema, Italy. Corretto anche il parser generale Tennis Europe: il testo sommario accanto alla bandiera non è più accettato come venue, perché può contenere il nome di una persona; vengono accettati soltanto campi espliciti Venue/Club/Site, con fonte ufficiale verificata quando la homepage non pubblica un’etichetta strutturata. Aggiornate la mappa sorgente e la proiezione pubblica senza modificare iscrizioni, risultati o motori decisionali.

- 3 settembre 2026 — Rettificato il perimetro di visualizzazione della sede: nelle bande del calendario tornano a comparire soltanto città e Paese tramite `cityCountry()`. Il nome del circolo/venue resta disponibile nelle pagine del giocatore e del torneo e non viene più mostrato nel calendario. Mantenute la conservazione integrale di `location` durante il raggruppamento e la deduplicazione della sede nella pagina torneo. Aggiornato il cache-buster di `v3.js`.

- 3 settembre 2026 — Corretto il mancato aggiornamento percepito della mappa dopo la revisione venue: `v3.html` manteneva invariato il parametro di versione di `v3.js`, consentendo al browser di riutilizzare il client precedente. Aggiornato il cache-buster del client e irrobustita `tournamentPlace()` contro duplicazioni già presenti all’interno della singola stringa `location`; `Sportaktivpark Bad Waltersdorf` viene ora mostrato una sola volta. Report aggiornato nello stesso commit come richiesto.

- 3 settembre 2026 — Corretta la visualizzazione della sede nella mappa/calendario: il client non riduce più `location` a sola città e Paese durante il raggruppamento e usa `tournamentPlace()` anche nelle bande del calendario. La funzione elimina le duplicazioni quando `location` contiene già `venueName`; per Bad Waltersdorf viene quindi mostrato una sola volta `Sportaktivpark Bad Waltersdorf, Bad Waltersdorf, Austria`. I dati sorgente e i motori non sono stati modificati. Regola operativa permanente: ogni modifica applicativa deve aggiornare questo report nello stesso commit.

- 3 settembre 2026 — Interfaccia torneo: navigazione dal calendario alla pagina del torneo, match raggruppati per giocatore, date `gg-mm-aaaa`, luogo e data con icone, collegamento alla fonte ufficiale, nazionalità limitata ad avversari e compagni internazionali. Il report è aggiornato per revisioni operative e non costituisce un indicatore live dello stato dei motori.
- 3 settembre 2026 — Corretto il criterio della sede nella pagina torneo: il campo OOP non viene più utilizzato per dedurre il circolo. La sede proviene esclusivamente dai metadati ufficiali del torneo; per `Bad Waltersdorf 2026 - Indoor` è stata verificata e impostata `Sportaktivpark Bad Waltersdorf`, con località `Bad Waltersdorf, Austria`. Verificata inoltre la conservazione dei risultati terminali `W/O` come partite concluse.
- 3 settembre 2026 — Generalizzata la correzione della sede a tutti i tornei: ogni shard Tennis Europe acquisisce `venueName` dalla homepage ufficiale del torneo, lo conserva nel database permanente e lo propaga nelle entry; ITF continua a usare la sede fornita dall'API ufficiale del torneo. Rimossa l'eccezione applicativa specifica per Bad Waltersdorf. OOP non è una fonte ammessa per sede o circolo.
- 3 settembre 2026 — Corretto il parser generale delle sedi Tennis Europe sul formato reale delle homepage: accesso diretto alla rotta canonica `/tournament/{competitionId}` e lettura del nome dalla sezione `Venue`. Il precedente accesso alla rotta legacy riceveva un redirect non seguito e lasciava vuoto `venueName`, mostrando quindi soltanto città e Paese.
- 3 settembre 2026 — Risolto il successivo collo di bottiglia di pubblicazione: la mappa Tennis Europe conteneva correttamente `venueName` (529 tornei su 598 nel ciclo campione), ma il merge isolato ricostruiva i tornei dalle vecchie entry di accettazione, perdendo sede e luogo ufficiali. Il merge ora unisce ogni entry alla mappa sharded tramite `competitionId` e conserva `venueName` anche nella proiezione `tournaments.json`.
- 3 settembre 2026 — Rifinitura pagina torneo: icona calendario mantenuta solo nell'intestazione e bandiere rese come sfondi SVG locali per eliminare i riquadri vuoti di Safari.

- 2 settembre 2026 — Uniformata la presentazione degli incontri Tennis Europe nell'agenda: nei doppi il compagno compare sulla stessa riga del giocatore (`giocatore / compagno`), compagno e avversari conservano le rispettive nazionalità nel formato `(SWE) 🇸🇪`, e i set conclusi vengono orientati sempre con la squadra vincitrice a sinistra. Il colore continua a rappresentare l'esito del giocatore monitorato: verde se vincente, rosso se sconfitto. La modifica riguarda proiezione Europe e interfaccia, non acquisizione, archivio o motori.

- 2 settembre 2026 — D1 nuovamente certificato end-to-end dal run `33669831186`, verde dopo l'indicizzazione delle chiavi esterne `tournament_id` di schedules, matches e results (PR `#41`). La correzione elimina il timeout durante la sostituzione della generazione universale. Import, parità, deploy Worker e API risultano completati; il workflow Agenda Europe era già verde, quindi partite e avversari Europe sono nuovamente disponibili tramite D1/API. Verifica ITF→D1 conclusa. Resta da produrre una nuova copia locale sul Mac per certificare materialmente D1 aggiornato, Europe e i sei componenti ITF.
- 2 settembre 2026 — Risolta la causa dell'esaurimento delle letture D1 gratuite. La pagina admin aggiornava ogni cinque minuti e, anche fuori dalla vista Database, eseguiva due scansioni dell'intera tabella `observed_players` (circa 96.700 righe per scansione): una singola apertura persistente poteva quindi consumare circa 193.000 letture per ciclo. PR `#35`, commit `b4fa67c4ccf8965ec8858d63e8b05566c0e4b79d`: i conteggi riepilogativi provengono ora dal manifest della generazione, la query Database viene eseguita soltanto nella relativa vista e il totale non filtrato usa l'indice `rowid`. Il Worker compatibile è stato pubblicato dal run `33661706841`; migrazione, reimport completo e verifica di parità restano temporaneamente bloccati dal limite giornaliero già consumato e devono essere certificati dopo il reset delle 00:00 UTC. Finché la parità non torna verde, `/health` può servire l'ultima generazione valida ma `/v1/app-snapshot` non è considerato certificato.
- 2 settembre 2026 — Colmato il vuoto tra il nuovo motore ITF e il disaster recovery. Prima della PR `#36`, R2 conservava soltanto partecipanti, giocatori e risultati; lo stato T−1, le relazioni giocatore–torneo e l'audit aggiornato restavano soltanto su Git. Dal commit `cb2a3529fb8412f4382ed4adb8dfa6f2433bf868` ogni nuova generazione `itf/database` comprende e verifica sei componenti: cache partecipanti, database giocatori, database risultati, stato tabelloni/T−1, relazioni giocatore–torneo e audit. Il restore resta compatibile con le generazioni precedenti senza sovrascrivere uno stato Git più recente.
- 2 settembre 2026 — Rafforzato il backup locale settimanale: oltre all'integrità SQLite e ai prefissi R2 già richiesti, controlla che la generazione ITF corrente contenga i sei componenti, valida JSON e gzip, registra i conteggi ITF presenti in D1 e richiede almeno un'anagrafica ITF osservata. La procedura è pronta; la certificazione materiale della nuova copia resta necessariamente da eseguire sul Mac/NAS autorizzato, perché nessuna macchina GitHub può attestare un file locale che non ha scaricato.
- 2 settembre 2026 — Corretto il classificatore Tennis Europe OOP per gli incontri con punteggio parziale: rimangono `in_progress` (o `scheduled` quando non ancora iniziati) e diventano `completed` soltanto con marcatore ufficiale o punteggio conclusivo valido. Correzione PR `#34`, commit `05cadb7`; ultimo flusso OOP verificato verde: run `33651379027`.

- 1 settembre 2026 — Certificazione finale del motore ITF: run produttivo `33553773493` completamente verde, 47 tornei completi, 19 pending esclusivamente di pubblicazione, zero pending tecnici e zero errori Incapsula. Il buco dei 17 tornei è chiuso secondo le regole centralizzate; lo storico resta validato a 1.064/1.064 tornei. Le qualificazioni vuote diventano terminali quando il main draw o i gruppi round robin sono pubblicati; per i tornei round robin sono richiesti qualificazioni e gruppi, non il knock-out.
- 1 settembre 2026 — Isolati i trigger produttivi ITF con PR `#17`, commit `f5ff982cca984ea126ae81d85e06389dec91ffc0`. Rimossa la cascata per cui una modifica ai file condivisi avviava simultaneamente T−1, acceptance completa, acceptance rapida, safety 120 giorni, mappa globale e backfill. Restano automatici: T−1 ogni 15 minuti, acceptance completa e rapida circa ogni 14 minuti, mappa globale ogni 6 ore e safety 120 giorni una volta al giorno. Il vecchio fast backfill è soltanto manuale. Acquisizione, retry, validazione, persistenza e pubblicazione R2 non sono stati modificati.
- Punto aperto separato dal motore ITF: verificare end-to-end che una nuova acquisizione sia presente anche nella replica D1 e nella prima copia locale settimanale; il backup locale diventa effettivo soltanto quando lo script viene eseguito sul computer/NAS autorizzato.\n\n- 1 settembre 2026 — Secondo passo generale del riordino ITF certificato in read-only dal run 33536754981. Individuato e corretto sul branch di prova un rischio futuro indipendente dai casi noti: l'inventario distingueva `tournamentId` e `weekNumber`, mentre coda/cache potevano ridurre due sezioni omonime al solo codice evento. Introdotta l'identità stabile `evento@tournamentId:weekNumber`, propagata da inventario a task isolato e coda con compatibilità per le cache legacy non ambigue. Il test sintetico crea due `G-S-Q-KO` di settimane diverse e certifica due task distinti, impedendo che un tabellone futuro venga saltato o sovrascritto. La promozione resta bloccata finché la stessa identità non viene verificata anche nel merge/persistenza e nell'audit completo.\n\n- 1 settembre 2026 — Avviato il riordino integrale del motore ITF sul branch `test/itf-engine-order`. Finlandia `J-J30-FIN-2026-004__G-S-Q-KO` è definitivamente classificata `declared_but_unused`, insieme a Dushanbe e Tacarigua; Male e Panama restano esclusi dal registro perché possiedono qualificazioni reali. Introdotto un gate finale post-persistenza: ogni tabellone acquisito viene prima conservato e pubblicato indipendentemente, quindi il run diventa rosso se resta almeno un errore tecnico, emettendo gli ID tecnici separati dai tabelloni semplicemente non disponibili/incompleti. Il contratto read-only è certificato dal run 33536110617: registro terminale corretto, pending di pubblicazione ammesso, errore tecnico obbligatoriamente bloccante. Nessuna modifica produttiva ancora promossa.\n\n- 1 settembre 2026 — Il run read-only 33535411670 è verde a livello GitHub ma non certifica le tre verifiche: Male ha confermato che soltanto `weekNumber=0` possiede l'evento (8 match scheletro, zero riferimenti giocatore reali; settimane 1–3 vuote), mentre Panama e Finlandia hanno fallito `GetEventFilters` per `incapsula_challenge`. Il verde è quindi un falso positivo del workflow diagnostico, che cattura gli errori per produrre l'artifact ma non applica un gate finale. Direzione unica: (1) rendere rosso ogni test con un errore tecnico richiesto; (2) recuperare la copia popolata delle qualificazioni Male/Panama senza terminalizzarle; (3) rieseguire l'audit complessivo e pubblicare una sola tabella `risolto / dati non disponibili / errore tecnico`. Nessuna modifica produttiva deriva da questo run.

- 1 settembre 2026 — Correzione della revisione .69 dopo verifica diretta dell'utente: Male e Panama possiedono match reali nei rispettivi tabelloni di qualificazione. Le risposte `GetDrawsheet` con 8 match e 32 riferimenti tutti nulli dimostrano che il motore raggiunge una copia scheletro, non che il tabellone sia inesistente. Male e Panama restano `pending` e non devono essere `declared_but_unused`; il test che li classificava terminali è ritirato e non va promosso. Dushanbe e Tacarigua restano gli unici terminali produttivi confermati. Avviato il run read-only 33535411670 per confrontare inventario ufficiale e varianti `weekNumber` 0–3 senza scrivere su database o R2.

- 1 settembre 2026 — Chiusura produttiva del buco per le sezioni inesistenti certificata dal run 33533384990 e persistita nel commit automatico 3704ef78: Dushanbe e Tacarigua sono completi con una `declared_but_unused` ciascuno, zero richieste residue e zero errori tecnici nel lotto. Stato globale emesso dal run: 44 tornei completi, 22 pending, dei quali 2 tecnici (J-J30-DEN-2026-004 e J-J30-SVK-2026-004) e 20 classificati come pubblicazione. Nel buco restano soltanto Male e Panama, i cui G-S-Q-KO contengono match ma non nomi normalizzati. Avviata una diagnosi read-only dello schema grezzo su Male, Panama e sull'anomalia storica Finlandia; obiettivo successivo: correggere il parser, rielaborare le tre sezioni e produrre l'elenco completo dei pending residui con motivo verificabile dall'utente.

- 1 settembre 2026 — Il primo collaudo read-only delle sezioni inesistenti, run 33492650181, è risultato rosso esclusivamente per un gate di cardinalità obsoleto: il workflow pretendeva 8 tornei, mentre il selettore ne aveva correttamente inclusi 6 perché due ID richiesti erano già completi. La funzione verificata ha avuto esito corretto: Dushanbe e Tacarigua hanno richiesto zero sezioni, registrato una `declared_but_unused` ciascuno, raggiunto missing=0 e decisione complete; zero errori tecnici. Il gate confronta ora il totale aggregato con il numero effettivamente selezionato. Nuovo collaudo read-only: run 33493010050.

- 1 settembre 2026 — Su indicazione verificata dell'utente, J-J30-TJK-2026-005__G-S-Q-KO (Dushanbe) e J-J60-TTO-2026-002__G-S-Q-KO (Tacarigua) non corrispondono a qualificazioni realmente disputate. Preparata la classificazione terminale esplicita `declared_but_unused`: le due sezioni restano contabilizzate rispetto all'inventario ITF, ma vengono tolte dalla coda e non sono più richieste; nessun torneo o tabellone valido viene cancellato. Collaudo read-only avviato sul run 33492650181, con gate esatto di due sezioni terminali e zero errori tecnici; promozione produttiva subordinata al verde comunicato dall'utente.

- 1 settembre 2026 — Male (J-J30-MDV-2026-004) e Panama (J-J30-PAN-2026-002) si sono disputati entrambi dal 24 al 29 agosto 2026. L'analisi degli artifact del run produttivo 33487375087 dimostra che i rispettivi G-S-Q-KO non sono vuoti: ciascuno contiene 8 match e 32 slot giocatore, ma tutti i dati nominativi normalizzati sono vuoti. Se il sito mostra i nomi, la causa è nell'estrazione/schema del parser oppure nella risposta scheletro dell'endpoint usato, non nella mancata pubblicazione del tabellone. Queste due sezioni non devono essere rese terminali o cancellate: occorre acquisire la risposta grezza e correggere la normalizzazione prima di certificarle.

- 1 settembre 2026 — Chiarita la natura dei quattro residui del buco e dell'anomalia Finlandia. Per Male, Panama, Dushanbe e Tacarigua l'endpoint ITF dichiara `G-S-Q-KO`, ma il Drawsheet restituisce zero giocatori; `not_published_or_incomplete` è quindi una classificazione conservativa della risposta, non la prova che un torneo concluso possieda realmente un tabellone incompleto. È possibile che la qualificazione dichiarata nei filtri non sia stata disputata/usata; il motore attuale non può ancora renderla terminale perché, a differenza delle alternative KO/RR, la famiglia `G-S-Q` non ha una struttura sorella popolata che lo dimostri. Caso distinto `J-J30-FIN-2026-004__G-S-Q-KO`: l'artifact storico non è vuoto e contiene 24 match e 96 riferimenti giocatore, ma zero nomi estratti; è un difetto di normalizzazione del vecchio parser, non un tabellone mancante. Lo storico resta completo come archivio tecnico, ma la rosa nominativa di quella singola sezione non è ancora affidabile finché il parser non viene corretto e l'artifact rielaborato senza sovrascrivere l'originale.

- 1 settembre 2026 — Secondo e terzo ciclo produttivo del batch T−1 ufficiale, run `33483254212` e `33487375087`, entrambi verdi e persistiti su `main`; l'ultimo stato T−1 è nel commit automatico `07799ab` (`Publish validated ITF T-1 decisions`). Il buco dei 17 tornei è passato da 4 completi/13 pending a **13 completi/4 pending**. Sono ora salvate **98 sezioni popolate** e registrate **23 alternative terminali**; restano soltanto quattro sezioni `G-S-Q-KO` con `failureType=not_published_or_incomplete`, una ciascuna per Male, Panama, Dushanbe e Tacarigua. Nel buco risultano quindi **0 errori tecnici**: tutti i tabelloni disponibili sono acquisiti e conservati, mentre i quattro tornei residui restano in retry esclusivamente perché la qualificazione femminile ufficiale è vuota/non pubblicata. La fotografia persistita è stata verificata su `main` alle 08:32 UTC; i successivi workflow acceptance/live non hanno degradato gli stati T−1.

- 1 settembre 2026 — Primo ciclo produttivo del batch T−1 ufficiale, run `33479458678`, verde e persistito su R2 e `main` nel commit automatico `c580ed1`. Il database globale è passato da 26 completi/40 pending a 32 completi/34 pending; i pending tecnici sono scesi da 18 a 13 e quelli di pubblicazione da 22 a 21. Il lotto ha controllato otto tornei con 0 errori tecnici: Barcelona, Nuevo Leon, Skopje, Cluj Napoca, Cairo e San Jose sono diventati completi; Male e Panama restano pending con una sola sezione ufficiale non pubblicata ciascuno. Nel buco dei 17 tornei risultano ora 4 completi e 13 pending, di cui 10 tecnici preesistenti e 3 di pubblicazione; sono persistite 34 sezioni popolate e 10 alternative terminali. I tornei completi escono dalla coda; i successivi cicli ogni 15 minuti continuano sui soli pending.

- 1 settembre 2026 — Collaudo definitivo read-only del batch T−1, run `33478724544`, verde: 8 tornei, 63 sezioni dichiarate, 31 acquisite, 7 alternative ufficiali inutilizzate risolte, 38 sezioni risolte complessive, 25 `not_published_or_incomplete`, 0 artifact mancanti e 0 errori tecnici. Nuevo Leon e Megrine risultano completi; San Miguel de Tucumán, Adelaide, Male, McKinney, Burgas e Tacarigua restano pending esclusivamente per sezioni ufficiali vuote. Il gate prova quindi contemporaneamente inventario esaustivo, conservazione dei successi, uscita delle alternative dai retry, distinzione tecnico/pubblicazione e retry dell’infrastruttura artifact. Autorizzata la promozione del batch produttivo fino a otto tornei ogni 15 minuti; la prova resta read-only e non viene usata come prova della persistenza del buco.

- 1 settembre 2026 — Secondo batch read-only `33476025777`: review finale riuscita con 8 tornei, 2 completi, 6 pending, 63 sezioni dichiarate, 31 acquisite, 7 alternative inutilizzate risolte, 38 risolte complessive, 25 mancanti e 0 errori sorgente rilevati. Il run complessivo è rosso per un solo guasto infrastrutturale: l’upload artifact di `J-J60-BUL-2026-002__G-S-M-RR` ha trasferito 396 byte ma GitHub ha restituito `403 Forbidden` durante `FinalizeArtifact`. La sezione era stata letta correttamente come `not_published_or_incomplete`; nessun parser o endpoint ITF è fallito.

- 1 settembre 2026 — Corretto il falso “zero tecnico” in presenza di artifact assente: audit v14 classifica ora ogni sezione dichiarata senza cache e senza artifact come `draw_artifact_missing` / `technical_error`, la include in `missingArtifactSections` e impedisce il gate zero-errori. Nei workflow di prova e produzione il primo upload artifact è tollerato soltanto per consentire un secondo tentativo con nome indipendente; se anche il retry fallisce, il job e il run restano rossi. Nuovo collaudo read-only richiesto prima della promozione.

- 1 settembre 2026 — Run read-only del nuovo batch T−1 su otto tornei, `33475034119`, certificato verde dall’utente: 63 sezioni ufficiali dichiarate, 31 già disponibili o acquisite, 32 risposte senza giocatori e 0 errori tecnici. Il test ha verificato otto inventari indipendenti, runner isolati per le sole sezioni irrisolte e conservazione delle sezioni già popolate. Essendo read-only, il run non ha pubblicato su R2, database o `main`. La fotografia ufficiale successiva di `history/itf_draw_target_db.json`, generata alle 05:51 UTC, contiene 65 stati torneo: 25 completi e 40 pending.

- 1 settembre 2026 — Il batch verde ha evidenziato una distinzione necessaria già provata nell’audit storico: sette delle risposte vuote sono strutture KO/RR alternative appartenenti a famiglie con una struttura sorella popolata. Il merge T−1 è stato quindi portato ad audit v13: ogni sezione dichiarata deve essere richiesta almeno una volta, ma una risposta vuota con sorella popolata viene registrata terminalmente come `unused_alternative_structure`, esce dai retry e non è contata come acquisita; solo le sezioni realmente popolate sono `acquired`. Una risposta vuota senza sorella popolata resta `not_published_or_incomplete`, mentre rete, parsing e Incapsula restano `technical_error`. La coda v4 esclude dai cicli successivi sia le sezioni acquisite sia le alternative terminali, continuando a ritentare esclusivamente gli irrisolti. Modifica ancora da ricertificare in un secondo run batch prima della promozione produttiva.

- 1 settembre 2026 — Secondo audit storico read-only, run `33460318995`, verde: tutte le 452 strutture RR senza giocatori hanno un KO popolato nella stessa famiglia e sono quindi alternative ufficiali non utilizzate, non tabelloni mancanti. Resta una sola anomalia non coperta, `J-J30-FIN-2026-004__G-S-Q-KO`: l'artifact contiene 24 match e 96 riferimenti giocatore, ma nessun nome estratto dal vecchio parser. L'archivio è completo a livello di famiglie ufficiali salvo questa singola estrazione nominativa, da recuperare senza modificare gli artifact originali.

- 1 settembre 2026 — Audit read-only rigoroso dell'archivio storico ITF, run `33460108446`, completato sui 4.291/4.291 artifact R2 con checksum validi, 0 mancanti, 0 retry e 0 illeggibili. Con il nuovo criterio “almeno un giocatore”, 3.838 sezioni risultano popolate e 453 senza giocatori. Le sezioni vuote sono 235 `B-S-M-RR`, 217 `G-S-M-RR` e una `G-S-Q-KO`; le 452 RR hanno anche zero match e appaiono strutture alternative non utilizzate, mentre `J-J30-FIN-2026-004__G-S-Q-KO` contiene 24 match ma zero giocatori estratti e richiede indagine mirata. Lo storico resta integro come archivio tecnico 4.291/4.291, ma non viene più definito 100% popolato finché le alternative RR non sono incrociate con i corrispondenti KO e l'anomalia FIN non è risolta.

- 1 settembre 2026 — Primo ciclo produttivo dopo il gate anti-vuoto, run `33459104367`, verde: J100 Istanbul ha dichiarato 6 sezioni, tutte 6 realmente popolate e persistite; 0 retry, 0 errori tecnici e 0 sezioni non pubblicate/incomplete. Il totale globale è salito a 21 tornei completi. I 17 tornei del buco restano esplicitamente non certificati finché non saranno rielaborati e salvati nel database con questa stessa regola rigorosa; la precedente prova read-only 125/125 non viene usata come prova di persistenza.

- 1 settembre 2026 — Correzione dei tabelloni vuoti certificata sul torneo in corso J30 San Miguel de Tucumán, run `33458855019` verde: 8 sezioni dichiarate, 3 già acquisite preservate, soltanto 5 richieste; tutte e 5 le risposte senza giocatori sono rimaste `not_published_or_incomplete`, 0 errori tecnici, 0 rimozioni e decisione correttamente `pending` 3/8. Il motore operativo richiede ora contenuto popolato prima di salvare una sezione come acquisita e distingue esplicitamente `technical_error` da `not_published_or_incomplete`. Correzione pubblicata con commit `4c9a97fa`.

- 1 settembre 2026 — Primo ciclo operativo del nuovo T−1 storico, run `33457808699`, certificato verde. J60 Arlon: 6 tabelloni dichiarati, 6 richiesti, 6 acquisiti e salvati, 0 mancanti e 0 retry; torneo passato a `complete`. Lo stato globale è salito a 19 tornei completi e conserva 38 pending (37 tecnici e 1 di pubblicazione), che restano nella coda persistente e saranno elaborati uno per ciclo senza ritentare i tabelloni già acquisiti.

- 1 settembre 2026 — Certificato in prova il riuso integrale del metodo storico per i tabelloni T−1: run `33457103374` verde sui 17 tornei conclusi rimasti nel buco, 125 tabelloni dichiarati, 125 artifact unici e completi, 0 retry, 0 mancanti e 0 illeggibili. Preparata l'integrazione operativa: inventario ITF completo, un runner isolato per tabellone con `acquire-itf-history-draw-task.mjs`, conservazione cumulativa dei successi e retry esclusivo dei falliti. I pending non escono più dalla coda alla data finale. Nessun endpoint OOP o risultati viene interrogato dal flusso.

- 31 agosto 2026 — Rafforzata la pianificazione locale contro Mac spento/logout: il LaunchAgent usa ora `run-backup-if-due.sh`, viene valutato la domenica alle 04:30 e anche al successivo login (`RunAtLoad`). Se `latest.txt` indica un backup riuscito con meno di sei giorni, termina senza scaricare; se la copia manca o è scaduta, esegue immediatamente il backup completo. Un appuntamento perso viene quindi recuperato al primo accesso dell'utente, senza duplicare copie recenti.

- 31 agosto 2026 — Installazione locale settimanale completata con successo sul Mac dell'utente: plist `com.courtwatch.weekly-backup` validato da `plutil`, LaunchAgent caricato e pianificato ogni domenica alle 04:30 ora locale. Log persistenti in `~/CourtWatch-backup/logs/weekly.log` e `weekly-error.log`. Obiettivo backup locale concluso: prima copia D1+R2 verificata e aggiornamento ricorrente configurato.

- 31 agosto 2026 — Completata e verificata la prima copia locale esterna: snapshot R2 `20260831T212914Z` con tutti i sei prefissi, almeno 17 blocchi storici ITF e manifest; la copia D1 certificata precedente è stata preservata. Rinnovato il login OAuth Wrangler e ricertificata la visibilità remota di `courtwatch-app`. Aggiunto installer macOS `launchd` per backup completo settimanale ogni domenica alle 04:30, con profilo R2 locale e log separati; l'installazione non lancia immediatamente una nuova copia.

- 31 agosto 2026 — Certificata la prima copia locale D1: export SQL 225 MB, SQLite generato, `PRAGMA integrity_check=ok`, 20 tabelle applicative locali uguali alle 20 remote e checksum SHA-256 prodotti. Completato lo script per l'obiettivo di disaster recovery: oltre a `fitp/cache`, `itf/database` e OOP Europe, copia ora anche `itf/history-draws` e `tennis-europe/cache`. Il processo fallisce se uno dei sei prefissi è vuoto o se lo storico ITF contiene meno dei 17 blocchi certificati. Token R2 di sola lettura creato dall'utente; prima copia R2 e automazione settimanale ancora da eseguire.

- 31 agosto 2026 — Il primo collaudo granulare, run `33437099244`, è terminato verde ma non ha recuperato nuove sezioni: 4 artifact, 4 richieste, 0 nuove cache, 18 tornei completi. Il conteggio 32 tecnici/5 pubblicazione era inoltre falsato perché `deferred_isolated_section` (sezione intenzionalmente assegnata a un altro runner/ciclo) veniva contato come errore tecnico; il merge ora esclude esplicitamente tale marcatore dalla classificazione. La strategia granulare non viene dichiarata risolutiva sulla base di questo run; Incapsula resta il problema aperto.

- 31 agosto 2026 — Poiché il primo run post-correzione (`33436282033`) ha certificato la persistenza dell'audit v9 ma ha lasciato invariati 18 completi, 31 pending tecnici e 6 pending di pubblicazione, l'acquisizione T−1 è stata resa granulare per sezione. Quattro runner isolati elaborano due tornei e, per ciascuno, due sole sezioni mancanti su sessioni separate; la pressione scende dalle 16 richieste tabellone del run precedente a un massimo di 4, mentre aumentano le origini/sessioni indipendenti. Il merge unisce esplicitamente `eventCache` quando due artifact riguardano lo stesso torneo, impedendo perdite tra successi paralleli. Storico, acceptance, withdrawn, database, mappa e regole decisionali non sono modificati.

- 31 agosto 2026 — Eliminata la regressione che riportava indietro audit e stato ITF T−1. Prova dalla cronologia Git: il commit T−1 `53a1d273` aveva pubblicato alle 19:52 UTC l'audit v9, poi il commit acceptance `c24fbcc1` lo aveva sostituito alle 20:01 con lo snapshot v8 delle 19:45. Corretti congiuntamente `known-fast`, `live` e `safety-120d`: gli snapshot acceptance non includono più `source_itf_draw_audit.json` né la vecchia diagnostica; tutti e tre fondono `itf_draw_target_db.json` in modalità `acceptance`, conservando integralmente i `tournaments` correnti; la diagnostica viene rigenerata dopo il merge contro l'audit T−1 presente su `main`. Da ora acceptance possiede soltanto target/etichette/withdrawn, mentre T−1 è l'unico proprietario di audit e stati dei tabelloni. Validazione YAML e controllo sintattico superati.

- 31 agosto 2026 — Fissato il criterio definitivo di chiusura ITF T−1: gli unici dati mancanti ammessi sono sezioni ufficiali non ancora pubblicate o realmente incomplete. Il merge calcola ora sull'intero database quattro conteggi distinti (`globalCompleteTournaments`, `globalPendingTotal`, `globalPendingTechnical`, `globalPendingPublication`) e conserva gli ID nelle due classi. Incapsula, errori di rete/parsing e sezioni disponibili ma non acquisite sono `pending tecnico`: il sistema continua a pubblicare immediatamente ogni sezione valida recuperata, ma la diagnostica resta `itf_system_operational_not_certified` e `fullyCertified=false` finché il conteggio tecnico non arriva a zero. Soltanto con zero pending tecnici può risultare certificato, anche se rimangono tabelloni ufficiali incompleti (`itf_system_certified_with_incomplete_publication`).

- 31 agosto 2026 — Estesa su richiesta dell'utente l'acquisizione cumulativa T−1 a tutte le sezioni ufficiali restituite da `GetEventFilters`, non soltanto al singolare: singolare, doppio, qualificazioni, main draw e strutture KO/RR alternative. Ogni sezione popolata viene conservata immediatamente; le sezioni mancanti/vuote/illeggibili restano da ritentare. La certificazione di completezza continua a operare per famiglia, considerando sufficiente una struttura popolata quando KO e RR sono alternative della stessa famiglia. Aggiornato anche il merge dei runner affinché conservi nell'audit finale `cachedSectionsUsed`, `newSectionsCached`, `drawRequests`, `browserFallbacks` e `browserRecoveries`. Il run cumulativo precedente `33431586297` era verde e aveva portato lo stato a 18 completi, 37 pending e 29 pending con traccia Incapsula.

- 31 agosto 2026 — Ambito ITF confermato dall'utente: ogni sezione valida ricevuta dal motore T−1 deve essere salvata immediatamente nello stesso ciclo, anche quando il resto del torneo rimane pending. In questa fase la persistenza serve esclusivamente a certificare presenza/assenza dei giocatori CourtWatch nei tabelloni; ordine di gioco, orari, campi, avversari, risultati e punteggi saranno affrontati successivamente con motori separati.

- 31 agosto 2026 — Individuata e implementata una strategia ITF alternativa senza infrastruttura esterna: completezza cumulativa per singola sezione del tabellone. Poiché Incapsula è intermittente, ogni sezione singolare popolata letta con successo viene conservata nel database T−1 con partecipanti e timestamp; i cicli successivi la riusano senza richiederla nuovamente e ritentano soltanto le sezioni vuote, mancanti o illeggibili. Il torneo può quindi diventare completo sommando letture affidabili ottenute in run diversi, senza richiedere che tutte le API rispondano nello stesso ciclo. Audit elevato a versione 8 con `cachedSectionsUsed` e `newSectionsCached`. HTML, challenge, JSON non valido e sezioni vuote non vengono memorizzati come completi; le regole conservative di conferma/rimozione restano invariate. Il collegamento sperimentale a un acquisitore esterno non è stato pubblicato.

- 31 agosto 2026 — Controllo successivo della convergenza ITF a runner isolati: ultimo run verificato `33428144909` verde. Stato globale 55 tornei, 17 completi e 38 pending; 30 pending conservano almeno una traccia Incapsula. Rispetto alla prima certificazione isolata: completi 16→17, pending 39→38, pending Incapsula 34→30. Il ciclo più recente ha lasciato entrambi i tornei del lotto pending, ma la tendenza complessiva resta positiva. Chiarito inoltre che il deploy Agenda–Calendario `33429196588` era stato cancellato dalla concurrency perché sostituito dal commit successivo; il deploy finale `33429216693` è riuscito.

- 31 agosto 2026 — Corretta la presentazione dell'Agenda sul caso Virginia Cereghini del 21 febbraio: decodifica delle entità HTML nei campi testuali (`F&#252;rstenfeld` → `Fürstenfeld`) e rimozione del cognome finale duplicato senza distinzione tra maiuscole/minuscole (`Anna Izabell Gazdig GAZDIG` → `Anna Izabell Gazdig`). Sincronizzate Agenda e Calendario in entrambe le direzioni: muovendo il giorno dell'Agenda, il Calendario passa automaticamente al relativo mese; muovendo il Calendario, l'Agenda mantiene lo stesso numero del giorno nel nuovo mese e, se inesistente, usa l'ultimo giorno disponibile (31 gennaio → 28 febbraio). Giorno e mese sincronizzati vengono salvati nello stato locale. Aggiornato il cache-busting di `v3.js`.

- 31 agosto 2026 — Primo collaudo verde della pipeline T−1 a runner isolati, run `33402570383`: 2 artifact indipendenti acquisiti e fusi, 2 tornei controllati, 1 diventato completo e 1 rimasto pending. Stato globale passato da 15 a 16 completi e da 40 a 39 pending; i pending con almeno una traccia Incapsula sono scesi da 36 a 34. Il miglioramento certifica che la separazione dei runner è efficace, ma ITF resta aperto finché la coda non converge stabilmente. I cicli automatici proseguono con due tornei per volta senza aumentare la pressione sulla fonte.

- 31 agosto 2026 — Riscritta l'acquisizione ITF T−1 come pipeline isolata a due fasi. Due job `acquire` su runner GitHub distinti elaborano un solo torneo ciascuno, mantengono il limite complessivo di due tornei per ciclo e producono artifact separati; il job `review`, serializzato con le altre pubblicazioni ITF, ripristina il database R2 corrente, fonde esclusivamente gli stati dei tornei acquisiti, riesegue validazione e proiezione e pubblica atomicamente. Aggiunti `ITF_T1_SHARD_INDEX`, audit v7 e `merge-itf-t1-isolated-runners.mjs`; fallback browser disponibile per ogni runner. Il merge è stato provato localmente con due artifact senza perdita delle entry non coinvolte. Obiettivo del nuovo collaudo: misurare se la separazione degli indirizzi/runner riduce i pending Incapsula; la macchina decisionale e le regole di rimozione restano invariate.

- 31 agosto 2026 — Primo collaudo del fallback browser T−1, run `33401448501`, tecnicamente verde ma non risolutivo: 23 tornei dovuti, lotto di 2, 0 completi, 2 pending, 1 fallback browser e 0 recuperi; 5 richieste tabellone, nessuna conferma/rimozione. Il database resta a 55 stati, 15 completi e 40 pending; 36 pending conservano almeno una traccia Incapsula. Decisione: non riscrivere la macchina decisionale T−1, che resta corretta e conservativa; separare invece acquisizione e decisione in una coda persistente con unità per torneo, runner isolati e snapshot riutilizzabili. Se runner GitHub e browser standard restano bloccati, la convergenza richiede un'origine di acquisizione stabile e autorizzata esterna a GitHub Actions; aumentare tentativi o concorrenza non è considerato una soluzione.

- 31 agosto 2026 — Dopo la correzione della proprietà bidirezionale dello stato ITF, la rotazione T−1 è risultata sana ma il database corrente contava 55 tornei controllati: 15 completi e 40 pending, dei quali 37 con almeno una challenge Incapsula e 3 con sezioni ufficiali ancora non popolate. Storico (4.291/4.291) e flussi acceptance restano invariati e certificati. Aggiunto un fallback browser limitato al workflow `Court Watch v3 ITF T-1 complete draws`: il lettore HTTP/cookie rimane primario; solo quando EventFilters o Drawsheet falliscono, `read-itf-draws-browser.mjs` apre una sessione Chromium ordinaria sul torneo e ripete le API dalla stessa sessione. Audit elevato a versione 6 con `browserFallbacks` e `browserRecoveries`. Le regole conservative non cambiano: se una famiglia resta vuota o illeggibile, il torneo rimane pending e nessun giocatore viene rimosso. Il fallback deve essere certificato dal nuovo run T−1 prima di considerare risolta la convergenza ITF.

- 28 agosto 2026 — Implementata l'architettura ITF live completa a quattro flussi. Lo scanner acceptance supporta ora `ITF_ACCEPTANCE_KNOWN_ONLY=1` per aggiornare rapidamente soltanto tornei/relazioni già note (commit `16f30e3134a0402bb938f9f8ff5fff69b0bf0fac`). Creato `verify-itf-t-minus-one-all-players.mjs`: seleziona tornei arrivati a T−1 o attivi non ancora certificati, scarica ogni sezione singolare una volta, confronta localmente tutti i giocatori CourtWatch abilitati ITF, aggiunge anche wild card/on-site alternate mai comparse in acceptance, conferma senza etichetta i presenti, conserva le entry se il tabellone è incompleto e rimuove soltanto assenze certificate; i tornei completi sono memorizzati nel database di stato per non essere riscaricati (commit `9c2793c9763520df341af029bd7e7a02b3a62d8a`). Il vecchio live è ora `Court Watch v3 ITF acceptance discovery 42d`, ogni 14 minuti, finestra +42 giorni (commit `8a5d4b28273d900b5ac6771116195c55bba3683b`). Aggiunti `Court Watch v3 ITF known labels fast`, quattro shard ogni 14 minuti sfalsati, per etichette/posizioni/withdrawn noti (commit `18984123f3526b684dac21641552472a11e58f7d`); `Court Watch v3 ITF acceptance safety 120d`, una volta al giorno alle 03:17 UTC (commit `af2f96d727d6a4eaad409402215e07f440d85cff`); `Court Watch v3 ITF T-1 complete draws`, ogni 14 minuti sfalsati (commit `3997004e6ef185819c38ff4d94c32740bbae7239`). Le acquisizioni hanno concurrency separate; soltanto i job `review`/pubblicazione condividono il gruppo seriale `courtwatch-v3-itf-publish`, evitando scritture R2 concorrenti (commit finali `b6e167c7`, `4c771822`, `058be94e`, `12a0efa3`). Run di verifica: discovery 42d `33134834216` (run 64), known fast `33134835298` (run 2), safety 120d `33134836054` (run 2), T−1 completo `33134837341` (run 2). Nessun polling: l'utente comunica gli esiti.

- 28 agosto 2026 — Controllo puntuale della lentezza del run ITF live riscritto `33133911718` (run 61): il run non è fermo nel verificatore T−1, ma nella matrice iniziale `acceptance`. Al momento osservato, shard 0 aveva terminato, sette shard erano in scansione e gli shard 8–15 erano ancora in coda. La causa immediata è `max-parallel: 8` su 16 shard, quindi due ondate; dentro ogni shard i tornei vengono letti sequenzialmente con bootstrap di sessione, ritardo minimo 650 ms e fino a cinque tentativi per lista in caso di Incapsula. Seguono inoltre 16 job di retry acceptance (massimo otto concorrenti), anche se quelli senza errori terminano rapidamente, e soltanto dopo parte `review`. Questa durata è tecnicamente coerente ma costituisce un rischio architetturale: se supera i 14 minuti del cron, `cancel-in-progress: true` può annullare la generazione al ciclo successivo. Non aumentare automaticamente la concorrenza a 16 senza prova, perché potrebbe riattivare Incapsula; prima misurare il tempo completo del run 61, poi scegliere tra ottimizzazione degli shard, retry condizionali o cadenza maggiore del tempo massimo certificato.

- 28 agosto 2026 — Riscritto il coordinamento del motore ITF live secondo il requisito definitivo concordato. La prima comparsa ufficiale in acceptance produce immediatamente una entry pubblicabile con stato `acceptance_live`, etichetta MD/Q/A, `acceptanceListPublished=true` e timestamp dell'ultimo aggiornamento; la scansione continua a leggere anche i gruppi withdrawn e una withdrawal esplicita rimuove subito la relazione dalla mappa. Commit `388bbb286ed6b898b08d82e15cbf3d1d11e507bb`. `verify-itf-draws.mjs` è stato riscritto come macchina a stati: usa la data ufficiale del torneo, non esegue richieste ai tabelloni prima di T−1, conserva etichetta e stato live prima della soglia, da T−1 cerca il giocatore nelle sezioni singolari pertinenti per genere e classificazione, conferma e rimuove l'etichetta se presente, mantiene `draw_check_pending` se le sezioni non sono complete/leggibili e rimuove solo dopo assenza certificata in tutte le famiglie pertinenti; strutture KO/RR alternative sono valutate come una famiglia e una struttura popolata rende irrilevante l'alternativa vuota. Commit `03f7571ceea92456e21cdbca1aea3bf7225f261d`. Il workflow live è stato semplificato: eliminati scansione generale risultati, 8 job retry risultati, applicazione patch risultati e discovery precoce; restano 16 shard acceptance, retry mirati, merge, macchina T−1, database R2, validazione e pubblicazione atomica. Commit finale `79fc65c69dbfcf29a64b1a2ad3cda8fee4810a4c`; run valido `33133911718` (run 61) creato. Criteri di certificazione: job `review` verde; output T−1 con `preTMinusOneDrawRequests=0`; stato `itf_t_minus_one_state_machine_complete`; diagnostica `itf_system_complete`; pubblicazione R2 e commit mappa riusciti. Il precedente run 58 appartiene all'architettura sostituita e non è più il riferimento funzionale.

- 28 agosto 2026 — Requisito funzionale ITF live ridefinito esplicitamente sul modello Tennis Europe: (1) ricerca continua dei tornei; (2) ricerca continua dei giocatori CourtWatch nelle acceptance list e aggiornamento live dell'etichetta MD/Q/A fino all'inizio del torneo; (3) persistenza interna di ogni relazione giocatore–torneo perché ITF rende indisponibile l'acceptance list quando pubblica i tabelloni; (4) soltanto da T−1 verifica della presenza nei tabelloni, con conferma senza etichetta se presente, stato pendente se la pubblicazione non è completa e rimozione solo dopo prova negativa completa/affidabile o withdrawn; (5) ordine di gioco e risultati saranno fasi successive separate. Valutazione: l'attuale motore contiene componenti riutilizzabili (catalogo, matcher acceptance, shard/retry, database versionato R2, validazione e pubblicazione atomica), ma il percorso risultati legge tabelloni anche prima di T−1 e mescola acquisizione tecnica e decisione; non corrisponde quindi esattamente al requisito. Decisione consigliata: non riscrivere l'intero motore, ma riscrivere il coordinamento live come macchina a stati e sostituire la fase tabelloni con un verificatore T−1 mirato. Il run 58 resta utile come prova del lettore/retry, ma non certifica da solo l'architettura funzionale definitiva.

- 28 agosto 2026 — Corretto strutturalmente il recupero delle sezioni risultati del motore ITF live. La diagnosi del run `33131036717` ha isolato nel J30 Cuneo quattro residui: due strutture round-robin alternative a tabelloni knock-out già popolati e due sezioni realmente illeggibili per challenge Incapsula. In `src/v3/retry-itf-result-queue-shard.mjs` le strutture alternative vuote/illeggibili vengono ora classificate `superseded_alternative_structure` e risolte soltanto quando, nella stessa famiglia giocatore/singolare-doppio/classificazione, esiste un'altra struttura popolata; le sezioni distinte restano invece obbligatorie. Ogni sezione reale dispone inoltre di tre cicli indipendenti, con nuova sessione torneo e attesa progressiva. Commit `42bab5a5fd25eff87b15cd3d6f366c557c857d52`. Nel workflow `courtwatch-v3-itf-live.yml` i retry risultati sono stati ridotti da 8 a 2 runner concorrenti, il ritardo tra richieste portato a 1.200 ms e configurati tre cicli per sezione, riducendo la pressione che innescava Incapsula. Commit finale `6c817d4def47ccd237309148a951fd256bab5502`; avviato automaticamente il run ITF live `33133081793` (run 58), ancora da certificare. Verifica richiesta nel job `review`: `remainingRetries=0`, stato `itf_section_retry_complete`, step di merge/R2/commit riusciti e diagnostica ITF verde. Nessun polling viene eseguito dall'assistente secondo la regola di risparmio IA.

- 28 agosto 2026 — Verificato lo stato corrente del motore ITF. Lo storico resta completo e certificato: 4.291/4.291 tabelloni, `missing=0`, `retry=0`, `unreadable=0`, quattro relazioni storiche di Martina Danesi. La proiezione pubblica conserva cinque tornei ITF (quattro storici più Palermo live), ma `source_itf_entries.json` risale al 25 agosto 22:08 UTC e la diagnostica generale mantiene ITF giallo. L'ultimo live, run `33131036717` (run 56), è fallito in sicurezza nel job `review`: 16/16 shard iniziali, 16 retry acceptance e 8 retry risultati sono terminati tecnicamente con successo, ma `apply-itf-result-retries.mjs` ha certificato `populated=4`, `concludedEmptyAnomalies=1`, `missingOrUnreadable=3`, `originalRetries=1`, `resolvedRetries=1`, `remainingRetries=4`, stato `itf_section_retry_incomplete`, exit code 2. Nessun dato parziale è stato pubblicato e R2 ha inoltre segnalato `R2 has no complete ITF database yet; initialized local generation`: l'archivio storico ITF su R2 è sano, ma il database generazionale completo del live non è ancora inizializzato. Prossimo intervento: identificare le quattro sezioni residue, correggere la causa generale della loro classificazione/acquisizione e ottenere un run con `remainingRetries=0` prima di pubblicare.
- 28 agosto 2026 — Verificato lo stato congiunto FITP/Tennis Europe dopo il ripristino degli scheduler. FITP iscrizioni: generazione 28 agosto 00:59:30 UTC, stato `fitp_entries_complete_from_versioned_participant_cache`, 5.855 tornei/snapshot, 1.007 aggiornati, 4.848 riusati, 424.506 partecipanti con tessera, 422 entry, 27 giocatori, 0 errori e 0 refresh error. Tennis Europe: generazione 01:12:53 UTC, stato verde, 598 tornei, 54 acceptance, 46 calendario, 38 confermate, 7 respinte, 0 pending/inconclusive, 0 warning/errori. La diagnostica generale marca verdi entrambi i motori e il calendario, ma segnala che il catalogo tornei FITP ha ancora 45 ore: l'elaborazione FITP è sana, mentre la freschezza del catalogo dipende ancora dal relativo scheduler. Decisione architetturale: rendere indipendenti dai problemi cron GitHub tutti i flussi critici, non soltanto TE, usando un watchdog esterno di freschezza per FITP catalogo, FITP iscrizioni, Tennis Europe catalogo/live, ITF e merge finale.
- 28 agosto 2026 — Programmato per il pomeriggio dello stesso giorno un promemoria per configurare il watchdog esterno Cloudflare del motore Tennis Europe. Confermato lo stato di persistenza documentato: i database pesanti dei motori usano su R2 generazioni `current`, `backup-1` e `backup-2`; lo storico ITF certificato dei 4.291 tabelloni è inoltre conservato permanentemente su R2 con manifest, archivi deterministici, checksum e puntatore. I backup proteggono i dati, ma non sostituiscono il watchdog dello scheduler.
- 28 agosto 2026 — Regola permanente sul consumo IA: dopo aver avviato un workflow non breve, l'assistente non deve eseguire polling, attese o controlli ripetuti. Deve indicare all'utente il workflow di riferimento, il run/job da osservare e i risultati o conteggi da restituire; l'utente comunica poi l'esito e il lavoro riprende da quel dato. Il controllo diretto resta ammesso soltanto per lavori realmente molto brevi. Questa regola serve a risparmiare la quantità di IA disponibile e prevale sulla verifica autonoma continuativa dei workflow lunghi.
- 28 agosto 2026 — Rafforzata la schedulazione Tennis Europe con commit `63a7d857749b16a84504bf343c928999e998e578` (`Harden Tennis Europe live scheduling`). Il cron è stato spostato da `*/15` agli slot `7,22,37,52`, evitando il minuto 00. Aggiunta ridondanza tramite `workflow_run`: il live TE viene richiamato anche alla conclusione di FITP entries o ITF live; un `freshness-gate` legge `dist/v3/tennis_europe_system_diagnostics.json` e avvia la scansione di recupero soltanto se l'ultima generazione TE ha almeno 20 minuti, evitando duplicazioni. Verifica reale riuscita nel run `33132099643`: gate verde, 16/16 acceptance shard riusciti, `publish-live` riuscito, commit dati `d2ca44abd35168aa91f540da7aaff1c3dcaaee07`. Diagnostica pubblicata alle 01:12:53 UTC: stato verde, 598 tornei, 54 acceptance entry, 46 entry calendario, 38 confermate, 7 respinte, 0 pending, 0 inconclusive, 96.428 partecipanti, 0 warning e 0 errori. La soluzione è autoriparante rispetto alla perdita del solo cron TE o di uno degli scheduler sorgente; non può offrire garanzia matematica assoluta se GitHub smette contemporaneamente di generare ogni evento `schedule` e `workflow_run`. Per tale garanzia servirebbe un trigger esterno indipendente da GitHub.
- 28 agosto 2026 — Diagnosticata la mancata cadenza Tennis Europe. Non risultano run TE falliti o rimasti in coda: i numeri passano direttamente dal run 228 (`32980267547`, 26 agosto 14:26 UTC) al run 229 (`33131327367`, 28 agosto 00:57 UTC). Nello stesso intervallo si sono fermati anche gli altri workflow schedulati del repository (FITP entries, merge isolato e due live ITF), che sono ripartiti insieme tra le 00:51 e le 00:59 UTC del 28 agosto. La causa non è quindi il parser Tennis Europe, la cookie wall o la sua concurrency: durante il vuoto GitHub non ha creato gli eventi `schedule`. GitHub documenta che, in condizioni di carico elevato, gli eventi schedulati possono essere ritardati e perfino eliminati. Nel progetto il periodo coincide con l'elevato carico Actions/API generato dalle acquisizioni storiche ITF e con errori documentati di quota dell'installazione; il nesso col carico è una diagnosi probabile coerente con le prove, mentre la causa interna esatta del servizio GitHub non è osservabile dal repository. Il cron `*/15` include inoltre il minuto 00, indicato da GitHub come fascia più esposta al carico. Intervento consigliato: spostare gli slot fuori dal minuto 00 e aggiungere un controllo di freschezza/watchdog, perché il solo cron GitHub non garantisce l'esecuzione.
- 28 agosto 2026 — Verificata l'esecuzione reale del motore Tennis Europe live. Il workflow è configurato con cron `*/15 * * * *`, ma la cadenza osservata non consente di certificare un aggiornamento affidabile ogni 15 minuti: nell'elenco recente disponibile il run precedente identificabile era `32980267547` del 26 agosto alle 14:26 UTC, seguito dal run `33131327367` del 28 agosto alle 00:57 UTC. Quest'ultimo è riuscito, ha creato il commit automatico `96da11734aa12a653dd712085063196adaf775ab` (`Publish validated Tennis Europe live entries`) e il deploy Pages `33131418900` è terminato con successo. Conclusione operativa: la pipeline aggiorna e pubblica correttamente quando parte, ma la frequenza effettiva di 15 minuti non è al momento certificata e va diagnosticata separatamente senza confondere successo del singolo ciclo e regolarità dello scheduler.
- 26 agosto 2026 — Storico completo ITF reso permanente su Cloudflare R2. Il workflow `Court Watch v3 archive 4291 ITF historical draws to R2`, run `32934667602`, ha scaricato i 17 bundle certificati, verificato 4.291 file gzip, creato 17 archivi deterministici con checksum SHA-256, caricato manifest/archivi/puntatore su R2, riscaricato tutti i blocchi e ricertificato `expected=4291`, `complete=4291`, `missing=0`, `checksumErrors=0`. Da questo momento i 4.291 tabelloni non dipendono più dagli artifact GitHub o dalla copia locale.
- 26 agosto 2026 — Mappa pubblicata con successo tramite GitHub Pages dopo il ripristino della quota API; il repository contiene 5 tornei ITF visibili per Martina Danesi: Nis, Compiègne, Szentes, Cuneo e Palermo. Rilevata e corretta una doppia applicazione dell'anticipo ITF: i quattro record storici avevano ricevuto −2 giorni nel seed e altri −2 nel generatore. Commit correttivo dati `2aba8dc639bbef1571da887e1b1ee5719b220269`; il generatore usa ora sempre `officialStartDate - 2` una sola volta.
- 26 agosto 2026 — Prima prova del nuovo ITF live, run `32906995348`, fallita correttamente senza pubblicare dati parziali: tutti gli shard hanno letto gran parte delle liste ma alcuni tornei hanno continuato a restituire una challenge Incapsula anche dopo cinque tentativi (esempio shard 0: 3 tornei irrisolti, 1.746 partecipanti letti). Implementato un secondo livello di retry isolato per shard che ripete soltanto le liste illeggibili su runner indipendenti, fino a 8 tentativi, e consente review/database/mappa solo quando tutti i retry sono risolti. Commit `4893654ecaa4b1a12be85be765f08aa0804e58cc`; run di verifica `32934910530` in coda al momento dell'annotazione.
- 26 agosto 2026 — Decisione definitiva per l'archivio ITF live: salvare permanentemente su R2 tutte le entry/acceptance list complete dei tornei coperti, anche quando non contengono giocatori CourtWatch. Non verrà creato un archivio generale di tutti i tabelloni. I tabelloni saranno inventariati e scaricati soltanto per i tornei in cui un giocatore monitorato compare nell'entry list; quando verrà aggiunto un nuovo giocatore, la ricerca retroattiva userà prima lo storico dei 4.291 tabelloni già acquisiti e poi le entry list archiviate, scaricando online soltanto i tabelloni dei tornei in cui il nuovo giocatore risulta presente.
- 26 agosto 2026 — Pubblicati su `main` i quattro riscontri storici ITF certificati di Martina Danesi (Nis, Compiègne cancellato, Szentes e Cuneo) con commit atomico `44d5987b7ff4d28770c8246f1a4681501ed330af`; Palermo live resta presente, quindi la sorgente e la mappa contengono 5 entry ITF. Per i quattro record storici: stato `draw_confirmed`, nessuna etichetta acceptance, inizio visualizzato due giorni prima della data ufficiale e fine invariata. Aggiornati `source_itf_entries.json`, `entries_itf.json`, `tournament_entries.json`, `tournaments.json`, diagnostica e database storico. Creati `history/itf_historical_player_tournaments.json`, `history/itf_player_tournament_db.json` e audit con 4.291/4.291 task, `missing=0`, `retry=0`, `unreadable=0`.
- 26 agosto 2026 — Database ITF storico pubblicato e verificato su Cloudflare R2 dal workflow `Court Watch v3 publish certified ITF history to R2`, run riuscito `32904708917`. Il primo run `32904649548` aveva fallito perché il bucket non possedeva ancora `itf/database/pointers/current.json`; corretta la causa generale inizializzando automaticamente una generazione quando il database R2 è vuoto (commit `704f7a75eaa587184efc04ed93e085ee2bb47641`).
- 26 agosto 2026 — Il build GitHub Pages dei nuovi dati è riuscito, ma il deploy pubblico è stato respinto due volte da GitHub con `API rate limit exceeded for installation` (run `32904708095`, tentativo 2). Non è un errore del sito o dei dati: repository e R2 sono aggiornati, mentre la pagina pubblica resta sulla generazione precedente finché GitHub non accetta un nuovo deploy dopo il ripristino della quota.

Aggiornato al 29 agosto 2026 (Europe/Rome)

## Regola di aggiornamento continuo

Questo è il documento operativo principale del progetto e deve essere aggiornato passo passo. Dopo ogni intervento rilevante bisogna aggiornare, nello stesso turno di lavoro quando possibile:

- modifiche effettuate e file coinvolti;
- commit e workflow avviati;
- risultati verificati e conteggi;
- decisioni concordate con l’utente;
- regressioni, anomalie e problemi ancora aperti;
- stato effettivamente visibile in produzione;
- prossima attività consigliata.

Le informazioni superate non devono essere semplicemente cancellate quando sono utili a ricostruire il lavoro: vanno spostate nel registro cronologico e sostituite, nelle sezioni operative, dallo stato corrente. Ogni aggiornamento deve incrementare la versione del file conservando la stessa identità del documento.

### Registro aggiornamenti

| Data | Aggiornamento |
| --- | --- |
| 28 agosto 2026 | Separati i quattro flussi ITF: known labels/withdrawn ogni 14 minuti (4 shard), discovery completa +42 giorni ogni 14 minuti, safety +120 giorni giornaliera, T−1 ogni 14 minuti con confronto di ogni tabellone contro tutti i giocatori ITF, incluse wild card/on-site alternate. Acquisizioni indipendenti e pubblicazione R2 serializzata. Run: discovery `33134834216`, known `33134835298`, safety `33134836054`, T−1 `33134837341`. |
| 28 agosto 2026 | Diagnosticata la lentezza del run 61: matrice acceptance in due ondate (16 shard, massimo 8), scansioni seriali per shard con delay/bootstrap/retry, poi seconda matrice retry prima della review. Non è bloccato nel T−1. Rischio da verificare: durata oltre il cron di 14 minuti con `cancel-in-progress=true`. Evitare di portare subito la concorrenza a 16 senza misurazione, per non aumentare le challenge Incapsula. |
| 28 agosto 2026 | Riscrittura ITF live pubblicata: acceptance immediatamente in mappa con stato live e MD/Q/A; controllo withdrawn a ogni ciclo; nessuna richiesta tabelloni prima di T−1; da T−1 conferma, pending conservativo o rimozione su assenza completa. Rimossi dal workflow scansione/archiviazione risultati precoce e relativi retry. Commit `388bbb28`, `03f7571c`, `79fc65c6`; run di certificazione `33133911718` (run 61). Verificare job `review`, `preTMinusOneDrawRequests=0`, diagnostica completa, R2 e commit mappa. |
| 28 agosto 2026 | Definito il comportamento ITF live definitivo sul modello TE: catalogo e acceptance aggiornati continuamente con MD/Q/A fino all'inizio; snapshot persistente prima che ITF ritiri le liste; controllo tabelloni soltanto da T−1; conferma, pending o rimozione solo su prova completa. Ordine di gioco e risultati rinviati. Valutata necessaria una riscrittura mirata del coordinamento/stato e del verificatore T−1, riusando catalogo, matcher, database R2, retry e pubblicazione atomica. |
| 28 agosto 2026 | Corretto il retry risultati ITF: classificazione sicura delle strutture alternative superseded, tre cicli indipendenti per ogni sezione reale, nuova sessione torneo tra i cicli, concorrenza retry ridotta a 2 e delay 1.200 ms. Commit `42bab5a5` e `6c817d4d`; run di certificazione `33133081793` (run 58) avviato. Esito ancora da verificare nel job `review` con `remainingRetries=0`, `itf_section_retry_complete`, pubblicazione R2 e diagnostica verde. |
| 28 agosto 2026 | Stato ITF verificato: storico 4.291/4.291 sano e cinque tornei pubblici conservati; live run `33131036717` bloccato correttamente con `remainingRetries=4` nel job review, quindi nessuna pubblicazione parziale. Il database live completo R2 non è ancora inizializzato. ITF resta giallo e richiede diagnosi delle quattro sezioni residue. |
| 28 agosto 2026 | Confermati sani FITP entries e Tennis Europe: FITP 422 entry/424.506 partecipanti/0 errori; TE verde 598 tornei/54 acceptance/46 calendario/0 errori. Il catalogo FITP risulta però vecchio di 45 ore: il motore funziona, ma il watchdog esterno deve coprire tutti i workflow critici e non soltanto TE. |
| 28 agosto 2026 | Creato promemoria pomeridiano per il watchdog Cloudflare. Ribadita la presenza su R2 delle generazioni `current/backup-1/backup-2` e dell'archivio storico ITF permanente certificato. |
| 28 agosto 2026 | Stabilita la regola di risparmio IA: per workflow non brevi niente polling dell'assistente; vengono comunicati all'utente workflow, run/job e valori da verificare, e l'utente restituisce l'esito. Controllo autonomo ammesso solo per attività molto brevi. |
| 28 agosto 2026 | Pubblicato il rafforzamento scheduler TE: commit `63a7d857`, cron `7,22,37,52`, recupero ridondante dopo FITP/ITF e gate di freschezza a 20 minuti. Run di verifica `33132099643` completamente riuscito; commit dati `d2ca44a`; diagnostica verde con 598 tornei, 54 acceptance, 46 calendario, 96.428 partecipanti, 0 warning/errori. |
| 28 agosto 2026 | Diagnosi scheduler: tra i run TE 228 e 229 non esistono esecuzioni fallite o accodate; mancano direttamente gli eventi cron. Nello stesso intervallo si sono fermati tutti i principali workflow schedulati e sono ripartiti insieme il 28 agosto. Escluso quindi un guasto specifico del motore TE. Probabile perdita/ritardo degli eventi GitHub `schedule` durante il forte carico Actions/API, comportamento ammesso dalla documentazione GitHub; causa interna esatta non osservabile. Consigliati slot sfalsati e watchdog di freschezza. |
| 28 agosto 2026 | Controllata la frequenza reale Tennis Europe: configurazione cron ogni 15 minuti confermata nel workflow, ultimo run `33131327367` riuscito e pubblicato tramite commit `96da11734aa12a653dd712085063196adaf775ab`, con deploy Pages `33131418900` riuscito. La cadenza effettiva non è certificata perché nell'elenco recente osservabile il precedente run TE identificato risale al 26 agosto, run `32980267547`. Stato: elaborazione corretta quando il workflow parte; regolarità ogni 15 minuti da diagnosticare. |
| 24 agosto 2026 | Verificata la pubblicazione produzione della correzione T−1. Il workflow seriale avviato dal commit `92addf3` ha completato il passaggio di pubblicazione/verifica R2 e ha scritto su `main` il commit automatico `b084527dcb33a4ac29c336ba089fbbe0fd91a684` (`Publish validated Tennis Europe live entries`). Stato pubblico: Darko conserva 6 tornei TE; Pointer Open, CRNA REKA, NIŠ Open, Prijedor e Agno sono `draw_confirmed` senza etichetta acceptance; Perugia è stata rimossa; Doboj resta `Q-14` fino al T−1. Audit database pubblicato: 54 acceptance entry, 46 entry calendario, 43 permanenti, 57 relazioni, stato `tennis_europe_database_update_complete`. |
| 24 agosto 2026 | Risolta l'anomalia T−1 per giocatori aggiunti dopo la conclusione dei tornei. `verify-tennis-europe-draws.mjs` supporta ora `TE_DRAW_PLAYER_ID` per backfill mirati e, in modalità live, tratta automaticamente come target storico ogni relazione conclusa priva di una precedente decisione affidabile; le conferme/rimozioni già registrate restano riutilizzate. Test mirato Darko: 6 tornei conclusi controllati, 5 confermati nei tabelloni (Pointer Open, CRNA REKA, NIŠ Open, Prijedor, Agno), Perugia rimossa per assenza dai tabelloni singolari completi e affidabili, Doboj invariato a T−8. Diagnostica database verde: 598 tornei, 46 entry calendario TE, 5 confermate, 1 respinta, 0 pending, 0 errori. Pubblicati i commit GitHub `a0df2ef` (backfill mirato) e `92addf3` (applicazione automatica alle nuove relazioni storiche); workflow live/R2 riavviato dal secondo commit. |
| 24 agosto 2026 | Accesso GitHub autenticato finalmente disponibile tramite plugin: repository `png8nftp9y-alt/png8nftp9y-alt.github.io` verificato con permessi `admin` e `push`. Pubblicato direttamente su `main` il profilo di Darko Sartori in `players.json` (FITP + Tennis Europe, tessera `9058584226`, classifica `3.3`, Tennis Club Lecco) con commit `00ba77968cb31680bcea00316005a645a7ca29e8`, messaggio `Add Darko Sartori to FITP and Tennis Europe maps`. La modifica ha attivato i workflow dipendenti da `players.json`; osservato il successivo commit automatico ITF `65bb818c`. Da questo punto usare il plugin GitHub per letture e scritture del repository, non il push HTTPS locale privo di credenziali. |
| 24 agosto 2026 | Verificata l'applicazione T−1 sui 7 tornei Tennis Europe di Darko: lo script `verify-tennis-europe-draws.mjs` è stato eseguito, ma l'audit ha assegnato a tutti la decisione `kept_pre_tournament_acceptance`. Anche i 6 tornei già conclusi conservano le etichette A/MD/Q e non hanno campi `drawVerification`/`drawState`; Doboj è correttamente ancora a T−8. La regola T−1 non può quindi considerarsi applicata a Darko. Anomalia da correggere: gestione della finestra temporale/audit storico per giocatori aggiunti dopo la conclusione dei tornei. Non rimuovere nessuna entry finché i tabelloni non sono controllati con la regola affidabile concordata. |
| 24 agosto 2026 | Su richiesta dell'utente è stato installato il plugin Cloudflare per ottenere accesso operativo a R2. L'installazione è riuscita, ma nella sessione corrente non sono ancora esposte azioni R2 e non è quindi ancora verificata la connessione dell'account/bucket: al successivo caricamento deve essere eseguita una lettura innocua prima di qualsiasi modifica. GitHub resta leggibile pubblicamente ma senza autenticazione di scrittura: il push HTTPS fallisce con richiesta credenziali e non è disponibile un'integrazione GitHub installabile nella sessione corrente. Non accettare token o password in chat; usare esclusivamente il collegamento account autorizzato dell'interfaccia. |
| 24 agosto 2026 | Chiarito l'ambito del controllo database: la scansione e la ricostruzione completate in questa sessione riguardano la copia locale versionata (`history/tennis_europe_player_tournament_db.json` e cache partecipanti), non gli oggetti correnti/backup nel bucket R2. La sessione locale non dispone di `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` o `R2_BUCKET`; l'accesso R2 è previsto tramite secrets del workflow GitHub Actions. Per verificare e pubblicare sul database R2 occorre quindi eseguire il workflow autenticato del repository. |
| 24 agosto 2026 | Corretto il percorso di controllo Tennis Europe per Darko. Il primo esito negativo derivava dal fatto che `discover-tennis-europe-acceptance-shard.mjs` filtra a monte i giocatori configurati con circuito `Tennis Europe`: Darko era allora presente soltanto come FITP, quindi non poteva produrre entry TE. Inoltre era stata consultata la ricerca web e gli snapshot preesistenti, ma non era ancora stata rilanciata l'intera scansione e ricostruito `tennis_europe_player_tournament_db.json` dopo l'abilitazione; questo controllo era incompleto. Dopo l'abilitazione sono stati rilanciati tutti i 16 shard: 598 tornei controllati, 93.618 partecipanti letti, 54 entry TE complessive, 0 errori e 7 corrispondenze ufficiali per Darko (Perugia A-41, Pointer Open A-2, CRNA REKA MD-22, NIŠ Open Q-16, Prijedor MD-21, Agno U16 Q-11, Doboj Q-14). Ricostruiti database e calendario: 598 tornei correnti/storici, 57 relazioni giocatore-torneo, 47 entry calendario TE, diagnostica di sistema verde e 0 warning. Il database copre partecipanti pubblicati nelle acceptance list dei tornei mappati; non è un'anagrafica universale di tutti i giocatori Tennis Europe. |
| 24 agosto 2026 | Su richiesta dell'utente, Darko Sartori è stato abilitato anche per `Tennis Europe` in `players.json`, con URL ufficiale generico `https://te.tournamentsoftware.com/`. È ora presente nella mappa giocatori e incluso automaticamente nelle future scansioni delle acceptance list tramite gli alias `DARKO SARTORI` e `SARTORI DARKO`. Non è stato inventato un profilo specifico e non sono stati attribuiti tornei TE senza riscontro ufficiale. Rigenerati i dati v3 e superata `validate-tennis-europe-live.mjs` (`status: ok`, 27 giocatori, sorgente TE integra); conteggi del calendario invariati e 0 warning. Commit locale `8159490`; pubblicazione ancora sospesa in attesa di autorizzazione esplicita al push pubblico. |
| 24 agosto 2026 | Completato il controllo specifico di Darko Sartori sugli altri circuiti. Tennis Europe: verificati la mappa corrente di 598 tornei e gli snapshot delle acceptance list dei 16 shard, senza corrispondenze per `DARKO SARTORI`/`SARTORI DARKO`; nessun profilo ufficiale univoco trovato. ITF: nessun profilo giocatore o risultato ufficiale riconducibile univocamente a Darko trovato nella ricerca giocatori/World Tennis Tour; non è quindi stato aggiunto ai circuiti Tennis Europe o ITF. Verificato invece il club tramite documentazione FITP: `Tennis Club Lecco`. Rigenerati i dati v3 senza variazioni nei conteggi (27 giocatori, 463 associazioni, 0 warning). Commit locale aggiuntivo `d2358fb`; pubblicazione ancora sospesa in attesa di conferma esplicita al push nel repository pubblico. |
| 24 agosto 2026 | Aggiunto Darko Sartori ai giocatori FITP con tessera verificata `9058584226` e classifica `3.3`. Eseguita la rigenerazione completa della cache partecipanti e delle iscrizioni dal 18 dicembre 2025: 5.802 tornei analizzati, 418.531 partecipanti con tessera, 423 associazioni FITP complessive, 15 tornei attribuiti a Darko tramite corrispondenza esclusiva della tessera, 0 errori. Rigenerati i dati v3: 27 giocatori, 463 associazioni/calendario complessive, 422 FITP visibili, 40 Tennis Europe e 1 ITF, 0 warning; diagnostica generale gialla per lo stato preesistente dei motori. Il club di Darko non è stato valorizzato perché non necessario alla corrispondenza e non verificato singolarmente. Commit locale `42ff6dd`; push su `main` non eseguito perché il repository è pubblico e serve conferma esplicita alla pubblicazione dei dati personali contenuti nei file generati. |
| 17 agosto 2026 | Creato il report completo di passaggio di consegne. |
| 17 agosto 2026 | Stabilito che il report deve essere aggiornato dopo ogni modifica rilevante e mantenuto come documento vivo. |
| 17 agosto 2026 | Individuato un torneo ITF classificato erroneamente anche come FITP: J30 Cuneo di Martina Danesi compare in blu dalla sorgente PUC e in verde dalla sorgente ITF. |
| 17 agosto 2026 | Precisata la regola ITF nel PUC: il motore FITP può trovare e conservare il torneo nella mappa grezza, ma deve escluderlo dalle iscrizioni e dal calendario FITP, come già avviene per Tennis Europe. |
| 17 agosto 2026 | Pubblicato il filtro degli eventi internazionali nella costruzione del calendario FITP. Workflow `31987024886` concluso con successo: J30 Cuneo resta soltanto come ITF verde. |
| 17 agosto 2026 | Diagnosticata regressione Tennis Europe: le 45 entry validate sono diventate prima 43 per la scadenza di Agno U14 e Agno U16 (2), poi 38 perché il commit `aa88fa9` ha sovrascritto la sorgente validata con una generazione ex-novo basata anche su profili non confermati. |
| 17 agosto 2026 | Ripristinata la sorgente Tennis Europe validata: 45 iscrizioni, distribuite su 20 tornei distinti, con tutte le 45 etichette nuovamente presenti. Commit di ripristino `ab869ba20d9a2599c48c7f1fdd57b0a7bf8333a9`; workflow `31987645912` concluso con successo. |
| 17 agosto 2026 | Protetta la sorgente Tennis Europe sharded impedendo al workflow ex-novo di sovrascriverla. Le entry temporaneamente non confermate restano in attesa del controllo tabellone invece di essere eliminate automaticamente. |
| 17 agosto 2026 | Avviata l'implementazione T−1. I workflow di prova hanno correttamente bloccato la pubblicazione perché il consenso cookie di Tennis Europe non è ancora superato dal client automatico. Ultimo test noto: workflow `31988653159`, fallito prima della pubblicazione con `Tennis Europe cookie wall returned no consent purposes`. Il calendario corretto è rimasto congelato. |
| 23 agosto 2026 | Inserita tra le attività sospese la revisione delle pagine personali dei giocatori: ordinamento cronologico esplicito dei tornei, separazione fra futuri/in corso/conclusi e successivo ordinamento di agenda e risultati. La modifica è rinviata a dopo il completamento del T−1 Tennis Europe. |
| 23 agosto 2026 | Pubblicata la protezione browser “ultima versione corretta” dopo che un'indisponibilità GitHub aveva lasciato l'app spoglia. `v3.js` ora distingue file essenziali e accessori, conserva in `localStorage` l'ultima generazione completa, recupera automaticamente la cache in caso di errore e mostra uno stato giallo senza svuotare calendario e giocatori. Commit su `main`: `1e13034`, `249b254`, `99a915e`. |

## 1. Scopo del progetto

Court Watch v3 è un calendario automatico per seguire i tornei dei giocatori indicati dall’utente. L’obiettivo finale è avere quattro motori indipendenti:

1. FITP;
2. Tennis Europe;
3. ITF;
4. gare a squadre.

Per ogni circuito il flusso desiderato è:

1. costruire una mappa completa dei tornei;
2. cercare i giocatori seguiti nelle liste ufficiali dei tornei;
3. mostrare in calendario soltanto i tornei nei quali almeno un giocatore risulta presente;
4. vicino all’inizio del torneo verificare i tabelloni;
5. durante il torneo recuperare ordine di gioco e orario dei match;
6. al termine mostrare i risultati.

L’aspetto grafico deve rimanere identico a v3. La parte ordine di gioco e risultati è volutamente rinviata finché i motori di ricerca dei circuiti non saranno completi.

Repository: `png8nftp9y-alt/png8nftp9y-alt.github.io`

App pubblica: `https://png8nftp9y-alt.github.io/v3.html`

## 2. Principi definitivi concordati

- Ogni circuito deve avere un motore separato.
- La mappa dei tornei e la ricerca delle iscrizioni dei giocatori sono due fasi distinte.
- Le nuove iscrizioni e le cancellazioni devono essere rilevate aggiornando le liste dei partecipanti.
- Il calendario non deve essere pubblicato con dati parziali o corrotti.
- Prima di ogni pubblicazione deve essere conservata l’ultima versione corretta; se una nuova generazione fallisce, deve restare visibile quella precedente.
- In diagnostica l’utente vuole vedere soltanto spie colorate, senza icone o pannelli di monitoraggio invasivi.
- L’assistente deve comunicare lo stato e l’esito dei controlli; non deve essere l’interfaccia dell’app a mostrare un’icona di monitoraggio.
- Il sistema deve essere continuo nel tempo: la finestra di ricerca avanza quotidianamente e lo storico impedisce la perdita degli eventi già validati.
- I file pesanti e le cache non devono far crescere indefinitamente Git.

## 3. Motore FITP

### 3.1 Motore principale

È stato scelto il motore provinciale come motore FITP principale. Il motore nazionale resta un controllo di confronto/fallback, non deve sostituire automaticamente il catalogo provinciale con dati nazionali o parziali.

Il test nazionale di riferimento aveva restituito 5.593 tornei. Il confronto provinciale/nazionale è stato usato per individuare:

- codici provincia errati o alternativi;
- città metropolitane;
- problemi di paginazione;
- province senza risultati o con risultati anomali;
- tornei presenti solo nel nazionale;
- tornei di durata superiore a 21 giorni.

Il problema di Roma è stato ricondotto al codice provincia 258 e corretto/testato. I tornei romani che l’utente trovava manualmente sotto il filtro Roma erano il riferimento da recuperare.

### 3.2 Finestre temporali

Il motore provinciale usa finestre sovrapposte di 21 giorni. L’overlap è obbligatorio anche quando una finestra viene suddivisa per saturazione o errore.

Motivo: un torneo a cavallo tra due intervalli non deve sfuggire. Esempio discusso: torneo dal 16 al 28 gennaio; finestre contigue senza sovrapposizione possono escluderlo a seconda dei filtri FITP su data di inizio e fine.

Assunzione concordata: non risultano tornei FITP ordinari più lunghi di 21 giorni. I casi oltre 21 giorni vanno comunque diagnosticati e gestiti, non ignorati.

La finestra deve avanzare nel tempo: ogni giorno si elimina un giorno ormai vecchio e se ne aggiunge uno futuro. Il catalogo/storico conserva ciò che è già stato acquisito.

### 3.3 Paginazione e fallback

- La paginazione deve essere completa per ogni provincia.
- Se una richiesta principale satura o fallisce, si suddivide la finestra.
- Le sottofinestre devono mantenere overlap, per evitare buchi.
- Ogni provincia deve rilasciare risultati plausibili o una diagnostica esplicita.
- Il sistema deve controllare tutte le 107 province.
- Un risultato basso o nullo non va accettato automaticamente come corretto.

### 3.4 Ricerca giocatori e iscrizioni

La ricerca del giocatore deve avvenire nella mappa tornei, consultando le liste partecipanti aggiornate. Deve rilevare:

- nuova iscrizione: il giocatore compare oggi e non compariva prima;
- cancellazione/ritiro: il giocatore compariva e successivamente non compare più;
- conferma: continua a comparire.

Sono stati aggiunti Andrea Losa con tessera FITP `2613625755` e Darko Sartori con tessera FITP `9058584226`.

Per Darko Sartori la rigenerazione completa del 24 agosto 2026 ha trovato 15 tornei FITP dal 18 dicembre 2025, tutti associati tramite tessera e senza errori. La classifica corrente rilevata è `3.3` e il club verificato è `Tennis Club Lecco`. Il controllo incrociato non ha trovato un profilo o un'iscrizione ufficiale Tennis Europe/ITF univocamente riconducibile al giocatore. Su successiva richiesta esplicita dell'utente, Darko è stato comunque abilitato per Tennis Europe: deve comparire nella mappa giocatori e partecipare alle future scansioni TE, ma nessun torneo TE deve essergli attribuito senza una corrispondenza ufficiale. ITF resta disabilitato fino a nuove evidenze.

Quando l’utente chiede di inserire un giocatore, l’operazione desiderata comprende automaticamente:

1. aggiunta al file giocatori;
2. recupero/verifica della tessera;
3. aggiornamento delle iscrizioni ai tornei;
4. aggiornamento del calendario e dello storico;
5. in futuro, aggiornamento anche di ordini di gioco e risultati.

Per le ricostruzioni storiche, il requisito è partire dal 18 dicembre 2025. Non si può dipendere soltanto dalla finestra corrente, perché dopo mesi i tornei vecchi non sarebbero più restituiti dalla ricerca FITP. Serve quindi un archivio persistente di tornei e partecipanti.

I tornei ITF eventualmente presenti nel PUC FITP non devono rientrare nel conteggio FITP.

Anomalia verificata in produzione il 17 agosto 2026: `ITF J30 CUNEO` di Martina Danesi è presente in `dist/v3/tournaments.json` sia come record FITP blu (`competitionId` FITP `13267468-DCCF-44C3-BA20-ED3606039646`) sia come record ITF verde (`J-J30-ITA-2026-002`). Il motore FITP può legittimamente intercettare e conservare nella propria mappa grezza i tornei internazionali restituiti dal PUC. Il filtro deve però escluderli dalla fase di costruzione delle iscrizioni e del calendario FITP, come già stabilito per i tornei Tennis Europe presenti nel PUC. Il record blu non deve quindi essere pubblicato; il torneo visibile deve provenire esclusivamente dal motore ITF.

Correzione completata il 17 agosto 2026 nei file `src/v3/entries-engine.mjs` e `src/v3/merge-isolated-engines.mjs`. Il filtro agisce soltanto nel merge del calendario e non modifica `source_fitp_entries.json`. Verifica dopo il workflow `31987024886`: mappa sorgente FITP 393 record, calendario 431 record totali, FITP visibili 392, ITF visibili 1, record internazionali pubblicati come FITP 0. `J30 Cuneo` rimane una sola volta come ITF verde per Martina Danesi.

### 3.5 Storico FITP

Lo storico non è un semplice accumulo immutabile di ogni iscrizione osservata. Deve conservare i tornei che rimangono effettivamente nel calendario.

Regola concordata:

- se il giocatore compare in lista, il torneo può entrare nel calendario/storico;
- se prima dell’inizio scompare dalla lista, significa normalmente cancellazione e il torneo deve essere rimosso dal calendario attivo;
- il catalogo storico dei tornei può restare per ricostruzioni e audit, ma l’associazione giocatore-torneo non deve restare attiva se il giocatore si è cancellato;
- dopo una conferma definitiva mediante tabellone o dopo lo svolgimento dell’evento, i dati devono essere conservati stabilmente.

## 4. Protezione delle pubblicazioni

Regola globale, valida per tutti i motori e per sempre:

1. generare una nuova versione in staging;
2. verificare completezza, conteggi, integrità e assenza di regressioni;
3. pubblicare solo se i controlli passano;
4. in caso di errore lasciare visibile l’ultima versione corretta;
5. non sostituire mai catalogo, calendario o storico con una generazione parziale.

Questa regola deve essere applicata anche a Tennis Europe, ITF, gare a squadre, ordini di gioco e risultati.

### 4.1 Protezione del caricamento nel browser

Dal 23 agosto 2026 la protezione non riguarda soltanto i workflow. L'app conserva nel browser l'ultima generazione completa caricata con successo.

- `players.json` e `tournaments.json` sono i dati essenziali;
- agenda, risultati, avversari, diagnostica e file analoghi sono accessori e il loro errore non blocca più tutta l'app;
- un file accessorio temporaneamente indisponibile viene sostituito dall'ultima copia valida disponibile;
- se un file essenziale non è raggiungibile, viene caricata la copia completa salvata in `localStorage`;
- la testata mostra `Ultimi dati salvati` con stato giallo quando è attivo il fallback;
- se il dispositivo non ha mai completato almeno un caricamento valido, non può esistere una cache locale: in quel solo caso viene mostrato un messaggio di indisponibilità invece di inventare dati.

Test locali superati: caricamento completo, errore di un file accessorio e indisponibilità di un file essenziale con recupero della cache. Asset attivati tramite versionamento `v3.js?v=202608231900` e `v3.css?v=202608231900`.

## 5. Storage R2 e GitHub

È stato scelto Cloudflare R2 per spostare fuori da Git i file pesanti e destinati a crescere, mantenendo in Git codice, configurazioni e dati leggeri necessari al sito.

Obiettivi:

- evitare crescita indefinita della cronologia Git;
- conservare più generazioni recuperabili;
- rendere possibili cache grandi per partecipanti, indici, tabelloni, ordini di gioco e risultati;
- mantenere il funzionamento strutturale dell’app invariato: cambia il livello di persistenza/recupero dati, non la grafica.

Strategia generazionale concordata per R2:

- `current`;
- `backup-1`;
- `backup-2`.

I workflow FITP devono:

1. ripristinare la cache da R2;
2. elaborare una nuova generazione;
3. pubblicarla e verificarla;
4. ruotare current/backup soltanto dopo verifica riuscita;
5. mantenere calendario e storico integri;
6. lasciare fuori da `main` i file pesanti `history/fitp_participant_cache.json.gz` e `history/fitp_membership_index.json.gz`.

È stata rinviata la pulizia della cronologia Git finché non fossero state verificate almeno due generazioni R2 successive e fossero pronti `current`, `backup-1` e `backup-2`.

## 6. Motore Tennis Europe

### 6.1 Architettura scelta

È stato scelto il motore sharded come motore Tennis Europe principale, dopo il confronto con il motore vecchio. La ricerca è stata impostata con frequenza desiderata di 15 minuti, se sostenibile.

Anche Tennis Europe richiede:

- catalogo completo dei tornei;
- database/storico persistente;
- ricerca aggiornata dei giocatori nelle acceptance list;
- controllo T−1 dei tabelloni;
- protezione contro dati parziali;
- avanzamento continuo della finestra temporale nel futuro.

Il database Tennis Europe deve contenere almeno:

- identificativo torneo;
- nome torneo;
- date di inizio e fine;
- località/paese;
- categoria, età e sesso;
- URL ufficiali;
- snapshot delle acceptance list;
- associazioni giocatore-torneo e loro stato;
- snapshot/metadati dei tabelloni di singolare;
- stato di conferma nel tabellone;
- timestamp dell’ultima verifica.

### 6.2 Etichette acceptance list

Prima dell’inizio del torneo, il calendario deve mostrare la posizione del giocatore nella acceptance list:

- verde: `MD-n`;
- giallo: `Q-n`;
- arancione scuro: `A-n`;
- `WC` quando il giocatore è presente in acceptance list ma senza numero/posizione.

Caso di riferimento WC: Virginia Cereghini al Torneo Avvenire di Milano.

Le etichette possono cambiare nel tempo sia come categoria sia come numero e devono essere aggiornate frequentemente.

Ordine nel calendario:

1. prima tutti gli `MD`, ordinati dal numero più basso al più alto;
2. poi tutti i `Q`, ordinati dal numero più basso al più alto;
3. poi tutti gli `A`, ordinati dal numero più basso al più alto;
4. i `WC` vanno gestiti esplicitamente e non scartati per assenza del numero.

La categoria ha sempre precedenza sul numero.

### 6.3 Regola T−1

T−1 significa un giorno prima dell’inizio del torneo, calcolato nel fuso `Europe/Rome`.

Il controllo deve essere eseguito soltanto sui tornei nei quali almeno uno dei giocatori seguiti risulta già presente nella acceptance list, non sull’intero catalogo Tennis Europe.

Al T−1:

1. controllare solo i tabelloni di singolare;
2. cercare sia qualificazioni sia main draw, indipendentemente dall’etichetta precedente;
3. se il giocatore compare in almeno uno dei due, conservarlo nel calendario e rimuovere l’etichetta acceptance (`MD-n`, `Q-n`, `A-n`, `WC`), mostrando il solo nome;
4. se non compare in nessuno dei due, rimuoverlo soltanto quando entrambi i tabelloni pertinenti sono pubblicati, popolati e affidabili;
5. se uno o entrambi i tabelloni sono mancanti, non pubblicati, vuoti, composti solo da `Bye` o non verificabili, il controllo è inconcludente e il giocatore deve restare con l’ultimo stato valido.

Il doppio non partecipa alla decisione T−1. Sarà usato successivamente per ordine di gioco e risultati.

### 6.4 Tabelloni vuoti

URL ufficiale fornito dall’utente come caso di test:

`https://te.tournamentsoftware.com/tournament/5173C79B-B05D-4157-AD04-CD4D4F68C4E7/draw/1`

È il tabellone `BS14 - Boys Singles 14 Main Draw`, size 64, con tutte le 64 posizioni indicate come `Bye`. Deve essere classificato come:

- pubblicato;
- vuoto/non compilato;
- inconcludente;
- mai sufficiente per rimuovere un giocatore.

Il relativo tabellone qualificazioni usa il percorso `/Draw/7`.

### 6.5 Stato operativo corrente del T−1

La logica decisionale è stata predisposta in `src/v3/verify-tennis-europe-draws.mjs`:

- scandisce i percorsi numerati dei tabelloni del torneo;
- separa singolare e doppio;
- distingue main draw e qualificazioni;
- filtra sesso e categoria d'età;
- riconosce tabelloni mancanti, vuoti/solo Bye e popolati;
- elimina un giocatore soltanto con assenza certa da entrambi i tabelloni di singolare pertinenti;
- conserva l'ultimo stato valido nei casi inconcludenti;
- esegue uno smoke test sul tabellone vuoto noto prima di consentire la pubblicazione.

Stato verificato: **non ancora operativo in produzione**. L'ostacolo attuale non è la regola T−1, ma la sessione HTTP richiesta da `te.tournamentsoftware.com`. Il sito presenta una cookie wall; il browser normale la supera, mentre il client del workflow non sta ancora recuperando correttamente i campi `CookiePurposes` necessari al POST di consenso.

Workflow di prova falliti in sicurezza:

- `31988159989` — URL iniziale errato/404;
- `31988340607` — redirect alla cookie wall;
- `31988451028` e `31988550963` — campi di consenso non rilevati;
- `31988653159` — ultimo test noto, stesso blocco sui consent purposes.

In tutti questi casi la pubblicazione atomica è stata saltata: le 45 iscrizioni Tennis Europe validate non sono state sostituite da risultati parziali.

Prossimo intervento tecnico:

1. seguire esplicitamente il redirect della cookie wall conservando i cookie intermedi;
2. analizzare gli elementi `input` indipendentemente dall'ordine degli attributi HTML;
3. inviare il consenso minimo equivalente al pulsante browser “Accept” (`CookiePurposes=1`);
4. ripetere lo smoke test sul tabellone vuoto noto;
5. eseguire il T−1 sui soli tornei con nostri giocatori;
6. pubblicare soltanto dopo verifica dei conteggi, delle conferme, delle rimozioni motivate e dei casi inconcludenti.

### 6.6 Ultimi conteggi Tennis Europe validati

| Dato | Valore |
| --- | ---: |
| Tornei nella mappa sharded | 598 |
| Shard del catalogo | 4 |
| Copertura temporale | 19 dicembre 2025 – 15 agosto 2028 |
| Iscrizioni dei giocatori | 45 |
| Tornei distinti con almeno un giocatore | 20 |
| Etichette acceptance presenti | 45 |
| Rimozioni T−1 pubblicate | 0, perché il controllo non ha ancora superato lo smoke test |

### 6.7 Implementazione T−1 già introdotta

Nel file `src/v3/verify-tennis-europe-draws.mjs` sono state introdotte queste logiche:

- data T−1 nel fuso di Roma;
- probing delle route numerate `/tournament/{competitionId}/draw/1..24`;
- distinzione tra pagina mancante, tabellone vuoto e tabellone popolato;
- filtri per singolare/doppio, sesso, età e tipo main/qualifying;
- rimozione permessa soltanto con entrambi i tabelloni di singolare affidabili;
- modalità backfill storico e modalità audit-only;
- file audit `dist/v3/source_tennis_europe_draw_backfill_audit.json`.

Per Veurne/Gregorio Puccio, dopo la correzione del fuso:

- data controllo: 16 agosto 2026;
- inizio torneo: 17 agosto 2026;
- differenza: −1 giorno;
- 24 route numerate controllate;
- nessun tabellone pertinente pubblicato;
- Gregorio è stato correttamente conservato con etichetta `MD-15`.

È stato inoltre corretto un falso positivo nel quale il testo tecnico `direct draw n` faceva sembrare una route inesistente un tabellone valido.

## 7. Audit straordinario dei tornei Tennis Europe passati

L’utente ha chiesto, una sola volta, di applicare il criterio T−1 anche alle altre iscrizioni storiche per verificare il funzionamento. L’audit è stato configurato in sola lettura (`TE_DRAW_BACKFILL=1`, `TE_DRAW_AUDIT_ONLY=1`), quindi non può modificare calendario o iscrizioni.

Workflow temporaneo:

`.github/workflows/courtwatch-v3-tennis-europe-draw-backfill-once.yml`

Esecuzioni note:

- `31912407123`: successo tecnico, ma tutte le pagine tabellone erano state intercettate dalla cookie wall;
- `31912693910`: successo tecnico, ma 2.160 richieste risultavano ancora reindirizzate alla cookie wall;
- `31913073102`: successo tecnico il 16 agosto 2026; audit su 40 iscrizioni concluse e 19 tornei, 2.000 probe, ma tutti i 2.000 ancora reindirizzati alla cookie wall.

L’ultimo audit non ha modificato nulla:

- 40 iscrizioni conservate;
- 0 confermate dal tabellone;
- 0 rimosse;
- 40 inconcludenti.

Il numero è sceso rispetto alle 44 storiche richieste perché la sorgente sharded corrente, al momento dell’ultimo audit, conteneva soltanto 40 iscrizioni concluse. Prima di considerare completato il test, bisogna recuperare la fotografia corretta delle 44 iscrizioni oppure spiegare puntualmente quali quattro associazioni siano scomparse e perché.

### 7.1 Problema cookie wall ancora aperto

Il modulo inizialmente inviava valori di consenso errati (`1,2,3,4`). Il form corrente usa identificativi a bit:

`1,2,4,16`

È stato individuato anche un secondo problema: il programma effettuava direttamente il POST di consenso senza visitare prima la pagina cookie wall. La visita GET iniziale è probabilmente necessaria per ricevere il cookie di sessione usato dal successivo POST.

Una sostituzione precedente aveva inserito accidentalmente sequenze letterali `\n` dentro una riga di commento del blocco `acceptedCookie()`, commentando di fatto il ciclo che aggiungeva i valori `CookiePurposes`. Il blocco è stato successivamente riscritto, ma il client automatico continua a non ricevere il form di consenso completo. La prossima correzione deve:

1. sostituire integralmente `acceptedCookie()`;
2. aprire direttamente una pagina tabellone nota e seguire in modo controllato tutti i redirect;
3. leggere la location della cookie wall;
4. fare GET della cookie wall e raccogliere i `Set-Cookie`;
5. estrarre `ReturnUrl` dal form;
6. inviare POST a `/cookiewall/Save` con il consenso minimo equivalente ad “Accept” (`CookiePurposes=1`), cookie di sessione, `Origin` e `Referer`;
7. raccogliere i cookie restituiti dal POST;
8. verificare con una singola pagina nota che `finalUrl` non contenga più `/cookiewall/`;
9. solo dopo rilanciare il controllo T−1 e l'audit storico.

Il blocco corrente è riproducibile nel workflow e riguarda il recupero della pagina di consenso/redirect, non un limite d'uso degli strumenti. La protezione di pubblicazione sta lavorando come previsto.

## 8. File e componenti principali

Percorsi rilevanti nel repository:

- `v3.html` — interfaccia principale;
- `v3.js` — logica client/calendario;
- `src/v3/entries-engine.mjs` — costruzione delle iscrizioni;
- `src/v3/discover-tennis-europe-tournaments-shard.mjs` — scoperta tornei Tennis Europe per shard;
- `src/v3/merge-tennis-europe-tournament-shards.mjs` — merge catalogo tornei;
- `src/v3/discover-tennis-europe-acceptance-shard.mjs` — ricerca acceptance list per shard;
- `src/v3/merge-tennis-europe-acceptance-shards.mjs` — merge iscrizioni;
- `src/v3/verify-tennis-europe-draws.mjs` — controllo T−1/tabelloni;
- `src/v3/maintain-tennis-europe-database.mjs` — manutenzione database Tennis Europe (presente nella working copy locale; verificare se pubblicato su main);
- `.github/workflows/courtwatch-v3-tennis-europe-live.yml` — workflow live Tennis Europe;
- `.github/workflows/courtwatch-v3-tennis-europe-draw-backfill-once.yml` — workflow temporaneo di audit storico;
- `dist/v3/source_tennis_europe_entries.json` — iscrizioni Tennis Europe correnti;
- `dist/v3/source_tennis_europe_entries_sharded.json` — risultato del motore sharded;
- `dist/v3/source_tennis_europe_draw_audit.json` — audit T−1 ordinario;
- `dist/v3/source_tennis_europe_draw_backfill_audit.json` — audit storico straordinario.

## 9. Stato dei lavori

### Completato o sostanzialmente operativo

- scelta del motore FITP provinciale come principale;
- finestre FITP sovrapposte di 21 giorni;
- correzione dei codici provincia, incluso Roma 258;
- controlli di paginazione e confronto con nazionale;
- esclusione dei tornei ITF dal conteggio FITP;
- aggiunta di Andrea Losa/tessera FITP;
- aggiunta di Darko Sartori/tessera FITP e ricostruzione di 15 tornei storici/correnti;
- impostazione storage R2 con generazioni current/backup;
- scelta del motore Tennis Europe sharded;
- acceptance label MD/Q/A e ordinamento per priorità;
- gestione concettuale WC senza numero;
- regola T−1 sicura e conservativa;
- riconoscimento concettuale di tabelloni vuoti/solo Bye;
- audit storico in modalità non distruttiva.

### Da verificare o completare

1. Correggere definitivamente la sessione cookie wall in `acceptedCookie()`.
2. Ripristinare/proteggere la sorgente Tennis Europe validata: il commit `aa88fa9` del 17 agosto 2026 ha sostituito le 43 entry rimaste dopo le due scadenze con 38 record di struttura diversa. La protezione deve impedire a un workflow ex-novo o parziale di sovrascrivere acceptance list validate e storico.
3. Verificare una singola pagina tabellone via Node/GitHub Actions prima del backfill completo.
4. Ricostruire l’insieme esatto delle 44 iscrizioni storiche richieste; la sorgente corrente ne ha fornite 40.
5. Rilanciare una sola volta l’audit storico e produrre elenco giocatore per giocatore.
6. Rimuovere/disabilitare il workflow temporaneo di backfill al termine del test.
7. Verificare che il database Tennis Europe sia effettivamente pubblicato e aggiornato dal workflow live.
8. Verificare in produzione la visualizzazione WC per ogni torneo, non solo il parsing.
9. Validare l’avanzamento continuo della finestra Tennis Europe nel futuro.
10. Completare il motore ITF.
11. Completare il motore gare a squadre.
12. Solo dopo, progettare ordini di gioco e risultati separatamente per circuito.
13. Concludere la verifica R2 e, se tutte le generazioni sono sane, pianificare la pulizia della cronologia Git.

## 10. Procedura consigliata per riprendere in una nuova chat

### Fase A — mettere in sicurezza lo stato

1. Collegare il repository GitHub.
2. Leggere `main` e controllare gli ultimi workflow.
3. Non sovrascrivere modifiche locali o dati dell’utente.
4. Verificare che calendario e storico correnti siano integri.
5. Conservare l’ultima versione corretta prima di qualsiasi pubblicazione.

### Fase B — chiudere il problema cookie Tennis Europe

1. Ispezionare il blocco `acceptedCookie()` su `main`.
2. Eliminare le sequenze letterali `\n` introdotte nella riga commentata.
3. Implementare GET cookie wall + POST consenso con valori `1,2,4,16`.
4. Creare un test rapido su un solo URL noto.
5. Accettare il test solo se:
   - risposta HTTP 200;
   - `finalUrl` è il tabellone, non la cookie wall;
   - il titolo/heading identifica il tabellone;
   - il caso di esempio viene riconosciuto come empty/bye-only.

### Fase C — audit delle 44 iscrizioni

1. Recuperare la fotografia contenente le 44 iscrizioni storiche originarie.
2. Confrontarla con le 40 correnti e spiegare le quattro differenze.
3. Eseguire il backfill in `AUDIT_ONLY`.
4. Restituire per ogni giocatore e torneo:
   - torneo;
   - evento;
   - vecchia etichetta;
   - tabellone qualificazioni: mancante/vuoto/popolato/presente/assente;
   - main draw: mancante/vuoto/popolato/presente/assente;
   - decisione simulata.
5. Non applicare le rimozioni storiche al calendario senza una nuova istruzione esplicita dell’utente.
6. Eliminare il workflow temporaneo dopo il test.

### Fase D — proseguire Tennis Europe live

1. Lasciare il T−1 live limitato ai soli tornei con giocatori in acceptance list.
2. Aggiornare le etichette ogni 15 minuti, se il carico è sostenibile.
3. Salvare snapshot nel database/storico.
4. Applicare la regola conservativa sui tabelloni vuoti.
5. Pubblicare soltanto generazioni complete e validate.

### Fase E — sistemare le pagine personali dei giocatori

Attività sospesa da affrontare dopo il completamento del motore Tennis Europe T−1:

1. rendere esplicito l'ordinamento cronologico dei tornei nella pagina personale, senza dipendere dall'ordine ricevuto da `tournaments.json`;
2. ordinare per data di inizio, poi data di fine e infine nome del torneo;
3. definire chiaramente la separazione fra tornei futuri, in corso e conclusi;
4. verificare che storico, iscrizioni cancellate e conferme da tabellone siano rappresentati correttamente;
5. mantenere coerenti colori ed etichette dei quattro circuiti;
6. ordinare cronologicamente anche agenda, ordini di gioco e risultati quando saranno completi;
7. non modificare la pagina personale durante la correzione corrente del T−1, salvo interventi necessari a evitare regressioni.

## 11. Prompt pronto da usare in un’altra chat

> Sto continuando il progetto Court Watch v3 nel repository `png8nftp9y-alt/png8nftp9y-alt.github.io`. Leggi il report allegato prima di fare modifiche. Mantieni la grafica v3 invariata e applica sempre la regola “ultima versione corretta”: nessun dato parziale deve sostituire catalogo, calendario o storico. Il motore FITP principale è provinciale con 107 province, Roma codice 258, finestre sovrapposte di 21 giorni e nazionale solo come controllo. Tennis Europe usa il motore sharded, acceptance label MD/Q/A/WC, aggiornamento desiderato ogni 15 minuti e controllo T−1 soltanto sui tornei con nostri giocatori in lista. Al T−1 controlla entrambi i tabelloni di singolare; conferma il giocatore se compare in almeno uno, rimuovilo soltanto se entrambi sono pubblicati, popolati e affidabili e lui è assente. Tabelloni mancanti, vuoti o solo Bye sono inconcludenti e non devono rimuovere nessuno. Prima attività: correggi definitivamente `acceptedCookie()` in `src/v3/verify-tennis-europe-draws.mjs`, perché l’audit storico è ancora reindirizzato alla cookie wall. Verifica su una singola pagina nota, poi ripeti in sola lettura il test straordinario sulle 44 iscrizioni storiche, spiegando anche perché la sorgente corrente ne contiene 40. Non modificare il calendario durante questo audit e rimuovi il workflow temporaneo al termine.

Attività successiva già concordata: sistemare le pagine personali dei giocatori, garantendo direttamente nel rendering l'ordinamento cronologico dei tornei e, in seguito, di agenda e risultati.

## 12. Criteri di accettazione immediati

La prossima fase è conclusa soltanto quando:

- nessuna richiesta di tabellone finisce sulla cookie wall;
- il tabellone di esempio con 64 Bye è riconosciuto come pubblicato ma vuoto;
- i tabelloni popolati vengono distinti da quelli vuoti;
- sesso, fascia d’età, singolare/doppio e main/qualifying sono filtrati correttamente;
- l’audit copre esattamente le 44 iscrizioni richieste oppure documenta in modo verificabile ogni differenza;
- calendario e storico non cambiano durante il test;
- il workflow temporaneo viene rimosso dopo l’uso;
- il workflow live continua a proteggere l’ultima versione corretta.

## 13. Aggiornamento 24 agosto 2026 — nuovo motore ITF globale

Su richiesta dell’utente è iniziata la sostituzione del motore ITF iniziale con un’architettura equivalente al motore Tennis Europe.

### Pubblicazione iniziale

- commit atomico su `main`: `522d17f14f234e4b788d1b5048ddfce20935f5a4` — `Add sharded ITF global database engine`;
- copertura minima invariabile: dal `2025-12-18`;
- orizzonte iniziale: 730 giorni nel futuro;
- scansione geografica: `europe`, `americas`, `asia_pacific`, `africa_middle_east`, `other`;
- scansione live: 16 shard per acceptance list, partecipanti e risultati;
- frequenza catalogo: ogni 6 ore;
- frequenza live desiderata: ogni 15 minuti ai minuti `07`, `22`, `37`, `52`.

### Nuovi componenti

- `src/v3/itf-common.mjs` — normalizzazione, regioni, richieste ufficiali e utilità condivise;
- `src/v3/discover-itf-tournaments-shard.mjs` — catalogo mondiale per area geografica;
- `src/v3/merge-itf-tournament-shards.mjs` — merge, soglia minima e continuità/last-known-good;
- `src/v3/discover-itf-acceptance-shard.mjs` — acceptance list ufficiali, database partecipanti e matching dei nostri giocatori;
- `src/v3/merge-itf-acceptance-shards.mjs` — merge completo dei 16 shard;
- `src/v3/verify-itf-draws.mjs` — etichette MD/Q/A e controllo T−1 conservativo;
- `src/v3/discover-itf-results-shard.mjs` — acquisizione giocatori e risultati ufficiali;
- `src/v3/maintain-itf-database.mjs` — catalogo storico tornei, relazioni giocatore-torneo e database completi giocatori/risultati;
- `src/v3/validate-itf-system.mjs` — blocco della pubblicazione se catalogo, acceptance, T−1 o database sono incompleti;
- `src/v3/itf-r2-cache.sh` — generazioni R2 con `current`, `backup-1`, `backup-2`;
- `.github/workflows/courtwatch-v3-itf-tournaments-sharded.yml` — pipeline catalogo geografico;
- `.github/workflows/courtwatch-v3-itf-live.yml` — pipeline live, database, R2 e merge app.

### Regole di sicurezza introdotte

- una risposta ITF anti-bot con HTTP 200 ma contenuto non JSON non è mai considerata una lista vuota;
- un ciclo incompleto deve fallire prima della pubblicazione;
- una rimozione T−1 è ammessa solo quando un tabellone ufficiale di singolare contiene almeno quattro partecipanti leggibili ed il giocatore è assente;
- pagine mancanti, illeggibili o tabelloni non sufficientemente popolati restano inconcludenti e mantengono l’iscrizione;
- i file pesanti con tutti i partecipanti, giocatori e risultati restano su R2; su GitHub vengono pubblicati cataloghi, relazioni e audit leggeri.

### Stato al momento di questo aggiornamento

- sintassi Node di tutti i nuovi moduli: verificata;
- sintassi shell R2: verificata;
- `git diff --check`: superato;
- primo ciclo reale GitHub Actions: avviato automaticamente dal commit; validazione dei conteggi e compatibilità precisa con gli endpoint dinamici ITF ancora in corso;
- il vecchio dato ITF resta la versione pubblica valida finché il nuovo sistema non supera tutte le soglie.

## 14. Aggiornamento 25 agosto 2026 — catalogo ITF completo e motore live ufficiale

Il primo catalogo geografico validato è stato pubblicato dal commit `df58e2dade2bf422b1c6faab4036aa0b79e3c984`.

- copertura: dal `2025-12-18` al `2028-08-24`;
- tornei distinti: **1.058**;
- Europa: 428;
- Americhe: 236;
- Asia-Pacifico: 223;
- Africa/Medio Oriente: 160;
- altre aree: 19;
- errori del merge geografico: 0.

Sono stati identificati e adottati gli endpoint JSON ufficiali ITF:

- `GetCalendar` per il catalogo;
- `GetAcceptanceList` per MD/Q/A e tutti i partecipanti;
- `GetEventFilters` per ricavare gli eventi effettivamente disponibili;
- `GetDrawsheet` per tabelloni KO/RR, giocatori, incontri e risultati.

Il commit `34787997efd6f7a461877b90057d3b79378d801c` (`Complete official ITF live database engine`) ha:

- eliminato il filtro errato che limitava il matching ai soli profili già marcati `ITF`; ora tutta la rosa Court Watch viene confrontata con le liste ITF;
- implementato lo schema reale `givenName` + `familyName` e la conversione `M → MD`, `Q → Q`, `A → A`;
- implementato tabelloni ufficiali singolare/doppio, KO/RR, main/qualifying;
- applicato il T−1 conservativo ai tabelloni di singolare;
- reso permanenti e incrementali in R2 i database compressi di partecipanti, giocatori e risultati, mantenendo le generazioni `current`, `backup-1`, `backup-2`;
- cambiato il cron live da 15 a **14 minuti** con `*/14 * * * *`.

Nota operativa: GitHub cron interpreta `*/14` all'interno di ogni ora (`00, 14, 28, 42, 56`); il passaggio `56 → 00` è quindi di 4 minuti. La concorrenza impedisce sovrapposizioni. È la configurazione richiesta, ma non rappresenta un intervallo matematicamente costante di 840 secondi attraverso il cambio d'ora.

La scansione locale completa delle 1.058 acceptance list ha incontrato risposte anti-bot HTTP 200 non JSON dopo molte richieste concorrenti. Tali risposte sono state correttamente registrate come errore e non come lista vuota; non è stato pubblicato un conteggio falso dei tornei con nostri giocatori. Il conteggio ufficiale va letto soltanto dalla prima generazione GitHub/R2 che supera tutti i 16 shard e la validazione `itf_system_complete`.

Dopo la verifica degli endpoint, il materiale diagnostico temporaneo (`temp-itf-site-diagnostic.yml`, `diagnose-itf-site.mjs`, `itf_site_diagnostic.json`) è stato rimosso da `main` con il commit `961cafca31a4dec636b129366d656f01373815ed`. Il catalogo geografico è stato rigenerato dal bot nel commit `adc0a8adcaff3efe461153ab83c1afb6f255161e`, discendente dal nuovo motore.

### Perimetro definitivo della rosa ITF

L'utente ha precisato che il motore deve cercare soltanto i **23 giocatori titolari**. Il commit `e9bb954820ad4224320bf22442d495feb6eff1a9` esclude automaticamente dal matching ITF i quattro profili presenti in `former-players.json`: Martina Busa, Manuel Natale, Pietro Sala e Niccolò Zanaga. Il database generale può conservarne lo storico, ma nuovi conteggi, MD/Q/A e controlli T−1 riguardano esclusivamente i 23 titolari.

### Separazione backfill/live per superare l'anti-bot

Il commit `17e36f0f7d6a837c0682f10b06e309debc7868ef` separa definitivamente:

- backfill completo e rallentato dal 18/12/2025, eseguito con un solo shard alla volta e pause/retry sulle risposte non JSON;
- live ogni 14 minuti, limitato alla finestra utile delle acceptance list (−21/+120 giorni) e a risultati/tabelloni attivi o recenti (−35/+7 giorni), con massimo due shard concorrenti;
- retry progressivi anche sulle risposte anti-bot HTTP 200 non JSON;
- cancellazione del live precedente quando arriva un ciclo più recente, evitando code e sovrapposizioni.

Il workflow straordinario `.github/workflows/courtwatch-v3-itf-backfill.yml` è stato avviato automaticamente dal commit `4a7a40ee503e81c7a392a5330bcce37b80221731`. Se tutti i 16 shard superano la validazione, pubblica la prima generazione completa su R2 e il commit `Publish complete ITF backfill database`; in caso contrario non sostituisce l'ultima versione valida.

Il primo tentativo risultava ancora sul primo shard perché ogni shard eseguiva consecutivamente sia acceptance sia tutti i tabelloni/risultati. Il commit `3de21be5931142a445d2c510ae81f77ffd575ae6` ha corretto la pipeline: due shard acceptance alla volta; pubblicazione immediata del conteggio verificato tramite commit `Publish verified ITF player tournament count`; solo dopo, fase separata dei risultati con due shard concorrenti. Il nuovo run cancella automaticamente il precedente. Questa separazione riduce il tempo necessario per ottenere il conteggio senza compromettere il database completo successivo.

Poiché anche due shard acceptance richiedevano oltre sei minuti per il primo blocco, il commit `b1ebe6f99bb97807c25373f4e33c5b3550be9d63` ha introdotto il percorso rapido ufficiale `PlayerApi/GetPlayerSearch` + `PlayerApi/GetPlayerActivity`: prima risolve gli ID ITF dei 23 titolari e ricostruisce direttamente la loro attività dal 18/12/2025; solo dopo continua il controllo globale delle acceptance list. Il conteggio rapido usa decine di richieste invece di oltre mille. Il run GitHub Actions associato è `32786909582`; il precedente `32786046775` è destinato alla cancellazione tramite il gruppo di concorrenza.

Il run rapido `32786909582` è terminato con errore controllato alle 22:56:46. `GetPlayerSearch` ha risolto un solo profilo esatto tra i 23 titolari: Martina Danesi, World Tennis ID `800792690`. Per Mattia Garibaldi, Nicholas Scappa e Nikola Nikolaev Kerkenyakov la ricerca è diventata illeggibile dopo l'attivazione dell'anti-bot; per gli altri 19 non è emerso un profilo ITF esatto. Le tre richieste annuali `GetPlayerActivity` di Martina sono risultate illeggibili, quindi lo zero prodotto dal job non è valido e non è stato pubblicato. Controlli web indipendenti confermano almeno tre presenze di Martina dal periodo richiesto: J30 Compiegne, J30 Cuneo e J30 Szentes; questo è un minimo verificato, non ancora il conteggio definitivo.

Il fallimento del job rapido bloccava per dipendenza tutti gli shard acceptance. Il commit `c1e9a7a058a84b0b0074f152746f19f99cab72c7` lo rende diagnostico e non bloccante: se parziale non pubblica un conteggio, ma termina correttamente e lascia proseguire il backfill. Gli shard acceptance sono ora quattro in parallelo con 2,5 secondi di pausa per singolo runner, mantenendo il ritmo aggregato controllato. Il nuovo run attivo è `32787985907`; il run precedente lento `32786046775` risulta cancellato e quello rapido fallito `32786909582` è archiviato.

### Regola ITF anticipo di 2 giorni per mappa e T−1

Il commit `e0f18abc785ad379485856f5c764582675cc3b28` aveva inizialmente interpretato in modo errato la regola come `+2 giorni`. Il commit correttivo `ece3c50cb5109e70b0c8613fd7804e1728ebc204` (`Correct ITF start offset to two days earlier`) stabilisce la regola definitiva richiesta dall'utente:

- nella mappa finale, soltanto la data iniziale ITF è visualizzata come `data ufficiale di inizio − 2 giorni`;
- la data finale resta identica alla data ufficiale ITF;
- `officialStartDate` conserva nel record della mappa la data iniziale originale;
- il database sorgente e le relazioni storiche mantengono entrambe le date ufficiali senza alterazioni;
- il controllo T−1 ITF usa come riferimento la nuova data iniziale anticipata di 2 giorni, quindi scatta il giorno precedente a quella data;
- FITP e Tennis Europe non sono interessati dalla regola.

Verifiche eseguite: `node --check` su `entries-engine.mjs` e `verify-itf-draws.mjs`, più `git diff --check`, tutte superate.

## 15. Aggiornamento 25 agosto 2026 — finestra mobile uniforme FITP, Tennis Europe e ITF

Il commit `2485c83c29f753e8a19a664f07a9c83f8edc19fb` (`Align FITP and ITF rolling windows with permanent history`) uniforma i tre circuiti al modello già attivo su Tennis Europe.

- finestra live: da `oggi − 240 giorni` a `oggi + 730 giorni`;
- a ogni cambio di giornata il limite passato avanza di un giorno e quello futuro aggiunge un giorno;
- uscire dalla finestra live significa soltanto non essere più interrogato: nessun torneo viene cancellato;
- storico permanente minimo invariato dal `18/12/2025`;
- FITP conserva catalogo/partecipanti nel proprio archivio permanente e nelle generazioni R2;
- ITF conserva catalogo, relazioni giocatore-torneo, giocatori e risultati nel database storico/R2; i record fuori finestra vengono marcati non correnti, non eliminati;
- entrambi i merge bloccano la pubblicazione se gli shard non hanno la stessa finestra, se la finestra non corrisponde al giorno corrente o se la continuità col catalogo valido precedente scende sotto la soglia;
- Tennis Europe era già configurato con la stessa finestra e non è stato modificato.

La fase acceptance del backfill ITF è terminata nel commit automatico `879ef955455079fe4646536444e5ab952920b1c0`: 1.058 tornei controllati, stato `itf_acceptance_complete`, 1 entry dei 23 titolari, 0 errori. La fase results shard completa è ancora in corso ed è necessariamente più lunga perché acquisisce tabelloni, giocatori, incontri e risultati storici di tutti i tornei; i successivi cicli live restano limitati alla finestra attiva/recente.

Verifiche della modifica: sintassi Node dei sei moduli, `git diff --check` e controllo matematico `240/730` superati. La pubblicazione ha modificato soltanto i sei file dei motori/cataloghi e non ha riavviato il backfill results già in corso.

### Accelerazione del backfill risultati ITF

Il run `32787985907` aveva completato tutti i 16 acceptance shard e pubblicato il conteggio, ma la fase risultati eseguiva soltanto due shard contemporaneamente: al controllo risultavano attivi `result-shard (0)` e `(1)`, mentre gli altri erano in coda. Il commit `72291961416a00375fdd580dbc001b5ae5dcbc1e` (`Accelerate resumable ITF results backfill`) sostituisce questa coda con un workflow dedicato:

- non ripete l'acceptance: riutilizza gli artifact già validi del run `32787985907`;
- divide i 1.058 tornei in 32 result shard più piccoli;
- esegue fino a 8 shard in parallelo;
- mantiene un ritardo di 2,4 secondi per runner, retry anti-bot e timeout per singolo shard;
- usa lo stesso gruppo di concorrenza del vecchio backfill, quindi la nuova esecuzione sostituisce automaticamente quella lenta;
- `maintain-itf-database.mjs` non assume più esattamente 16 file risultati, ma acquisisce dinamicamente tutti gli shard validi presenti;
- la pubblicazione finale resta atomica e avviene soltanto dopo merge acceptance, T−1, database, validazione e salvataggio R2.

Verifiche: sintassi Node, parsing YAML e `git diff --check` superati. Il workflow rapido è attivato dal commit stesso.

#### Correzione dei falsi fallimenti results shard

Il primo run del workflow rapido, `32790482361`, ha mostrato che la velocità non era la causa del fallimento. Esempi verificati dai log:

- shard 0: 36 tornei, 784 giocatori, 1.149 incontri, 21 errori di singolo evento;
- shard 3: 22 tornei, 371 giocatori, 584 incontri, 25 errori di singolo evento;
- shard 4: 24 tornei, 407 giocatori, 467 incontri, 22 errori di singolo evento.

Lo script confrontava erroneamente il numero di errori dei singoli tabelloni/eventi con il numero dei tornei dello shard e terminava con exit code 2, pur avendo acquisito centinaia di giocatori e incontri. Il commit `71b0ed3d53a0575a9b7d1951ea06738572c66371` (`Fix ITF results shard failure classification`) corregge il criterio:

- soltanto l'impossibilità di leggere `GetEventFilters` per troppi tornei è bloccante;
- un singolo tabellone non disponibile viene registrato in una `retryQueue`, senza scartare lo shard valido;
- output e audit passano allo schema versione 3 con `drawsRead`, `blockingTournamentFailures`, limite bloccante e coda di retry;
- il workflow rapido si riattiva anche quando cambia `discover-itf-results-shard.mjs`, sostituendo automaticamente il run basato sulla soglia errata.

La protezione ultima-versione-corretta resta attiva: la pubblicazione finale richiede ancora che la soglia degli errori realmente bloccanti sia rispettata e che database/R2 superino la validazione.

### Regola ITF dopo la scomparsa dell'acceptance list

È stato chiarito che, diversamente da Tennis Europe, a T−1 l'acceptance list ITF può scomparire e non essere più consultabile. La scomparsa della lista non dimostra né la presenza né l'assenza del giocatore nel torneo.

L'anomalia Cuneo/Palermo è stata ricostruita con precisione:

- la versione precedente conteneva Martina Danesi a `J30 Cuneo` (`J-J30-ITA-2026-002`) come seed ufficiale;
- il commit `879ef955455079fe4646536444e5ab952920b1c0` ha rigenerato `source_itf_entries.json` dalle sole acceptance list correnti;
- Cuneo, già oltre la fase acceptance, non era più restituito e quindi è scomparso;
- `J100 Palermo`, ancora futuro e con acceptance list disponibile, è stato invece trovato come `A`;
- Cuneo è rimasto nella sorgente FITP grezza, ma è correttamente escluso dal calendario FITP perché è un torneo ITF.

Su istruzione esplicita dell'utente, Cuneo non deve essere ripristinato da seed o vecchie entry: deve essere trovato nel tabellone ufficiale, altrimenti non deve comparire.

Il commit `3f468503edc34002454d6408ffd91a8ff4f86023` (`Discover ITF entries from official draws after T-1`) introduce `src/v3/discover-itf-draw-entries.mjs`:

- legge soltanto i tabelloni/risultati ufficiali già acquisiti nei result shard;
- confronta tutti i nomi dei tabelloni con i 23 titolari e i rispettivi alias esatti;
- crea una entry `draw_confirmed` soltanto quando il giocatore è realmente presente;
- non ripristina automaticamente acceptance scomparse o entry storiche;
- se il giocatore non è trovato nel tabellone, non crea alcuna entry;
- viene eseguito sia nel backfill risultati sia nel motore live, prima della verifica T−1 e della costruzione del database/calendario;
- produce `source_itf_draw_entry_discovery_audit.json` con shard letti, incontri, nomi e giocatori trovati.

Nuovi run attivati dal commit: fast results backfill `32791934553` e live ITF `32791934739`.

### Regola definitiva ITF: stesso comportamento Tennis Europe

Il commit `67186bd65335353f9914bda78b762e729d43a5c5` (`Apply historical and live ITF draw scan rules`) separa i due percorsi:

- backfill storico una tantum: analizza tutti i tabelloni ITF ufficiali dei tornei dal `18/12/2025` fino al giorno corrente, perché le acceptance list dei tornei conclusi non sono più disponibili;
- motore live ogni 14 minuti: interroga i tabelloni soltanto dei tornei nei quali uno dei 23 titolari era stato precedentemente trovato in una acceptance list ufficiale;
- i bersagli live vengono salvati automaticamente in `history/itf_draw_target_db.json`; non esistono seed o ripristini manuali per Cuneo o altri tornei;
- il backfill continua a creare una relazione soltanto quando il giocatore viene realmente trovato in un tabellone ufficiale.

Il chiarimento successivo stabilisce che la macchina decisionale ITF deve essere identica a Tennis Europe. La sola differenza è tecnica: ITF rimuove dal sito l'acceptance list quando comincia la pubblicazione dei tabelloni, quindi CourtWatch ne conserva localmente l'ultima copia ufficiale valida. Il commit correttivo `3b38527f8023d3247a649f7c54327f36a994f593` (`Match ITF T-1 decisions to Tennis Europe`) applica la regola definitiva:

- appena il giocatore compare nell'acceptance, il torneo compare in mappa con etichetta `MD-n`, `Q-n` oppure `A-n`;
- da T−1, se il giocatore compare in almeno un tabellone singolare o gruppo/girone ufficiale compilato, resta permanentemente in mappa e l'etichetta acceptance viene rimossa;
- l'assenza dalla sola qualificazione non consente la rimozione;
- se una fase è compilata ma un'altra fase rilevante è ancora vuota, mancante o illeggibile, il torneo resta in mappa con l'ultima etichetta acceptance e la decisione rimane in attesa;
- la rimozione è consentita soltanto dopo una fase finale singolare compilata, assenza del giocatore da tutte le fasi compilate e assenza di sezioni rilevanti ancora vuote o illeggibili;
- lo stato (`pending`, `confirmed`, `removed`) e l'ultima acceptance ufficiale vengono conservati nel database bersagli e pubblicati con ogni ciclo live.

Verifiche eseguite: sintassi Node dei moduli merge/verifica, parsing YAML dei workflow live/backfill e `git diff --check`, tutte superate. Il commit correttivo sostituisce automaticamente il precedente run live tramite il gruppo di concorrenza.

### Revisione obbligatoria prima della pubblicazione ITF

Il controllo del run live `32792464234` ha dimostrato che gli shard acquisivano dati reali: lo shard 0 ha letto 32 tornei, 4 acceptance list e 658 partecipanti. Cinque richieste hanno restituito pagine anti-bot non JSON. Lo shard le classificava correttamente come retryable e terminava con successo, ma il merge bloccava erroneamente qualsiasi stato `partial`, anche sotto la soglia ammessa.

Il commit `75904f58ee154141ae2ba36b8ec67211886e5560` (`Align ITF acceptance merge retry thresholds`) uniforma il merge alla stessa soglia degli shard: gli errori entro `max(5, 15% dei tornei)` vengono registrati come warning/retry e non bloccano il database; soltanto il superamento della soglia è fatale.

Su richiesta dell'utente, nessun nuovo dato ITF deve essere pubblicato prima di aver comunicato l'elenco dei tornei trovati. Il commit `9c73e39c0a6260b7a079f1e301048fc454d3079f` (`Require ITF tournament review before data publication`) trasforma quindi entrambe le pipeline in modalità revisione:

- live e backfill continuano acquisizione, merge, verifica T−1, costruzione e validazione del database candidato;
- sono disabilitati il caricamento R2 e il commit automatico dei dati nell'app;
- ogni pipeline carica un artifact di revisione contenente entry, audit dei tabelloni, relazioni giocatore-torneo e diagnostica;
- l'elenco dei tornei candidati deve essere estratto dall'artifact e comunicato all'utente prima della successiva pubblicazione;
- i nuovi run di revisione sono `32792867960` (live) e `32792867944` (backfill storico); i gruppi di concorrenza sostituiscono i run precedenti.

Verifiche: parsing YAML, assenza di comandi `R2 publish`/`git push` nei due workflow e `git diff --check`, tutte superate.

### Eliminazione del falso fallimento acceptance shard

Nel run di revisione live `32792867960`, lo shard 1 ha acquisito 36 tornei, 7 liste pubblicate, 1.299 partecipanti e 1 entry dei titolari. Sei richieste hanno restituito una pagina anti-bot non JSON; il vecchio limite era `max(5, 15%) = 5,4`, quindi la sesta risposta ha causato exit code 2 nonostante l'acquisizione sostanziale fosse valida.

Il commit `61af12884ef5682783e3d2c9fbdf2a4d607f67d5` (`Retry ITF acceptance misses without false shard failures`) introduce lo schema acceptance shard versione 3:

- le singole risposte anti-bot/API irrisolte dopo i retry interni entrano in `retryQueue`;
- uno shard con partecipanti reali non fallisce per poche richieste irrisolte;
- il blocco resta possibile soltanto in caso di collasso quasi totale: almeno il 90% dei tornei fallito e zero partecipanti acquisiti;
- il merge tratta la retry queue come warning e blocca soltanto shard esplicitamente `blocked` o artifact mancanti;
- nessuna decisione T−1 viene presa usando un tabellone mancante, e la modalità revisione continua a impedire qualsiasi pubblicazione automatica.

Il nuovo run live sostitutivo è `32793172919`. Il backfill storico resta separato e non presentava shard falliti al momento della correzione.

### Completamento result shard e correzione della review

Il backfill di revisione `32792867944` ha mostrato un secondo falso fallimento. Lo shard risultati 0 aveva acquisito 19 tornei, 30 tabelloni, 723 giocatori e 1.043 incontri; 13 chiamate `GetEventFilters` erano finite nella retry queue. La precedente soglia lo marcava comunque `blocked`, causando il fallimento del job pur in presenza di un artifact consistente.

La review live `32793172919` aveva invece completato con successo tutti i 16 shard. Il merge aveva elaborato 444 tornei, 15.651 partecipanti e 1 entry dei titolari, ma `maintain-itf-database.mjs` accettava soltanto la stringa esatta `itf_acceptance_complete` e rifiutava il nuovo stato valido `itf_acceptance_complete_with_retryable_errors`.

Il commit `b5cd79ae6b074e3c31fd2324ea05e9a5e3a58c70` (`Complete ITF result shards and review validation`) corregge entrambi i punti:

- un result shard con incontri reali viene completato e conserva le richieste irrisolte nella retry queue;
- il blocco resta soltanto per collasso quasi totale: zero incontri e almeno il 90% dei tornei senza `EventFilters`;
- `maintain-itf-database.mjs` accetta tutti gli stati che iniziano con `itf_acceptance_complete`, ma continua a rifiutare gli stati realmente incompleti o bloccati;
- i nuovi run puliti sono `32794205080` (live) e `32794205074` (backfill storico);
- la modalità review resta attiva: nessuna scrittura su R2, database pubblicato o mappa prima dell'elenco comunicato all'utente.

Verifiche: sintassi Node e `git diff --check` superati.

### Decisione architetturale: backfill storico separato dal motore periodico

Il 25/08/2026 è stato confermato il punto 6 della strategia ITF: il recupero storico dal 18/12/2025 diventa un processo separato, finito, persistente e riprendibile. Non deve più essere eseguito nel ciclo ITF ogni 14 minuti.

Il motore periodico resta dedicato ai tornei correnti e futuri e, in fase T−1, controlla i tabelloni soltanto dei tornei nei quali uno dei 23 titolari era stato trovato nell'acceptance list. Il backfill storico conserva un checkpoint per ogni torneo/sezione, non ripete dati già acquisiti e termina soltanto quando ogni sezione è classificata come popolata oppure definitivamente verificata; challenge, HTML anomalo e risposte illeggibili restano pendenti e non vengono trasformati in assenze.

Al momento della decisione, nel lotto precedente di 16 tornei risultano 10 tornei completamente risolti e 6 tornei con una sola sezione ancora illeggibile: J-J100-EGY-2026-001, J-J100-EGY-2026-003, J-J100-ESP-2026-005, J-J100-FIN-2026-001, J-J100-GBR-2026-002 e J-J100-GBR-2026-004. La coda automatica completa `32805787865` è in esecuzione con due worker.

### Rimozione immediata dei withdrawn ITF

Il 25/08/2026 è stata applicata la regola richiesta: quando la fonte ufficiale ITF indica esplicitamente un titolare come `Withdrawn`, la coppia giocatore-torneo viene esclusa dalle entry visibili e quindi rimossa dalla mappa. L'assenza momentanea dalla acceptance list non equivale a withdrawn e continua a essere gestita dalla macchina a stati T−1.

La discovery acceptance ora conserva separatamente i withdrawn espliciti, inclusi i codici W/WD/WDR e gli stati testuali di ritiro. Il merge assegna `drawDecision: removed` e `removalReason: withdrawn`, impedendo che una vecchia acceptance o una precedente conferma in tabellone ripubblichi il torneo. Lo storico partecipanti conserva il ritiro come dato di audit. Commit remoti: `3a9e7445cc28639b41c5e0d8ae2ead8c24fedb4f` e `e67d6272786be8a6be5a4a1e2405a9fc9fbc3f5a`.

### Prova integrazione acquisitore persistente

È stata verificata la base già presente nel repository: CourtWatch dispone già di cache persistente ITF su R2 per partecipanti, giocatori e risultati tramite `src/v3/itf-r2-cache.sh`, e il workflow live possiede già la configurazione dei secret R2. Manca invece un servizio browser persistente che acquisisca e depositi in R2 le risposte `GetEventFilters` e `GetDrawsheet`; attualmente `itf-common.mjs` le richiede ancora direttamente da GitHub Actions.

Il tentativo isolato di verificare l'endpoint ITF con il browser cloud disponibile nella sessione è stato bloccato dalla policy URL del browser prima della navigazione; non è stato effettuato alcun tentativo di aggiramento e nessun dato o file della mappa è stato modificato. Per completare la prova serve quindi un endpoint del browser persistente/VPS, oppure l'accesso alla relativa infrastruttura, da collegare come fonte opzionale cache-first.

### Ripristino del percorso di acquisizione ITF esistente

Il 25/08/2026 i run live `32835228694` e `32841246368` sono falliti prima della scansione per un errore di sintassi introdotto nell'adattatore opzionale del browser persistente: una regex non valida in `itf-common.mjs`. Il guasto non era causato da ITF o Imperva; impediva a Node di caricare il modulo e faceva fallire tutti i 16 acceptance shard.

Su richiesta di mantenere l'architettura esistente, l'adattatore opzionale è stato rimosso dal percorso operativo e `request()` è stato ripristinato alla lettura diretta precedente. Sono state rimosse anche le variabili opzionali dal workflow live. Commit: `d96ea58ea01b98f5332ef690fd7658bb15735166` e `2ddb451908b7bfbba30d4bc75ab430d4fc25f715`. Il run sostitutivo è stato avviato automaticamente; resta distinto il limite strutturale delle challenge Imperva sui singoli endpoint.

### Sessione cookie ITF modellata sulla soluzione Tennis Europe

È stato confrontato il motore Tennis Europe con ITF. Tennis Europe esegue bootstrap della sessione, mantiene un cookie jar, segue i redirect e riutilizza i cookie nei tabelloni; ITF effettuava invece richieste API indipendenti senza una sessione preventiva.

È stato aggiunto un diagnostico isolato, senza pubblicazione. Il primo run `32856881915` su Palermo ha acquisito i cookie `ARRAffinity`, `ARRAffinitySameSite`, `nlbi_178373`, `visid_incap_178373` e `incap_ses_*`; `GetEventFilters` ha restituito JSON valido ma zero combinazioni, correttamente, perché Palermo è ancora futuro e i tabelloni non sono pubblicati.

Il secondo run `32857036648` su J100 Punta Cana concluso è riuscito completamente: pagina torneo e redirect letti nella stessa sessione, 5 cookie conservati, `GetEventFilters` JSON da 2.226 byte con 6 combinazioni e `GetDrawsheet` JSON da 31.756 byte. Questo dimostra che il modello di sessione già usato per Tennis Europe è applicabile agli endpoint ITF.

Il commit `a032731306c877126174fa82c008486d6c3b0da5` integra nel motore ITF il bootstrap della pagina torneo, cookie jar condiviso nel processo, redirect manuali, cookie Imperva/Azure, Referer e intestazioni XHR coerenti prima di `GetEventFilters` e `GetDrawsheet`. La logica T−1, le decisioni di mappa e il database non cam…352 tokens truncated…e il matcher con `ITF_HISTORICAL_T_MINUS_ONE=1`, poi aggiorna tramite `maintain-itf-database.mjs` gli stessi database `itf_player_tournament_db`, giocatori e risultati usati dal motore T−1. Nessuna pubblicazione automatica. Run sostitutivo: `32862536274`.
- Esito run `32862536274`: tutti i 32 shard hanno completato con successo, ma la review ha correttamente fallito perché ha contato 720 retry. Diagnosi su shard 0: 19 tornei assegnati, 1 letto e 18 `GetEventFilters_incapsula_challenge`; il cookie jar globale veniva riutilizzato tra tornei diversi.
- Commit `a3488f2cb516c20f8ff6f6511524649f6a0de439`: sessione Imperva isolata per torneo (`ITF_COOKIE_JAR.clear()` all'inizio del bootstrap), fino a tre bootstrap completi per `GetEventFilters`, propagazione della `sourceUrl` nelle combinazioni e nuovo bootstrap automatico anche durante `GetDrawsheet` se ricompare la challenge.
- Commit `eba74b37cd1e272754f891cee445953f2c12ee6a`: aggiunto `src/v3/itf-common.mjs` ai trigger del backfill pulito e avviata la nuova ricostruzione completa. Run: `32863254569`.
- Nel run `32863254569`, 31 shard su 32 hanno completato; lo shard 4 è rimasto attivo anormalmente a lungo. Lo shard 4 contiene 16 tornei nella finestra, di cui 14 già conclusi e 2 iniziati il 24 agosto ancora in corso.
- Per evitare di ripetere i 31 shard completati, commit `d74c719c5acf4cc53e47af696d1288403dabd839`: nuovo workflow di recupero `courtwatch-v3-itf-shard4-rescue.yml`, che divide la partizione 4 in 16 sottopartizioni indipendenti (`TOTAL=512`) con timeout individuale di 20 minuti, usa soltanto tornei già conclusi fino al 23 agosto, riutilizza gli artifact degli altri shard e richiede zero retry nella review complessiva. Run: `32864756948`.
- Riscrittura strutturale richiesta: aggiunti `scan-itf-history-tournament.mjs`, `run-itf-history-worker.mjs` e `merge-itf-history-tournaments.mjs`. Ogni torneo concluso dal 18 dicembre 2025 è ora un'unità persistente indipendente con file, stato, sezioni, match, retry e timeout propri; il worker continua anche se una singola unità fallisce o scade. Il merge confronta gli artifact con l'intero catalogo atteso e rifiuta la generazione per qualunque torneo mancante o incompleto.
- Nuovo workflow permanente `.github/workflows/courtwatch-v3-itf-history-engine.yml`: 32 worker, massimo 16 concorrenti, subprocess separato per torneo, timeout individuale 240 secondi, review comune con matcher dei 23 titolari e aggiornamento dello stesso database ITF T−1. Commit finali `7a147c8`, `d788b70`, `7722460`, `1a40dd8`, avvio `805a295c3bf196ea9e9b85324ace0bab8d55aebe`; run `32865143864`.
- Il run `32865143864` ha dimostrato che un subprocess per torneo non isola l'IP: il primo torneo del runner passa e i successivi vengono bloccati. Test causale su tre runner distinti (`32865738560`): Messico e Sudafrica completi; Portogallo legge 5 tabelloni su 6 e viene bloccato sull'ultimo `G-D-M-KO`. Ripetizione con pacing 5 secondi (`32865920202`) fallita sullo stesso sesto tabellone: la soglia è per sessione/IP, non per velocità.
- Aggiunto `scan-itf-history-event.mjs` e isolato soltanto il tabellone residuo portoghese `G-D-M-KO` su un nuovo runner. Run `32866118162` completato con successo. Causa e soluzione dimostrate: prima unità per torneo su runner isolato; ogni tabellone residuo viene ritentato singolarmente su un nuovo runner, senza ripetere quelli già acquisiti.
- Percorso definitivo chiarito: l'obiettivo corrente è contare i tornei ITF nei quali compaiono i 23 titolari; gli ordini di gioco sono esplicitamente rinviati. La pipeline viene separata in inventario tornei/tabelloni, acquisizione indipendente di ogni tabellone, salvataggio completo di giocatori/incontri/risultati, matcher e conteggio.
- Implementata la base della pipeline a due fasi: `inventory-itf-history-tournament.mjs` produce l'inventario ufficiale degli eventi per torneo; `build-itf-history-draw-queue.mjs` confronta l'inventario con tutti i tornei conclusi dal 18 dicembre 2025 e costruisce task identificati `competitionId__event`; `acquire-itf-history-draw-task.mjs` acquisisce un singolo tabellone e salva giocatori, incontri, punteggi e risultati normalizzati. Commit `cdb2194`, `3a7fbd2`, `8a8f1e3`.
- Avviata la fase inventario completa: `inventory-itf-history-tournament.mjs` supporta indici deterministici sull'elenco ordinato dei tornei conclusi (commit `3c143a4`). Il workflow `courtwatch-v3-itf-history-inventory.yml` distribuisce fino a 800 tornei in quattro onde da 200 job, un torneo per runner, massimo 32 concorrenti per onda; la review unisce gli inventari e genera `itf_history_draw_queue.json`. Commit di avvio `afdda23e4dca0b0257b2a399a334030b8b4909c1`, run `32868353005`.
- Chiarimento sul consumo: l'utente intende minimizzare i crediti della chat, non i costi dei runner GitHub. L'architettura del motore deve quindi restare quella tecnicamente più affidabile (inventario, acquisizioni isolate per tabellone, merge completo), senza compromessi funzionali per ridurre GitHub Actions. Durante le attese l'assistente deve fermarsi, evitare polling ripetuti e indicare all'utente quale run/job e quali valori verificare. `acquire-itf-history-draw-task.mjs` supporta indici di coda (commit `0b324b8`).
- Verifica del run inventario `32868353005`: tutti gli 800 job di inventario risultano completati con successo, ma il job finale di review/merge non è stato creato dal workflow matrice ed il run padre è rimasto bloccato. Non è necessario ripetere gli 800 inventari.
- Creato un workflow indipendente di sola unione, `.github/workflows/courtwatch-v3-itf-inventory-merge.yml`, che scarica gli 800 artifact dal run `32868353005`, esegue `build-itf-history-draw-queue.mjs` e salva `itf-history-draw-queue`. Commit iniziale `3d4effa551d714b80797412e8ffc7a632b7990cf`; commit di attivazione `66b6775f7654477909588b38d67eedaaa3f62e85`.
- Al primo controllo dopo il commit di attivazione GitHub aveva registrato soltanto il deploy Pages e non ancora il workflow di merge. Per limitare il consumo di crediti ChatGPT non viene eseguito polling: verificare nella scheda Actions la comparsa di `Court Watch v3 ITF inventory merge`; al termine annotare i cinque valori `expected`, `inventoried`, `missing`, `retry`, `tasks`.
- Poiché il push del file workflow non ha creato alcuna esecuzione, il trigger è stato sostituito con `workflow_run` sulla conclusione di `pages build and deployment` (commit `95331b50d2e7caba3ec91c7d468379eb96e94f8b`). Gli 800 inventari prodotti dal run `32868353005` restano validi e non vengono ripetuti; manca ancora il merge necessario a costruire la coda dei tabelloni, quindi non è ancora disponibile il conteggio dei tornei con i 23 titolari.
- Correzione dello stato: il primo merge indipendente era in realtà partito e completato con successo nel run `32869802974`, job `merge`, step `Run node src/v3/build-itf-history-draw-queue.mjs`. Valori: `expected=682`, `inventoried=599`, `missing=83`, `retry=0`, `tasks=3808`. L'inventario non è quindi ancora completo: gli 83 tornei mancanti devono essere acquisiti prima di avviare la lettura dei 3.808 tabelloni.
- Causa degli 83 mancanti: i job a indice hanno usato la fotografia del catalogo disponibile nel commit dell'inventario, contenente 599 tornei eleggibili; il merge successivo ha usato il catalogo aggiornato, contenente 682 tornei. La differenza è esattamente 83. Il difetto è quindi l'uso di indici su un catalogo mobile, non un errore di lettura dei 599 inventari prodotti.
- Correzione: salvato l'elenco esatto dei 83 `competitionId` in `src/v3/itf-history-missing-inventory.json` (commit `056a6ce568391723668465d210fedd2e51261e94`) e creato il workflow `courtwatch-v3-itf-missing-inventory.yml` (commit `f847e19fd528b3d9aeea35c07019423d2b51fb67`). Ogni ID viene inventariato su un runner indipendente; la review fonde i 599 artifact esistenti con gli 83 nuovi e fallisce salvo `missing=0` e `retry=0`. Run avviato: `32870688827`.
- Linea guida permanente richiesta dall'utente: davanti a errori, dati mancanti o workflow bloccati non limitarsi a rilanciare o aggirare il singolo caso. Occorre identificare e documentare la causa verificata, correggere il meccanismo generale che l'ha prodotta, quindi rieseguire e accettare l'esito soltanto dopo una verifica completa. Retry e recuperi sono strumenti di acquisizione, non sostituti della diagnosi.
- Review del recupero certificata nel run `32870688827`, job `review` `97877244559`: `expected=682`, `inventoried=682`, `missing=0`, `retry=0`, `tasks=4291`. L'inventario di tutti i tornei conclusi nella finestra è completo. La fase successiva deve acquisire e verificare tutti i 4.291 tabelloni dichiarati prima del matcher dei 23 titolari.
- Regola T−1 live corretta su indicazione dell'utente: per un torneo futuro non si cercano tutti i 23 titolari nei tabelloni. Si cercano esclusivamente i nostri giocatori precedentemente salvati nell'acceptance list di quello specifico torneo. La ricerca sui 23 resta valida soltanto per lo storico concluso, dove le acceptance non sono più disponibili.
- Commit `85200cd432a454326fec0ac3a8ab7dd17054edb9`: `discover-itf-draw-entries.mjs` carica `history/itf_draw_target_db.json`, costruisce l'insieme delle relazioni acceptance attive e, in modalità live, scarta ogni match giocatore/torneo privo di tale relazione. Target rimossi o withdrawn non sono idonei; `ITF_HISTORICAL_T_MINUS_ONE=1` mantiene esplicitamente la scansione di tutti i 23. Avviato il controllo live run `32871533186`.
- Distinzione architetturale definitiva: lo storico ITF è un backfill una tantum, usato esclusivamente per ricostruire tornei, tabelloni, giocatori e risultati dal 18 dicembre 2025 e inizializzare il database in assenza delle vecchie acceptance list. Non è il motore operativo permanente. Il motore vero è quello live rivolto ai tornei futuri: scoperta con finestra mobile, acceptance list dei nostri giocatori, inventario dei tabelloni al T−1, acquisizione indipendente dei singoli tabelloni e decisione per ciascun giocatore precedentemente presente in acceptance.
- Sequenza definitiva motore ITF live/futuro: finestra mobile; catalogo tornei; acceptance dei soli nostri giocatori con etichetta MD/Q/A; al T−1 inventario di tutti i tabelloni/gruppi dichiarati; acquisizione indipendente di ogni tabellone; ricerca limitata ai giocatori salvati in acceptance per quel torneo; conferma senza etichetta se presenti; stato pendente finché esistono sezioni vuote/non pubblicate; rimozione solo per withdrawn o assenza dopo pubblicazione completa. Frequenza prevista: 14 minuti.
- Avviata la fase storica successiva all'inventario. Commit `7ac34fc06d134d01a952004ede0a96522a1394ee`: ogni acquisizione di tabellone salva sempre un artifact con stato `complete` oppure `retry`, così la causa di una mancata lettura resta identificabile e può essere recuperata in modo mirato senza ripetere i tabelloni riusciti.
- Primo blocco storico di 256 tabelloni su 4.291, un tabellone per runner isolato: workflow `courtwatch-v3-itf-history-draws-00.yml`, commit `6bcff9c6ae3f8d3f8ecfa4f55dd7e38117472140`, run `32871885023`. La coda completa proviene dall'artifact certificato del run `32870688827`; l'inventario non viene ripetuto.
- Automatizzati tutti i 17 blocchi storici: blocchi 00–15 da 256 tabelloni e blocco 16 da 195, totale 4.291. I workflow 01–16 sono concatenati tramite `workflow_run`: ciascuno parte automaticamente solo dopo la conclusione con successo del precedente. Non sono richiesti avvii manuali; nell'interfaccia GitHub comparirà inizialmente solo il blocco attivo e il successivo verrà creato al termine. Commit di catena da `b1554ae4fe4df2fa51eaf1ffd76148d608a01040` (01) a `c9a196da91e45af2a3af3045818b3db946013d92` (16).
- Correzione della messa in coda: dopo il successo del blocco 00, il blocco 01 non è partito perché il listener `workflow_run` era stato registrato dopo la creazione del run 00. Il primo tentativo di trigger diretto dei blocchi 01–16 è stato rifiutato dalla validazione GitHub: l'espressione `${{ offset + matrix.slot }}` usava un'addizione non supportata nel contesto YAML. Nessun tabellone è stato elaborato da quei run falliti.
- Causa corretta in modo generale: ogni workflow usa ora `ITF_DRAW_TASK_SLOT` e `ITF_DRAW_TASK_OFFSET`, calcolando l'indice con aritmetica shell prima di avviare Node. Rimossa la dipendenza dalla catena; i blocchi 01–16 sono stati avviati direttamente e affidati alla coda GitHub. Verificati workflow validi e in coda: blocco 01 run `32872732932`, blocco 16 run `32872751046`. Commit corretti da `a7d72869c7ad1c25aa63afcd1790801666aac0e8` a `a32b33ec4b91fec0b1d4895322d568ed45422fb5`.
- Avviata la verifica reale del blocco 00: aggiunto `audit-itf-history-draw-batch.mjs` (commit `71c8bbe4e7ee0ac1b3f462273e67ebd776e46ec1`) per aprire gli artifact compressi e contare task unici, `complete`, `retry`, `missing`, file illeggibili e cause aggregate. Workflow di review `courtwatch-v3-itf-history-draws-00-review.yml`, commit `3237d5093bc7a6f4371e3bc0422b317384693041`, run `32873043584`. Il successo del blocco di acquisizione non viene equiparato a `retry=0` senza questo audit dei contenuti.
- Regola permanente richiesta dall'utente: verde significa risultato corretto, non semplice completamento tecnico. Un task di acquisizione futuro fallisce se salva stato `retry` (commit `728138c0ac3438e94fed3333778bbc281cb38aec`), pur mantenendo l'artifact diagnostico tramite upload `if: always()`. Una review di blocco fallisce se `retry>0`, `missing>0` o `unreadable>0` (commit `9324e5fc9a76d0dbdc46675c53ebc68bbec3670c`). Review 00 riattivata con tale vincolo dal commit `83c182833b2ba7c1a6c3c46c20af61e398c36aa2`.
- Prima review del blocco 00: 256 job di acquisizione conclusi, ma il download con `merge-multiple: true` ha esposto alla review soltanto 200 file, producendo `complete=200`, `retry=0`, `missing=56`. Verifica successiva: il run contiene realmente 256 artifact non vuoti e la coda completa contiene 4.291 `taskId` tutti unici; pertanto i 56 non sono task ITF mancanti né duplicati della coda, ma file persi durante l'unione locale degli artifact.
- Commit `74276445a14862b4156ecb0f1b695327aefdc6f8`: la review 00 scarica ora ogni artifact in una directory separata e l'audit ricorsivo li legge senza `merge-multiple`. Questo preserva fisicamente tutti i 256 output e riavvia la review corretta; nessun tabellone viene riacquisito.
- Correzione di processo richiesta dall'utente: i blocchi successivi non devono partire prima della certificazione del blocco 00. La precedente messa in coda contemporanea dei blocchi 01–16 è stata un errore rispetto al vincolo di consumo. Al controllo, il blocco 01 aveva già completato 94/256 job e gli altri risultavano in coda. La connessione GitHub disponibile non espone l'operazione di cancellazione dei run e il browser GitHub non è autenticato; l'utente deve usare `Actions → run → … → Cancel workflow` per interrompere immediatamente i run già creati. Nessun ulteriore blocco deve essere avviato dall'assistente finché la review 00 non certifica `complete=256`, `retry=0`, `missing=0`, `unreadable=0`.
- Review corretta e isolata del solo blocco 00: run `32873814528`, attualmente in coda. Usa i 256 artifact già esistenti in directory separate; non interroga ITF e non riacquisisce tabelloni. È l'unica esecuzione da attendere per certificare o diagnosticare il blocco 00.
- Il run `32873814528` ha nuovamente visto 200/256 file. Diagnosi verificata: il run sorgente contiene 256 artifact non vuoti, ma `actions/download-artifact` nella lettura di artifact appartenenti a un altro run ne restituisce soltanto 200; la perdita avviene prima dell'estrazione e non dipende da collisioni di nomi o da ITF.
- Correzione definitiva della review 00, commit `5c1261b020e283cd97ab4a566590a222eef561e5`: eliminato `actions/download-artifact` per il run remoto; la review usa l'API GitHub paginata (`per_page=100`), richiede esattamente 256 ID, scarica ogni ZIP per ID in una cartella distinta e poi esegue l'audit. Nuovo run `32874462736`. Nessuna richiesta a ITF e nessuna riacquisizione.
- Certificazione finale blocco 00, run `32874462736`, job `97888964023`: `expected=256`, `artifacts=256`, `uniqueTasks=256`, `complete=256`, `retry=0`, `missing=0`, `unreadable=0`.
- Su richiesta esplicita dell'utente, i risultati parziali dei precedenti run cancellati 01–16 vengono ignorati e ogni blocco viene rieseguito integralmente con lo stesso metodo certificato dello 00. Ogni workflow ora comprende acquisizione di tutti gli slot su runner isolati, artifact conservato anche in errore, review interna tramite API GitHub paginata e fallimento salvo `complete=expected`, `retry=0`, `missing=0`, `unreadable=0`.
- Workflow 01–16 aggiornati e messi in coda con commit da `1d631ad8e2d9381fbee95d366a5c4f164cb0fd24` a `22e278d1e8bc266d2c1b936487442c4783fcafd3`. Verificati: blocco 01 run `32875489638`, blocco 16 run `32875531857`. Blocchi 01–15: 256 task ciascuno; blocco 16: 195 task.
- Diagnosi del fallimento simultaneo dei blocchi 01–16: non era un problema ITF. Nei blocchi 01 e 02 circa i primi 80 task partivano, poi centinaia fallivano nello step `Download certified 4291-task queue`. Log esatto: `API rate limit exceeded for installation`. La causa era il download contemporaneo dello stesso artifact della coda da migliaia di runner.
- Correzione strutturale: `acquire-itf-history-draw-task.mjs` supporta `ITF_DRAW_TASK_FILE` (commit `a337728edbe16c19e6747afbdc8c6f20918390c3`). La coda certificata è stata divisa in 16 file statici locali `src/v3/itf-history-draw-batch-01.json` … `16.json`, rispettivamente 256 task per i blocchi 01–15 e 195 per il 16. Ogni runner ottiene il task dal checkout e non esegue più alcuna chiamata GitHub API prima di ITF.
- Blocchi 01–16 ricreati integralmente, come richiesto dall'utente, ignorando i risultati parziali precedenti. Commit workflow corretti da `49492213cc3e834f2817bbb7b51b90b41aa97f10` a `d5d3b1f5297c77cd0593349d276c22fb596cb1e0`. Run verificati in coda: blocco 01 `32896109894`, blocco 16 `32896146769`. La review paginata e il vincolo verde restano invariati.
- Diagnosi mancati aggiornamenti della mappa dal motore ITF live: ultimo run schedulato `32888935115` fallito. Gli shard acceptance 0, 6, 7 e 15 hanno restituito ripetutamente `official_api_returned_non_json_or_antibot_page`; il job `review` è stato quindi saltato e non ha eseguito merge, T−1, database o `entries-engine`.
- Seconda causa indipendente: `courtwatch-v3-itf-live.yml` termina con `Upload candidate tournament list for review`. Il workflow non contiene un passaggio di pubblicazione della lista candidata nella mappa, commit dei dati live o salvataggio finale su R2. Di conseguenza, anche un run live riuscito produce attualmente soltanto un artifact di review e non può aggiornare la mappa. La pubblicazione non viene aggiunta automaticamente in questa fase perché resta valido il vincolo precedente dell'utente: prima di pubblicare devono essere elencati i tornei trovati.
- Merge storico finale: i 17 blocchi reali sono `00–16`, per un totale di 4.291 draw unici (`00=256`, `01–15=3.840`, `16=195`). I file locali `01–16` contengono verificabilmente 4.035 task; il blocco `00` è la prima porzione distinta da 256.
- Creati `src/v3/merge-itf-history-draw-tasks.mjs`, `src/v3/report-itf-history-player-tournaments.mjs` e workflow `.github/workflows/courtwatch-v3-itf-history-draws-final-merge.yml`. Il merge non interroga ITF: raccoglie gli artifact già acquisiti, richiede `expected=4291`, poi calcola numero ed elenco dei tornei con almeno uno dei 23 giocatori.
- Correzione sorgente blocco 00 nel merge: il run `32874462736` è la review/certificazione e contiene solo l'audit; gli artifact originali dei 256 draw sono nel run `32871885023`, ora usato dal workflow (commit `b4a733394b2140563d59352e1e62f6b46f75e328`).
- Primo merge finale run `32901751658`: raccoglitori `00–03` riusciti; `04–16` falliti nello step di raccolta per `API rate limit exceeded for installation (HTTP 403)`; merge saltato. Nessuna chiamata ITF e nessuna perdita dei draw originali.
- Correzione commit `7caa77c4a56904b75a01632482e205aaa5369b5f`: riuso dei bundle già riusciti `00–03`; raccolta seriale `04–16` con backoff automatico sulla quota GitHub; nessuna riacquisizione ITF.
- Deploy Pages associato allo stesso commit, run `32902770631`, fallito in `Configure Pages` perché la medesima quota dell'installazione GitHub era esaurita. Checkout riuscito, upload/deploy non eseguiti; non è un errore del contenuto del sito e resta attivo il deploy precedente.
- Decisione di ottimizzazione storico: i blocchi vengono considerati separatamente per il matching dei 23 giocatori; la fase finale unisce soltanto le relazioni compatte giocatore/torneo e deduplica per `competitionId`. Non viene ricostruito un unico database intermedio di tutti i match.
- Creati `src/v3/summarize-itf-history-blocks.mjs` (commit `9e4e112dd04b7427a255b328da887ed14efdd61d`) e workflow `courtwatch-v3-itf-history-block-summary.yml` (commit `4e55afd92c9500fc481dfc48fd4cdf8e88b40078`). Alla conclusione del run seriale `32902770858`, scarica 17 bundle consolidati (4 dal run precedente, 13 dal run corrente), certifica 4.291 task e produce numero/elenco dei tornei con i giocatori monitorati.
- Ricerca storica completata direttamente sui bundle già disponibili, mantenuti separati per blocco: `00–15=256` file ciascuno, `16=195`, totale `4291/4291`; `complete=4291`, `retry=0`, `missing=0`, `unreadable=0`.
- Risultato matcher esatto sui 23 titolari: 4 tornei e 4 relazioni giocatore/torneo, tutte di Martina Danesi (WTID `800792690`): J30 Nis (`J-J30-SRB-2026-002`, G-S-Q-KO, blocco 09); J30 Compiegne CANCELLED (`J-J30-FRA-2026-003`, G-D-M-KO/G-S-M-KO/G-S-Q-KO, blocco 06); J30 Szentes (`J-J30-HUN-2026-002`, G-S-Q-KO, blocco 06); J30 Cuneo (`J-J30-ITA-2026-002`, G-S-Q-KO, blocco 07).

## 2026-08-26 — Certificazione zero-errori del motore ITF live

- Diagnosi del run live `32934910530`: lo shard 11 era tecnicamente fallito nella scansione risultati con un torneo in `retryQueue`; le acceptance non leggibili erano invece già destinate al recupero isolato. Il review non era partito e nessun dato parziale era stato pubblicato.
- Eliminata la soluzione provvisoria che si limitava a ignorare gli errori dei risultati. Il workflow live ora esegue due recuperi indipendenti: 16 retry delle sole acceptance non leggibili e 8 partizioni di retry delle sole sezioni risultato non leggibili.
- Prima del merge viene eseguito `apply-itf-result-retries.mjs`: se resta anche una sola sezione in retry (`remainingRetries > 0`), il processo termina in errore e blocca T−1, database R2 e mappa.
- La pubblicazione è quindi atomica: acceptance complete, risultati con retry residui pari a zero, validazione ITF, aggiornamento differenziale R2 e solo infine commit della mappa. Nessun ciclo incompleto può sovrascrivere l'ultima generazione valida.
- Corretto anche il percorso multilinea degli artifact acceptance e aggiunto `source_itf_retry_audit.json` alle prove persistenti della generazione.
- Commit remoto: `dd89c476fc7ae676029e6a86f8f308e5fa156da2` (`Require zero-error ITF result certification`). Run di certificazione avviato: `32936797816` (`Court Watch v3 ITF live database`, run 50).
- Rilevato che il precedente run 49, basato sulla logica provvisoria, era ancora davanti alla certificazione corretta. Per impedire qualunque pubblicazione obsoleta è stato impostato `cancel-in-progress: true` nel gruppo ITF live. Commit `35f8b7dba4215e34f256005cf8b42c30ae9f79e6` (`Cancel obsolete ITF live generations`). I run 49 e 50 sono stati annullati automaticamente; il run valido sostitutivo è `32936972698` (run 51), in coda.
## Aggiornamento 29 agosto 2026 — watchdog esterno Cloudflare

- Creato il Worker `courtwatch-watchdog`, indipendente dai cron GitHub, con trigger Cloudflare ogni 10 minuti.
- Controlli separati per FITP, Tennis Europe, ITF etichette/withdrawn, ITF discovery 42 giorni, ITF T−1 e ITF safety 120 giorni.
- Il Worker controlla freschezza dei dati o ultimo run riuscito, non avvia workflow già attivi e applica un cooldown per evitare duplicazioni.
- Segreti usati: `CLOUDFLARE_API_TOKEN`, `R2_ACCOUNT_ID` e `COURTWATCH_WATCHDOG_GITHUB_TOKEN`; nessun valore è presente nel repository.
- Workflow di deploy: `.github/workflows/courtwatch-cloudflare-watchdog-deploy.yml`.
- Commit: `ea1a79d64a421f201c30ec7d972a48acd665da84` (`Add external Cloudflare watchdog for Court Watch engines`).
- Run di prima distribuzione da verificare: `33255541236`, `Court Watch Cloudflare watchdog deploy`, run 1.
- Il run 1 è fallito nello step `actions/setup-node` perché il workflow dichiarava la cache npm prima che `cloudflare/watchdog/package-lock.json` fosse presente nel repository; nessuna chiamata Cloudflare era ancora avvenuta.
- Correzione generale: aggiunto il lockfile nel commit `584f0309c509c8ce05fcb7107c11f14afdbe97c5` (`Fix Cloudflare watchdog dependency bootstrap`).
- Deploy certificato: run 2 `33255671324` completato con successo. Worker e cron Cloudflare sono operativi.
## Aggiornamento 29 agosto 2026 — pubblicazione ITF senza conflitti Git

- Il run ITF acceptance discovery 42d `33249746752` aveva completato acquisizione e validazione, ma era fallito in `Commit validated ITF database and map` durante `git pull --rebase --autostash`.
- Causa verificata: conflitti nei file comuni rigenerati `entries_log.json`, `sync_status.json`, `tournament_entries.json` e `tournaments.json`, modificati nel frattempo da altri motori.
- Correzione strutturale applicata ai tre publisher ITF: conservazione dei soli output ITF validati, reset sull'ultimo `origin/main`, ripristino degli output ITF, nuova esecuzione di `entries-engine.mjs` e pubblicazione dei file comuni rigenerati sull'ultima base disponibile. Non viene più ribasato un commit contenente vecchie versioni dei file comuni.
- Workflow protetti: `courtwatch-v3-itf-live.yml`, `courtwatch-v3-itf-known-fast.yml`, `courtwatch-v3-itf-t-minus-one.yml`.
- Certificazione finale comunicata dall'utente: ITF acceptance 42 giorni verde, ITF etichette/withdrawn verde, ITF T−1 verde.
## Aggiornamento 29 agosto 2026 — diagnostica ITF deduplicata

- Corretto `entries-engine.mjs` affinché la diagnostica ITF usi le presenze finali deduplicate della mappa e distingua `presenze in mappa`, `acceptance correnti`, `storico` e `withdrawn`.
- Commit `049c8053c99913f432f76c88f5daa4bffab54ac1` (`Fix deduplicated ITF diagnostics`).
- Run di rigenerazione comunicato dall'utente come completato con successo.
## Backlog strutturale consolidato — dati mancanti e parti incomplete

Questa sezione è il registro unico delle attività ancora necessarie. Un elemento può essere dichiarato completo solo dopo esito verificato e aggiornamento di questo report.

### A. Fondazione dati universale

- **Completato il 29/08/2026:** definiti identificativi canonici e schema normalizzato comune a FITP, Tennis Europe e ITF, conservando circuito e riferimenti sorgente.
- **Completato il 29/08/2026:** generatore shadow, manifest, conteggi e validazione referenziale pubblicati senza collegare o modificare la mappa pubblica.
- **Completato il 29/08/2026:** database consultabile stabilmente in `dist/v3/universal/` con nove file (`players`, `tournaments`, `entries`, `matches`, `schedules`, `results`, `manifest`, `coverage`, `validation`). Prima generazione certificata: 23 giocatori monitorati, 195 tornei, 415 iscrizioni, 99 elementi agenda, 0 match e 0 risultati; validazione verde e zero errori referenziali.
- **Ancora aperto:** la certificazione universale `missing=0`, `retry=0`, `unreadable=0` su tabelloni, match, risultati e OOP dipende dal completamento dei tre motori descritto nelle sezioni B–E. Il file `coverage.json` dichiara correttamente `completeForUniversalArchive=false`.
- Separare progressivamente codice/workflow su GitHub dai dati operativi: archivi pesanti e versionati su R2, indici/applicazione su D1, accesso tramite Worker API.
- Mantenere gli aggiornamenti live ogni 14–15 minuti e il watchdog Cloudflare ogni 10 minuti.

### B. FITP

- Certificare che tutti i tornei individuali attesi dal 18/12/2025 siano presenti nell'archivio permanente e abbiano snapshot P.U.C. leggibile.
- Certificare province/query mancanti, duplicati ed esclusione dei circuiti esterni.
- Costruire inventario completo di tabelloni, incontri, risultati e giornate OOP dal 18/12/2025.
- Acquisire e conservare tabelloni, risultati e OOP di tutti i partecipanti, non soltanto dei giocatori monitorati.
- Indicizzare giocatori e tessere per consentire la ricostruzione retroattiva quando viene aggiunto un nuovo giocatore.

### C. Tennis Europe

- Il catalogo corrente dichiara copertura da `2026-01-01`; completare/verificare il tratto 18/12/2025–31/12/2025.
- Certificare la relazione tra tornei attesi e snapshot acceptance: al 29/08/2026 risultano 598 tornei correnti, 528 snapshot storici, 95.637 righe partecipante e 12.234 nomi indicizzati.
- Risolvere o compensare l'assenza di identificativi partecipante nell'indice corrente (`participantIds=0`) con identità normalizzate e collegamenti verificabili.
- Inventariare tutti gli eventi di tutti i tornei dal 18/12/2025.
- Eseguire backfill completo di tutti i tabelloni, giocatori, incontri, risultati e ordini di gioco disponibili, indipendentemente dalla rosa Court Watch.
- Salvare revisioni di orario/campo quando disponibili.
- Certificare tornei, eventi, tabelloni e giornate OOP con `missing=0`, `retry=0`, `unreadable=0`; una fonte storica non più disponibile deve essere dichiarata esplicitamente e non conteggiata come acquisita.
- Mantenere il motore corrente di acceptance/T−1 durante la costruzione dell'archivio universale.

### D. ITF

- Il motore live acceptance scansiona tutti i tornei della finestra e conserva tutti i partecipanti delle liste pubblicate; certificare per torneo la presenza dell'ultima acceptance valida.
- L'archivio participant cache corrente contiene 498 righe: aggiungere indice/snapshot per torneo e certificazione delle liste future/correnti catturate.
- Verificare e certificare che il backfill storico dei tabelloni dal 18/12/2025 copra tutti i tornei/eventi attesi e sia riutilizzabile per nuovi giocatori.
- Completare il motore live universale di tabelloni, incontri e risultati per tutti i partecipanti, non soltanto per i target acceptance correnti.
- Acquisire e conservare tutti gli OOP storici disponibili e tutti gli OOP futuri; registrare orari, campi e revisioni.
- Conservare la regola operativa corrente: acceptance/withdrawn ogni 14 minuti, discovery 42 giorni ogni 14 minuti, safety 120 giorni giornaliera, tabelloni soltanto da T−1 per le decisioni della mappa.

### E. Agenda, risultati e avversari

- Sostituire gli attuali placeholder OOP/risultati con dati ufficiali completi e certificati.
- Costruire un indice incontri universale e collegare entrambi i giocatori, turno, evento, punteggio, esito e fonti.
- Generare il database avversari dai match effettivi; `opponents.json` è ancora vuoto e mantiene la diagnostica generale gialla.
- Unificare identità dello stesso avversario tra FITP, Tennis Europe e ITF senza fondere omonimi non verificati.
- Ricostruire agenda storica dal 18/12/2025 usando tutti gli OOP disponibili.

### F. Aggiunta dinamica di giocatori ed eventi

- Creare pannello amministrativo per aggiungere/modificare/archiviare giocatori e relativi ID FITP, Tennis Europe e ITF.
- Alla creazione di un giocatore, reindicizzare gli archivi locali senza riscaricare l'intero web e produrre certificazione di copertura per circuito.
- Non attivare la promessa “storico completo” finché i tre archivi non sono certificati.
- Consentire inserimento, modifica e soft-delete di eventi manuali con autore, data, fonte, audit e precedenza rispetto ai dati automatici definita esplicitamente.

### G. Backend, sicurezza e accessi

- Creare Worker API e database D1 per utenti, ruoli, preferenze, eventi manuali, dispositivi e indici applicativi.
- Usare autenticazione gestita e sicura; non implementare password artigianali.
- Ruoli minimi: amministratore, collaboratore, utente.
- Proteggere archivi completi e dati amministrativi; mantenere pubblico solo il perimetro autorizzato.
- Aggiungere audit delle modifiche, recupero account, gestione sessioni, backup e rollback.

### H. App e navigazione mobile

- Rendere la navigazione mobile funzionalmente completa rispetto al desktop.
- Verificare menu, mappa, calendario, agenda, schede giocatore, filtri, dialog, touch target e PWA installata.
- Definire una navigazione coerente per database, giocatori, eventi manuali, notifiche e amministrazione.
- Eseguire verifica su dispositivi mobili reali prima della pubblicazione.

### I. Notifiche

- Implementare sottoscrizioni push per dispositivo e preferenze per giocatore/tipo di evento.
- Eventi base: nuovo torneo, nuova acceptance, cambio etichetta, withdrawn, cancellazione, tabellone pubblicato, modifica manuale.
- Eventi OOP: match programmato, cambio ora/campo, promemoria configurabile, match imminente.
- Eventi risultati: risultato pubblicato, avanzamento e nuovo avversario.
- Deduplicazione, idempotenza, opt-in/opt-out e registro degli invii.

### J. Monetizzazione futura

- Progettare separazione per account/organizzazione e limiti applicati lato backend.
- Piani ipotizzati: gratuito, premium, accademia/circolo.
- Integrare pagamenti soltanto dopo stabilità di accessi, mobile, dati e notifiche.
- Definire privacy, termini, conservazione dati e diritto di cancellazione prima dell'apertura commerciale.

### K. Elementi già completati da non riaprire senza evidenza

- Watchdog Cloudflare operativo con cron ogni 10 minuti per FITP, Tennis Europe e processi ITF.
- Pubblicazione ITF conflict-safe certificata verde per discovery 42 giorni, etichette/withdrawn e T−1.
- Diagnostica ITF deduplicata certificata verde.
- Martina Danesi unico profilo ITF attivo. Martina Busa, Manuel Natale, Pietro Sala e Niccolò Zanaga sono stati rimossi completamente dalla rosa monitorata e il file `former-players.json` è stato eliminato. Restano 23 profili Court Watch; eventuali future ricomparse dei quattro negli archivi ufficiali saranno trattate come normali partecipanti universali, non come target monitorati.

## Aggiornamento 29 agosto 2026 — fondazione universale consultabile

- Creati `src/v3/universal-data-model.mjs`, `src/v3/build-universal-database.mjs`, `src/v3/validate-universal-database.mjs`, `docs/courtwatch-universal-schema-v1.md` e il workflow `.github/workflows/courtwatch-v3-universal-shadow.yml` (commit fondazione `71727511a37aa9d744d1d95427ef4bf580df2618`).
- Il primo errore di identità duplicata è stato risolto definitivamente rimuovendo i quattro former players dalla rosa, eliminando `former-players.json` e filtrando le cache finali sugli ID presenti in `players.json` (commit `63296ca9fd2fdbf1b7b761366e822ecc943e963f`).
- Il workflow è stato esteso per pubblicare in modo conflict-safe il database già validato in `dist/v3/universal/`, mantenendo invariata l'app pubblica (commit `b2a444ff7b60464039bcb1789dcdc5e91943eaeb`).
- Certificazione: `Court Watch v3 universal schema shadow` run #4, ID `33267789634`, conclusione `success`. Tutti gli step — sintassi, build, validazione identità/riferimenti/copertura, artifact e pubblicazione — sono verdi.
- I nove file universali sono presenti stabilmente su `main`. Conteggi iniziali: 23 giocatori, 195 tornei, 415 iscrizioni, 99 schedule, 0 match, 0 risultati. Questo chiude la fondazione tecnica del punto 1, ma non dichiara completo l'archivio sportivo: OOP, match, risultati e relativi backfill restano il punto 2.

## Aggiornamento 29 agosto 2026 — D1, Worker API e migrazione della mappa

- Verificata la durata del torneo Tennis Europe di Darko Sartori “27.MEMORIJAL LJUBISA MILADINOVIC DOBOJ” (ID `AED6034A-4299-4BF6-A483-E955C065E331`). La mappa corrente mostra correttamente la finestra completa 30 agosto–6 settembre 2026 perché Darko è confermato nel tabellone di qualificazione: qualificazioni 30–31 agosto, main draw 1–5 settembre. Il calendario ufficiale Tennis Europe espone 30 agosto–6 settembre per l'intero evento. D1 non ha alterato le date: quattro generazioni Git confrontate del 29 agosto riportano tutte `startDate=2026-08-30` e `endDate=2026-09-06`. La variazione percepita deriva dal passaggio dalla sola finestra del main draw alla finestra effettiva pertinente al giocatore qualificato.
- Audit finestre qualificazioni/main draw: il modello ITF conserva già due date distinte nei record storici (`startDate` = primo giorno delle qualificazioni, `officialStartDate` = primo giorno del main draw; esempi J30 Nis, Szentes e Cuneo con scarto di due giorni). Il verificatore live `verify-itf-draws.mjs` però preferisce sempre `officialStartDate` e applica T−1, rischiando di controllare il tabellone qualificazioni dopo il loro inizio. Correzione richiesta: gate dipendente dalla fase/acceptance, non T−2 indiscriminato; Q usa la data reale di inizio qualificazioni, MD la data del main draw, A/ignoto usa prudentemente la prima data ufficiale disponibile. Tennis Europe Bari (ID `2CAD0433-3409-4561-B451-FADBE0F1CFCB`): Anna Gambarini è Q-10, qualificazioni 5–6 settembre 2026 e main draw 7–13; la mappa corrente 7–13 deve quindi estendersi a 5–13. Tennis Europe Palermo (ID `6131A096-712D-4E53-B191-158EE50E83CE`): Virginia Cereghini è MD-7, qualificazioni 5–6 e main draw 7–13; per lei 7–13 è già la finestra corretta. Le date provengono dai factsheet ufficiali Tennis Europe.
- Regola Tennis Europe definitiva corretta dall'utente: per ogni relazione pubblicata in mappa, indipendentemente dall'etichetta MD/Q/A/WC, `startDate` deve essere il primo giorno delle qualificazioni letto dal factsheet, `officialStartDate` il primo giorno del main draw e `endDate` l'ultima data del factsheet. Il controllo T−1 parte il giorno precedente all'inizio delle qualificazioni; l'etichetta live resta invariata fino alla decisione tabellone già prevista. Implementata in `discover-tennis-europe-acceptance-shard.mjs`: il factsheet viene richiesto soltanto per tornei nei quali è stato trovato almeno un giocatore monitorato, limitando richieste e consumo; in caso di factsheet incompleto resta il dato precedente. Commit `1d49b3cab15a8b3046da77d193f071432f737e77`, workflow di riferimento `Court Watch v3 Tennis Europe live entries`. Criteri: Bari 5–13 settembre con Anna `Q-10`, Palermo 5–13 settembre con Virginia `MD-7`, T−1 4 settembre, etichette non alterate.
- Correzione di ambito richiesta dall'utente: la finestra factsheet deve essere acquisita per **tutti i tornei Tennis Europe**, non soltanto per quelli con giocatori monitorati. Il primo commit `1d49b3ca` era quindi parziale. Il commit sostitutivo `b33f82f5b45c57b1020c01e4eb23385ad1c52a4f` interroga il factsheet per ogni torneo elaborato e propaga `startDate` qualificazioni, `officialStartDate` main draw, `endDate` e URL factsheet sia negli snapshot partecipanti/database sia nelle entry della mappa. T−1 continua a derivare da `startDate`; etichette live invariate. La fonte per Palermo è il factsheet ufficiale ID `6131A096-712D-4E53-B191-158EE50E83CE`: righe BS16/GS16, qualificazioni 5–6 settembre 2026, main draw 7–13 settembre 2026.
- Rettifica finale di perimetro e architettura: deve cambiare soltanto `startDate`, sia per Tennis Europe sia per ITF, impostandola al primo giorno delle qualificazioni letto dal factsheet; `endDate`, acceptance, etichette e ogni altra logica restano invariate. T−1 deriva dalla nuova `startDate`. Il tentativo TE `b33f82f5` ha collocato erroneamente la lettura massiva dentro il live ogni 15 minuti: run specifico #264 `33271155898` fallito in tutti i 16 shard, publish saltato e ultima mappa valida preservata. Il live rapido è stato ripristinato con commit `913982164ea84edf03fda9733c8fa9760e4bed17`, run specifico `33283568054`. La lettura factsheet di tutti i tornei TE è stata spostata nel catalogo a 4 shard con commit `51e79342eebec08fa4ce6acbebee91a22b3a7f84`, run specifico `33283578804`; il catalogo modifica solo `startDate` quando trova la riga Qualifying draw e conserva il valore precedente se non pubblicata.
- ITF: commit `1acb24f24d163a2f714cc39222098a6878c8938d`, run specifico `33283638625`. Per le relazioni che alimentano la mappa, dopo il match nella acceptance il motore legge la scheda ufficiale ITF e usa `First day of Singles Qualifying` come `startDate`; il verificatore T−1 usa quella data direttamente. Non viene applicata alcuna nuova sottrazione D−2 dal main draw. La pagina Admin non è necessaria per questa correzione ed è messa in pausa finché TE e ITF non tornano verdi; il precedente run Admin specifico è `33270958505`.
- Esito validazione comunicato dall'utente: TE live `33283568054` verde, TE catalogo/factsheet `33283578804` verde e ITF live/factsheet `33283638625` verde. La correzione circoscritta di `startDate` e T−1 è quindi chiusa; il vecchio TE `33271155898` resta soltanto il run fallito di riferimento diagnostico.
- Correzione UI applicata e separata dai motori: nella pagina personale del giocatore i quadratini dei circuiti passano da 8×8 a 11×11 px; FITP resta blu (`#1976b8`) e ITF resta verde (`#0a8f4f`), con tonalità più nette. Nessun cambiamento a sigle, legenda, struttura, dati o motori. Commit `495100dee1684f296e2388fc2cc27b1d819680ea`; workflow di riferimento `Deploy CourtWatch`, run specifico `33284153839`.
- Verifica Pescara ITF: individuato il torneo futuro `J60 PESCARA`, terra outdoor, con finestra main-event pubblicata 28 settembre–3 ottobre 2026. La pagina ITF indicizzata non espone ancora la scheda completa/competitionId e quindi la data qualificazioni non viene dedotta né inventata; dovrà essere letta dalla scheda ufficiale ITF dal motore quando pubblicata. Da non confondere con il Tennis Europe U14 Pescara del 23–30 maggio già presente nello storico universale.
- Creata la fondazione Admin v1 nel Worker API, commit `344861defe4679f64a2e8638ba1f42d16f991076`. La route `/admin` è sola lettura, mostra generazione e conteggi D1 ed è protetta lato server con HTTP Basic e segreto Worker `ADMIN_TOKEN`; se il segreto non è configurato risponde 503 e non espone dati. Nessuna password JavaScript e nessun collegamento dalla V3 pubblica. Workflow di riferimento: `Court Watch Cloudflare D1 and app API`. La prossima estensione collegherà diagnostica motori, watchdog, R2 e workflow falliti dietro la stessa protezione.
- Completata Admin v1 protetta con commit `d6c2809822cdc80f63d65d7513bec6a3948ca431`: mostra generazione/conteggi D1, copertura, stato e freschezza FITP/TE/ITF, diagnostica applicativa, ultimi workflow critici con link, watchdog e fallimenti recenti. Run specifico di riferimento `Court Watch Cloudflare D1 and app API` ID `33284355308`. Limite dichiarato: il Worker Admin non ha ancora una binding R2 in sola lettura; R2 continua a essere usato e validato dai workflow dei motori, ma la pagina non dichiara uno stato del bucket che non può verificare direttamente. L'eventuale binding R2 Admin dovrà essere server-side e read-only e non dovrà cambiare i motori.
- Admin database, fase consultazione: commit atomico `6951d6e832aa19aa418423aa6f81fb9af2b5949b`, run specifico `Court Watch Cloudflare D1 and app API` ID `33284632067`. Aggiunta ricerca protetta fino a 50 record nelle tabelle D1 (`players`, `tournaments`, `entries`, `schedules`, `matches`, `results` e proiezioni app), con visualizzazione del payload JSON. Aggiunta binding server-side `ARCHIVE` al bucket R2 già indicato dal secret `R2_BUCKET` dei workflow e controllo dei puntatori `current`, `backup-1`, `backup-2` per FITP, Tennis Europe e ITF. Nessuna credenziale è esposta al browser e nessun motore è modificato. Le scritture manuali non sono ancora abilitate: la fase successiva deve introdurre override separati, audit e annullamento, evitando modifiche dirette ai dati grezzi rigenerati dai motori.
- Admin database, fase scrittura controllata: commit atomico `c0a1ca5777c7cf8f20e62cedbdde3b7bbff01336`, run specifico `Court Watch Cloudflare D1 and app API` ID `33284754002`. Migrazione D1 `0003_manual_overrides.sql` con tabelle persistenti `manual_overrides` e `admin_audit`; form protetto per aggiungere/aggiornare o nascondere giocatori e tornei tramite payload JSON; ogni sostituzione conserva la precedente, ogni operazione è auditata e il pulsante Annulla disattiva l'override corrente e riattiva quello precedente. La proiezione `/v1/app-snapshot` applica gli override attivi sopra i dati automatici, senza modificare gli archivi grezzi dei motori. Scritture accettate solo con autenticazione Admin e POST same-origin.
- Admin consultazione estesa: commit `fc05de11ad73e6722d54be063794c02620d32a64`, run specifico `Court Watch Cloudflare D1 and app API` ID `33285449231`. Ripristinata una vista tabellare leggibile dei giocatori Court Watch monitorati (nome, ID, club, circuiti, tessera FITP) accanto alla ricerca JSON avanzata. Ogni puntatore R2 disponibile ora apre una pagina protetta con metadati della generazione e oggetti reali scaricabili; sono consentiti soltanto i prefissi generazionali FITP/TE/ITF e resta obbligatoria l'autenticazione Admin. Requisito architetturale aggiornato: qualunque giocatore osservato dai motori deve diventare ricercabile, mentre `monitorato` resta uno stato separato. Copertura attuale da non sovrastimare: FITP 427.609 osservazioni con tessera, TE 12.235 nomi distinti osservati senza ID sempre disponibile, ITF 41.255 osservazioni nella finestra acquisita; serve un indice D1 deduplicato più ricerca online on-demand per i non ancora osservati.
- Definizione vincolante di giocatore Court Watch universale: chiunque abbia già disputato o disputerà almeno un torneo in uno dei tre circuiti deve essere rilevato e reso ricercabile, indipendentemente dall'essere monitorato. Le fonti dell'anagrafica sono liste iscritti/acceptance, tabelloni e risultati, storici e futuri. Alla prima osservazione va creato o aggiornato il profilo indice; `monitored` resta un attributo separato. La deduplicazione tra circuiti deve usare identificativi ufficiali quando disponibili; la sola omonimia non autorizza un merge automatico. Il backfill deve partire dal 18/12/2025 e l'indice deve continuare a crescere con ogni acquisizione dei motori.
- Il run Admin `33285449231` è fallito nella verifica di parità perché il seed D1 usava la proiezione universale versionata del 29 agosto invece dei dati correnti: `missing` conteneva 19 relazioni FITP e Martina–J30 Cuneo ITF, `extra` era vuoto; OOP risultava correttamente `excluded_pending_full_rewrite`. Non è un errore dei motori né una perdita dei record sorgente. Correzione commit `07682e97cc423cffea2511e00c118e8714d4776e`: il workflow ricostruisce e valida `dist/v3/universal` dai dati correnti prima di generare/importare il seed D1. Nuovo run specifico `Court Watch Cloudflare D1 and app API` ID `33285613432`.
- Il run successivo `33285613432` ha ricostruito correttamente la proiezione (23 giocatori, 196 tornei, 416 entry) e verificato D1 verde, ma la verifica live ha mostrato gli stessi 20 `missing`. Causa reale: `applyOverrides` nella API raggruppava `app_tournaments` per solo `competitionId`, eliminando dalla risposta le presenze multiple quando più giocatori condividevano lo stesso torneo. Correzione commit `50a4fc083ece92414bb1f6cf9436f60941eed49a`: chiave base torneo `playerId|competitionId`, override manuali con ID separato; aggiunti in Admin per FITP/TE/ITF i conteggi di presenze e giocatori distinti D1. Il workflow D1 ora si attiva anche quando cambiano `data.json`, `players.json`, `tournament_entries.json`, agenda o risultati, così segue le pubblicazioni dei motori. Run specifico `Court Watch Cloudflare D1 and app API` ID `33285760758`.
- Il run `33285760758` ha confermato che import e D1 sono integri (`appTournaments=229`), ma l'API live restituiva soltanto 97 presenze. La prima correzione era ancora incompleta: la chiave della `Map` non distingueva in tutti i casi circuito e fallback del nome torneo, causando ulteriori collisioni nella sola risposta API. Correzione commit `00ac9b17c29a8b4879a6642d19a70db34d743736`: identità base completa `playerId|competitionId/sourceTournamentId/nome|circuit/sourceId`, mentre gli override manuali mantengono il proprio ID separato. Nessuna modifica a motori, archivi grezzi o mappa; workflow di riferimento `Court Watch Cloudflare D1 and app API`, run generato dal commit da certificare verde.
- Il run specifico `33285881044` del commit `00ac9b17` ha portato la risposta da 97 a 227/229, isolando due collisioni residue (Martina–J30 Cuneo ITF e Aila–torneo TE `60B383B6-49FE-4A33-9F20-629E32856200`). Decisione definitiva: le righe automatiche già validate in D1 non devono essere deduplicate una seconda volta nell'API. Commit `c3d09b8a00b8fa58a9a07d8c795b1900e2fb7ab5`: proiezione automatica lossless e gestione separata degli override manuali. Certificazione verde: workflow `Court Watch Cloudflare D1 and app API`, run specifico `33285933608`; anche `Deploy CourtWatch` `33285933398` è verde.
- Diagnosi del failure `ITF sicurezza 120 giorni` run `33283638726`: tutti gli shard e retry acceptance sono riusciti, validazione ITF riuscita e generazione `c3a4ff455686f8543fa638940e4c377910c9cd02732fb76e8fea6474c08c293f` pubblicata su R2. Il solo step fallito è `Commit validated ITF database and map`: il rebase ha trovato conflitti nei JSON perché `main` era avanzato durante il run. È un conflitto di pubblicazione Git, non un fallimento del motore o di R2; Admin dovrà distinguerli.

- Creato su Cloudflare D1 il database operativo `courtwatch-app` (ID `cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda`) e pubblicato il Worker `courtwatch-app-api` su `courtwatch-app-api.ckrk9ggvrb.workers.dev`.
- Aggiunti schema, migrazioni, import automatico, verifica dei conteggi e deploy in `cloudflare/app-api/` e nel workflow `Court Watch Cloudflare D1 and app API`.
- Registro run: #1 `33268358803` fallito per token privo di D1 Edit; #2 `33268799822` fallito perché D1 remoto rifiuta `BEGIN TRANSACTION`; #3 `33268877657` verde dopo le correzioni; #4 `33268969009` rosso correttamente per mancata parità fra proiezione universale e mappa; #5 `33269377182` verde con parità certificata.
- Conteggi D1 certificati nel run #5: universale 23 giocatori, 195 tornei canonici, 415 relazioni giocatore–torneo e 99 schedule tecnici; proiezione compatibile della mappa 23 giocatori e 229 righe giocatore–torneo, senza record mancanti o extra.
- Il confronto 195/229 non indica tornei mancanti: 195 sono tornei canonici distinti; 229 sono righe visualizzate giocatore–torneo. Le 415 entry universali conservano relazioni ulteriori/storiche.
- Decisione vincolante: D1/R2 e Worker API non devono modificare logica, frequenza o output dei motori FITP, Tennis Europe e ITF. La migrazione dati resta separata e reversibile.
- La V3 pubblica usa `v3.js`. Il tentativo iniziale su `app.js` non era attivo ed è stato ripristinato. `v3.js` legge ora la proiezione D1 per giocatori e tornei con fallback automatico ai nove JSON V3 e alla cache locale; agenda, risultati e diagnostica continuano sui flussi esistenti. Deploy #889 `33269601683` comunicato verde.
- Aggiunto gate di freschezza: se la generazione D1 è precedente ai JSON di giocatori/tornei, la mappa usa temporaneamente i JSON più recenti e ritorna a D1 dopo la sincronizzazione. In questo modo ogni nuova acquisizione dei motori continua a raggiungere la mappa senza attendere una copia D1 obsoleta.
- La diagnostica viene rimossa dalla pagina pubblica ma continua a essere prodotta e conservata. Sarà mostrata nella futura pagina amministratore protetta.
- Commit del gate freschezza e rimozione diagnostica pubblica: `d2f4fa1b2dbf7870c67d391aa53804fe100d7d63`; workflow di riferimento `Deploy CourtWatch` #890, ID `33269819320`, certificato verde dall'utente.
- Verifica live successiva su `https://png8nftp9y-alt.github.io/v3.html`: script attivo `v3.js?v=202608291900`, 23 filtri e 23 righe giocatore, calendario renderizzato, stato `Live v3`, nessuna indisponibilità e nessun errore applicativo. Gli elementi diagnostici pubblici `motorLight` e `miniStatus` risultano assenti.
- Durante la verifica D1 era momentaneamente precedente ai JSON e la console ha registrato `D1 in sincronizzazione: uso temporaneo dei JSON più recenti`. Questo certifica il comportamento richiesto: la mappa non attende D1 e continua a ricevere immediatamente gli aggiornamenti dei motori; ritorna automaticamente a D1 dopo la sincronizzazione.

## Aggiornamento 30 agosto 2026 — indice universale giocatori in D1

- Decisione architetturale definitiva: app e Admin leggono D1 durante il normale utilizzo. R2 resta archivio sorgente, backup generazionale e base di ricostruzione; non viene interrogato dalla navigazione dell'app. La sincronizzazione usa dopo le pubblicazioni dei motori soltanto gli indici correnti R2 necessari a rigenerare D1.
- Implementato commit atomico `d5be0c0656d575237b4e6fc049e0339946818519`: migrazione D1 `observed_players`, ricostruzione dagli archivi correnti FITP (`fitp_participant_cache`), Tennis Europe (`participant_index`) e ITF (`players_database`), separazione `osservato`/`monitorato`, conteggi per circuito, ricerca Admin fino a 100 risultati e API `/v1/player-search` fino a 25 risultati.
- I 23 giocatori che alimentano oggi mappa e notifiche restano invariati. L'indice osservato è separato e non modifica i tre motori, le loro frequenze, gli output o la mappa. L'omonimia non produce merge tra circuiti: gli ID ufficiali hanno priorità e, in loro assenza, l'identità resta circoscritta al circuito.
- La diagnostica ITF Admin viene resa esplicita: `acceptance correnti monitorate`, `partecipazioni osservate` e `presenze in app` sono contatori distinti. Lo zero nelle acceptance correnti non equivale a database ITF vuoto.
- Workflow di certificazione: `Court Watch Cloudflare D1 and app API`, run specifico `33286371416`. Passaggio a OOP consentito soltanto dopo run verde e verifica che l'indice D1 contenga record per tutti e tre i circuiti e sia interrogabile da Admin/API.
- Esito run `33286371416`: fallimento corretto del gate dopo importazione di 86.922 identità osservate (FITP 74.691, Tennis Europe 12.231, ITF 0). La causa non era il motore ITF: l'indicizzatore leggeva erroneamente `itf_players_database`, alimentato soprattutto dai risultati e attualmente vuoto, invece delle 41.255 partecipazioni conservate in `itf_participant_cache` dalle acceptance.
- Correzione commit `ddceb01fba2b4a1fd7bdee99b093f22a7a078840`: indice ITF costruito dal participant cache permanente usando `worldTennisId` quando presente e identità per nome circoscritta a ITF altrimenti. Aggiunta in Admin la spia `R2 acquisizione`: verde soltanto con 3/3 puntatori `current`, diagnostiche fresche e soglie minime positive per snapshot FITP e partecipazioni TE/ITF. La spia non rende R2 una dipendenza di navigazione: app e Admin continuano a leggere D1. Nuovo run specifico `Court Watch Cloudflare D1 and app API` ID `33286520906`.
- Il run `33286520906` ha ancora restituito ITF 0; l'analisi successiva ha escluso un cache R2 vuoto. Il run verde `33286654040` ha letto dal puntatore ITF `current` 41.255 partecipazioni permanenti e costruito in D1 98.099 identità osservate: FITP 74.691, Tennis Europe 12.225, ITF 11.183; tutte le sorgenti risultano `current`. D1, import, Worker e parità live sono verdi. R2 resta backup/archivio e non dipendenza di navigazione.
- Dopo il deploy verde, `/admin` restituiva `Internal error`: la spia R2 referenziava `generationCounts` prima della sua inizializzazione JavaScript. Correzione isolata commit `392e041f7857a8bf966b0a00405c23a53bdb1798`; nessun dato o motore coinvolto. Workflow specifico di verifica `Court Watch Cloudflare D1 and app API` ID `33306066221`.
- Incidente mappa dopo la sincronizzazione D1: la pagina live mostrava numerosi falsi tornei `Profilo Tennis Europe verificato` e duplicava J30 Cuneo. Causa: `generate-seed.mjs` popolava `app_tournaments` dal vecchio aggregato `data.json`; finché D1 risultava obsoleto, il gate di freschezza faceva usare alla V3 il JSON corretto e mascherava il difetto. Dopo il nuovo import D1 fresco, la mappa ha letto la proiezione sbagliata. Verifica browser live: 23 giocatori presenti, nessun errore applicativo, ma record tecnici ripetuti nel calendario. `dist/v3/tournaments.json` contiene invece 417 relazioni reali, zero record profilo e un solo J30 Cuneo.
- Correzione strutturale commit `5ee143583c9d0e28d4f0aa8ae28f759c2004dcdb`: seed `app_tournaments` e verifica di parità usano entrambi `dist/v3/tournaments.json`; il workflow D1 si attiva esplicitamente anche alla modifica di questo file. Nessun filtro cosmetico e nessuna modifica ai motori. Run specifico `Court Watch Cloudflare D1 and app API` ID `33306244870`. Dopo il verde verificare nuovamente la mappa live prima di proseguire con OOP.
- Run `33306244870` certificato verde dall'utente. Verifica browser live successiva: stato `Live v3`, 23 giocatori presenti, 53 bande calendario nel mese visualizzato, zero record `Profilo Tennis Europe verificato`, nessun errore applicativo della pagina. J30 Cuneo compare graficamente in due bande perché la sua finestra 8–15 agosto attraversa due settimane; la sorgente ufficiale `dist/v3/tournaments.json` contiene una sola relazione Martina–J30 Cuneo. L'incidente mappa è chiuso.
- Admin riorganizzata come `Court Watch Control Center`, commit `1b3d890b5b2d297acc649923c856708e4f95f4f1`. Navigazione interna in quattro aree: diagnostica; profili universali; utenti/accessi futuri; database e backup. Ricerca profili D1 attivata soltanto da due caratteri, filtro per circuito, ID sorgente, osservazioni, ultima osservazione e stato monitorato/osservato. Aggiornamento automatico ogni cinque minuti.
- Aggiunta migrazione persistente `0005_user_control_foundation.sql`: `app_users` con ruoli admin/operator/user e stati invited/active/suspended; `user_player_profiles` per legami self/guardian/coach/follows e preferenza notifiche. Nessun login pubblico viene attivato senza provider di autenticazione, verifica email e sessioni server-side. Le tabelle sono consultabili dall'esploratore D1 Admin. R2 resta sezione backup/diagnostica e non sorgente di navigazione. Workflow specifico `Court Watch Cloudflare D1 and app API` ID `33306518011`.
- Run `33306518011` certificato verde dall'utente e verificato: migrazioni D1, recupero indici R2, costruzione 98.099 profili, proiezione universale, import, parità D1, validazione/deploy Worker e parità live della mappa tutti conclusi `success`. La fondazione Admin/D1 è tecnicamente chiusa. È consentito passare al punto 2, iniziando dalla progettazione e riscrittura OOP senza importare le 442 righe legacy come fondazione.
- Chiarimento Admin: `app_users` rappresenta account dell'app e resta correttamente a zero finché registrazione/login non vengono attivati; i 98.099 giocatori sono in `observed_players` e si cercano in Profili universali. UI aggiornata per rendere esplicita la distinzione.
- Spia R2 corretta secondo il ruolo definitivo di solo backup: integrità (3 puntatori `current` e indici D1 derivati dalle generazioni correnti) separata dalla freschezza dei motori. Una sorgente invariata non rende più falsamente `obsoleto` il backup; acquisizioni recenti/da aggiornare sono mostrate con una spia distinta. Commit `6995f2e3fadc3df8472458e61a6e46b3b739a95c`, workflow Admin/D1 `33306850816`.
- Diagnosi ITF sicurezza 120 giorni run `33303755413`: 16 shard acceptance e 16 retry tutti verdi; unico failure nel job review, step `Commit validated ITF database and map`, con conflitti di rebase in 13 JSON perché `main` era avanzato durante il run. Correzione definitiva nello stesso commit `6995f2e3`: il workflow conserva gli output ITF già validati, riparte dall'ultimo `origin/main`, rigenera `entries-engine` e la mappa con le sorgenti concorrenti correnti, quindi tenta push fino a cinque volte. Nessun rebase dei JSON generati e nessuna sovrascrittura cieca. Run specifico ITF 120 giorni `33306850732`.
- Admin database reso realmente interrogabile, commit `fec1c0720d46d9643fea63a2f5a756c931ab10f4`: query builder protetto e read-only con viste/tabelle in whitelist, ricerca payload, due filtri combinabili AND, operatori `eq/neq/contains/starts/gt/gte/lt/lte`, ordinamento, direzione, paginazione, limiti 25/50/100, conteggio totale ed export JSON/CSV fino a 5.000 righe. Inclusa vista relazionale `giocatore → tornei` con nome, Court Watch ID, circuito, ID torneo, date e stato. Inclusi profili osservati, canonici, tornei, entry, schedule, match, risultati, proiezione app, account, legami utente–profilo, override e audit. Nessuna console SQL libera e nessuna operazione di scrittura. Workflow specifico Admin/D1 `33307211875`.

## Sequenza operativa vincolante aggiornata

1. **Completato:** deploy #890 verde e V3 verificata live con 23 giocatori, proiezione tornei aggiornata, assenza errori applicativi e fallback di freschezza funzionante.
2. Creare **Admin v1 protetta** prima del punto 2. Prima versione in sola lettura: diagnostica FITP/TE/ITF, freschezza generazioni, watchdog, D1/R2, workflow falliti, copertura e problemi aperti. Non pubblicare una pagina amministratore protetta soltanto da password JavaScript; usare un controllo accessi reale.
3. Passare al **punto 2** soltanto dopo Admin v1. Riscrivere integralmente tabelloni, match, OOP, risultati, avversari e revisioni orario/campo.
4. La vecchia fase OOP non costituisce la fondazione del nuovo sistema: le 442 righe legacy non vengono importate nella proiezione D1 applicativa. L'API dichiara `oop.mode=excluded_pending_full_rewrite`.
5. Estendere poi Admin con aggiunta/modifica giocatori, eventi manuali, audit, notifiche, utenti e ruoli.
- 30 agosto 2026 — Separato il Control Center Admin in pagine autonome, commit `01cf955add3447684be8ec55ae0f5da32fd5a9b5` (`Split Admin control center into dedicated pages`). `/admin` reindirizza ora a `/admin/diagnostica`; menu persistente verso `/admin/diagnostica`, `/admin/profili`, `/admin/utenti`, `/admin/database`, `/admin/backup` e `/admin/fallimenti`. Ricerca profili e query D1 restano nella rispettiva pagina, gli override tornano alla pagina Utenti, e autenticazione/protezione server-side rimangono comuni. Modifica esclusivamente Admin: nessun cambiamento ai tre motori, alla mappa o al run ITF già in corso. Workflow di riferimento: `Court Watch Cloudflare D1 and app API`.
- 30 agosto 2026 — Corretta la consultazione Admin giocatore→tornei e la spia Watchdog, commit `d6a3ca60dcfa97bbce1b8d9ea84c3345a0db04d7` (`Show player tournaments and restore watchdog status`). La vista D1 `player_tournaments` espone ora direttamente nome torneo, località, circuito, date e stato in una tabella leggibile, invece di mostrare soltanto il nome del giocatore sopra JSON chiuso; la ricerca testuale copre insieme giocatore e payload torneo. La diagnostica Watchdog interroga inoltre lo storico dello specifico workflow di deploy, separatamente dalla finestra generale degli ultimi 50 run, evitando il falso `non disponibile` causato dall'elevato volume Actions. Nessun dato motore o mappa modificato. Workflow di riferimento: `Court Watch Cloudflare D1 and app API`.
- 30 agosto 2026 — Avviata la riscrittura separata Tennis Europe OOP+risultati con fase di ricognizione ufficiale. Creati `src/v3/discover-tennis-europe-oop-routes.mjs` (commit `47ffcada783a9636a552afe5a2c0181c12683bb4`) e workflow autonomo `.github/workflows/courtwatch-tennis-europe-oop-discovery.yml` (commit `23ac5db6cf1d911d540e07e8b1b2832e8645ee2e`). La ricognizione usa il catalogo completo di 598 tornei, accetta la cookie wall ufficiale e campiona tornei conclusi, attivi e T−1, scoprendo e verificando route Matches/Order of Play/Results e relativo markup. Produce soltanto artifact diagnostico e fallisce se non trova prove utilizzabili: non modifica motore entry Europe, T−1, mappa, agenda o dati pubblici. Requisiti fissati per la fase successiva: storico dal 18/12/2025, tutti gli OOP e risultati, tutti i partecipanti Europe, avvio dei futuri solo a T−1, aggiornamento live 10–15 minuti, proiezione automatica in agenda per i giocatori Court Watch. Workflow di riferimento: `Court Watch Tennis Europe OOP route discovery`.
- 30 agosto 2026 — Prima ricognizione Tennis Europe OOP verde, run `33308243931`: catalogo 598 tornei, 7 campioni tra conclusi/attivi/T−1, 4 route utili. Identificata come route reale moderna `https://te.tournamentsoftware.com/tournament/{competitionId}/matches`; le vecchie route `/sport/matches.aspx` effettuano redirect e le varianti `/sport/matches`/`results.aspx` restituiscono shell non utili. Per costruire il parser sul markup reale, non su ipotesi, la ricognizione salva ora anche campioni HTML delle pagine match (commit `d47fcf7b86cac35d4e5eabe91681b1dd0fc4b57b`) e il workflow li include nell'artifact (commit `ca773124d47277de505747a3781987dc02fb7de4`). Nessuna pubblicazione applicativa.
- 30 agosto 2026 — Il primo run di cattura markup `33308307648` è fallito prima dell'acquisizione per un escape eccessivo nel literal regex della route `/tournament/{id}/matches`; anche l'upload artifact è quindi fallito per assenza dei file. Corretto il matcher senza modificare la logica (commit `75069204dfd3408d97f95f8b5f1a7c64d103221c`). Nuovo workflow specifico: `Court Watch Tennis Europe OOP route discovery`, run `33308356004`.
- 30 agosto 2026 — Run cattura markup verde `33308356004`. Confermata struttura ufficiale: pagina base con tab giornalieri e route `/tournament/{id}/matches/{YYYYMMDD}`; match con campo, orario di inizio, evento/draw, turno, player ID, nazionalità, vincitore, set e walkover. Creato parser proof `src/v3/prove-tennis-europe-oop-parser.mjs` (commit `ea0ab21002883d14d9bfe7155d3d283303ec7ccf`) e workflow isolato `Court Watch Tennis Europe OOP parser proof` (commit `993ec959ab38b0f5d372914db515cfc9f935022e`). Il proof legge tre tornei ufficiali, tutte le giornate pubblicate e certifica presenza di match, giocatori e risultati; produce solo artifact e non pubblica nell'app.
- 30 agosto 2026 — Primo parser proof run `33308458286` rosso con artifact valido: 3 tornei letti ma 0 date/match perché il selettore HTML presupponeva `class` prima di `data-value`, mentre TennisTournamentSoftware pubblica gli attributi nell'ordine inverso. Corretto il parser rendendo l'estrazione dei tab indipendente dall'ordine degli attributi (commit `d135293fc0a67b122dd2fe9a099c3670c06d6923`). Nuovo workflow specifico `Court Watch Tennis Europe OOP parser proof`, run `33308512400`. Nessun dato pubblico coinvolto.
- 30 agosto 2026 — Secondo parser proof run `33308512400` rosso: artifact nuovamente 3 tornei e 0 date/match. Il selettore corretto non riceveva però il markup completo, perché il proof non aveva ereditato la sessione di consenso cookie usata dalla ricognizione verde. Aggiunta al proof la stessa sequenza ufficiale `/tournaments` → cookie wall → `CookiePurposes` → session cookie e gestione redirect (commit `85f12663de82b5f844afafd63961bf48f3f35c4e`). Nuovo workflow specifico `Court Watch Tennis Europe OOP parser proof`, run `33308585456`.
- 30 agosto 2026 — Terzo parser proof run `33308585456` rosso, ancora 0 date. Verifica del sorgente pubblicato: nella correzione precedente i literal regex erano stati scritti con doppio backslash (`/<a\\b/` e `/^20\\d/`), quindi cercavano caratteri letterali invece di word-boundary e cifre. Corretto il sorgente a `/<a\b/` e `/^20\d/`, verificato nuovamente sul file GitHub (commit `54ab3fd5772e31176f0546597aacd2fd94611920`). Nuovo workflow specifico `Court Watch Tennis Europe OOP parser proof`, run `33308678794`.

## Aggiornamento 30 agosto 2026 — archivio Europe OOP, ripristino ITF e stato agenda

- Archivio storico Tennis Europe OOP+risultati certificato su 453 tornei: 47.048 match unici, 46.997 risultati conclusi, 51 match ancora indicati come programmati dalla fonte, 10.501 identità nominali uniche, zero shard mancanti, zero conflitti, zero errori di sorgente e zero vincitori irrisolti. Copertura certificata dal 28 dicembre 2025 al 29 agosto 2026. Le 51 righe `scheduled` non sono state convertite artificialmente in risultati.
- Motore live Tennis Europe OOP+risultati attivato da T−1 ogni 15 minuti, con confronto fra snapshot consecutivi, rilevamento di nuovi match, transizioni `scheduled → completed`, cambi di punteggio/vincitore, giorno/ora/campo e rimozioni. Persistenza R2 generazionale `current`, `backup-1`, `backup-2` con verifica SHA-256 e fallback iniziale all'ultimo artifact verde.
- Snapshot live certificato iniziale: 21 tornei, 1.051 match, 816 conclusi, 235 programmati, 1.026 identità nominali, zero errori e zero vincitori irrisolti. Snapshot successivo ripristinato da R2 e ampliato a 1.075 match, con 24 nuovi match programmati e nuova generazione verificata.
- Archivio storico e live unificati in D1: 48.123 match, 47.813 risultati conclusi, 310 programmati, 474 tornei, 10.695 identità Europe e 117.028 partecipazioni. Il primo import è fallito in sicurezza per `SQLITE_TOOBIG`; rimosso il payload match annidato nei tornei e frazionato l'import in circa 88 file. Il run sostitutivo ha certificato parità D1, deploy Worker e API applicativa.
- Audit Court Watch–Europe: Excel con 149 relazioni giocatore–match e 147 match unici. La differenza deriva da due doppi nei quali compaiono due giocatori Court Watch nello stesso incontro. Il collegamento usa esclusivamente il nome completo normalizzato; nessun alias o match approssimativo è autorizzato.
- Anomalia indice osservati ITF individuata: il selettore aveva accettato `backup-1` con soli 498 profili perché richiedeva soltanto un conteggio positivo. Corretto il gate: nessuna generazione sotto 10.000 partecipazioni può alimentare D1 e la parità richiede almeno 5.000 identità ITF uniche.
- Ripristino ITF certificato dal puntatore `current`: 33.617 partecipazioni permanenti, 10.182 identità ITF uniche in D1 e 97.157 profili osservati complessivi. Tutte le sorgenti derivano da `current`. Il backup ridotto da 498 non può più essere accettato.
- L'audit isolato Court Watch → match Europe non ha scritto nell'agenda. Un primo tentativo è fallito per `SyntaxError`; aggiunto `node --check` preventivo. L'ultimo tentativo di staging si è fermato al controllo sintattico prima di migrazioni o scritture D1. `app_matches` resta a zero e l'agenda pubblica è invariata.

### Passaggi mancanti vincolanti per l'agenda Europe

1. Confrontare in D1 tutti i match Court Watch con l'Excel di audit e richiedere parità esatta: 149 relazioni giocatore–match e 147 match unici.
2. Certificare separatamente associazioni esatte, omonimie e casi ambigui. Una sola ambiguità deve bloccare la pubblicazione; non usare alias o associazioni approssimative.
3. Popolare `app_matches` in modo idempotente soltanto dopo il superamento del gate di parità, aggiornando lo stesso match senza duplicarlo.
4. Mostrare nell'agenda, nello stesso giorno ufficiale del match, torneo, OOP, avversari, compagno nel doppio, turno, ora, campo, punteggio e risultato. Le transizioni live `scheduled → completed` e le revisioni di orario/campo devono aggiornare la stessa voce.

### Stato operativo alla sospensione

- Motori, mappa e database certificati restano invariati.
- Nessun workflow aggiuntivo è stato avviato dopo l'ordine di arresto.
- Agenda pubblica non ancora collegata ai 48.123 match Europe.
- Prossimo passo autorizzabile: audit di parità D1 contro Excel, senza scrivere in `app_matches`; la promozione agenda resta un passaggio separato.

## Aggiornamento 30 agosto 2026 — ripresa audit agenda Europe

- Ripresa autorizzata dei quattro passaggi agenda, mantenendo la separazione fra audit e pubblicazione.
- Verificato direttamente `main`: lo script `src/v3/audit-tennis-europe-courtwatch-history.mjs` è sintatticamente valido e applica il collegamento per nome completo normalizzato, senza alias, con blocco in presenza di collisioni Court Watch o più identità ufficiali per lo stesso nome.
- Individuata la causa dell'ultimo staging rosso nel workflow `.github/workflows/courtwatch-tennis-europe-player-match-audit.yml`: due sequenze letterali `\\n` erano state inserite nel YAML e impedivano la corretta esecuzione dello step `node --check`.
- Corretto esclusivamente il workflow, commit `94fc5f3947cdee848b2044ed747fabc835071849` (`Fix Tennis Europe player-match audit workflow syntax`).
- Avviato automaticamente il run audit isolato `33339131733`. Il run deve certificare parità e zero ambiguità; non scrive in `app_matches` e non modifica l'agenda.
- In conformità alla regola sul consumo IA, nessun polling continuo: attendere l'esito verde/rosso comunicato dall'utente prima di procedere alla promozione D1.

## Aggiornamento 30 agosto 2026 — parità audit e staging D1 agenda Europe

- Run audit isolato `33339131733` certificato verde: 20 giocatori Court Watch abilitati Europe, 13 con match, 149 relazioni giocatore–match, 147 match unici, 149 relazioni concluse, zero programmate e zero ambiguità.
- I passaggi agenda 1 e 2 sono quindi completati: parità con l'Excel 149/147 e certificazione delle associazioni esatte/ambigue con `ambiguous=0`.
- Confermata la separazione preventiva `app_match_candidates`: chiave primaria `(courtwatch_id, match_id)`, collegamento esclusivamente per nome completo normalizzato, manifest rigido 149/147 e `publishedToAgenda=false`. `app_matches` non viene ancora popolata.
- Individuati ulteriori escape `\\n` letterali nel workflow D1 e nel verificatore di parità. Corretto `.github/workflows/courtwatch-cloudflare-app-api.yml`, commit `8c8f4130322cfceb8cd20b06fe40c4fca0e4e1c1`; corretto `cloudflare/app-api/scripts/verify-d1.mjs`, commit `dd6d8111c6f0d8fed5bba76e736ae93ea2cec25f`.
- Avviato il run D1 di staging `33339259065`. Il run importa e verifica `app_match_candidates`, ricertifica storico/live Europe, profili osservati ITF e parità complessiva, ma lascia invariata l'agenda pubblica.
- Prossimo gate: D1 deve contenere esattamente 149 candidati e 147 `match_id` distinti. Solo dopo il verde è consentito implementare la promozione idempotente in `app_matches`.

## Aggiornamento 30 agosto 2026 — promozione certificata verso `app_matches`

- Run staging D1 `33339259065` certificato verde: 149 candidati, 147 match distinti, 10.182 identità ITF da `current`, 48.122 match Europe correnti, 47.813 risultati e 309 programmati. La variazione di un match rispetto alla generazione precedente deriva dallo snapshot live corrente; la parità interno-manifest è esatta.
- Implementata la proiezione completa per ogni relazione Court Watch–match: ID stabile, giocatore, match e torneo, giorno, ora, campo, evento/draw, turno, stato, punteggio, risultato, squadra, vittoria/sconfitta, tipo singolare/doppio, compagno e avversari. Squadra e avversari derivano esclusivamente dagli array ufficiali `teams` e `players`; nessuna euristica nominale ulteriore.
- La promozione è idempotente: elimina e ricrea soltanto le righe `app_matches` con `circuit='tennis-europe'`, preservando eventuali altri circuiti. Commit `8d1db2222ef3c85e07c91d7ea8d06f642dadbcd3`.
- Rafforzato il verificatore D1: richiede 149 righe Europe in `app_matches`, 147 `matchId` distinti e zero righe prive di giocatore, match, data, torneo, avversario, turno o risultato per i completati. Commit `e43df4c114583d1c4e2f9a39d0687c1668265197`.
- Rafforzata la parità API live: `/v1/app-snapshot` deve esporre 149 righe, 147 match distinti e zero payload invalidi; stato dichiarato `d1_projection_ready_pending_agenda_ui`. Commit `640704225d89a5d872ae50b2de6d5d7c689a2ac3`.
- Run definitivo punto 3: `33339718535`. Il workflow deve certificare import D1, Worker e API; la UI agenda resta ancora invariata fino al punto 4.

## Aggiornamento 30 agosto 2026 — attivazione UI agenda Europe

- Run punto 3 `33339718535` certificato verde: `app_matches=149`, 147 match distinti, zero payload invalidi; API live con 149 righe, 147 match distinti e zero righe invalide. Punto 3 completato.
- Il run ha conservato 10.182 identità ITF, ma ha indicato `backup-1` come sorgente dell'indice anziché `current`. Il conteggio completo supera tutti i gate e non blocca l'agenda Europe; l'origine del fallback resta un'anomalia separata da controllare senza nasconderla.
- Punto 4 implementato in `v3.js`, commit `82a9a3faf4599c8c5b31be9e1b9cf05592842b4c`: la proiezione API richiede ora anche `matches`; i match D1 hanno precedenza sui JSON legacy; agenda D1 e agenda legacy vengono unite con chiave `(playerId, matchId)` e tutte le partite D1 entrano nella collezione giornaliera anche se non esiste una vecchia riga agenda.
- La UI usa il giorno ufficiale `date` del match e mostra i campi già certificati: torneo, singolare/doppio, compagno, avversari, ora, campo, turno disponibile nel payload, risultato ed esito. Il profilo giocatore usa la stessa collezione match D1.
- Aggiunta verifica end-to-end, commit `2623768034306b0fd0f8de6ac5a69f2f12e756ed`: simula la stessa unione agenda, pretende che tutte le 149 righe API siano presenti, 147 match distinti, zero righe mancanti e zero campi agenda invalidi. Stato atteso `agenda_ui_enabled`.
- Deploy UI del primo commit riuscito: run `33340049845`. Verifica finale combinata D1/API/agenda: run `33340068154`; deploy Pages finale: run `33340068134`. Attendere entrambi verdi prima di dichiarare il punto 4 chiuso.

## Aggiornamento 30 agosto 2026 — separazione vincolante dei circuiti

- Requisito architetturale ribadito dall'utente: FITP, Tennis Europe e ITF devono lavorare esclusivamente sul proprio circuito. Nessun aggiornamento Europe deve ripristinare o ricostruire indici FITP/ITF.
- Il precedente workflow D1 complessivo era un aggregatore infrastrutturale, ma veniva richiamato anche dalle modifiche Europe e quindi mescolava l'orchestrazione. Le modifiche Europe sono state escluse dai trigger automatici del rebuild universale, commit `21053d1f339f0e77181e10978be7dcf8e52d753a` con skip CI.
- Creato verificatore D1 esclusivo Tennis Europe `cloudflare/app-api/scripts/verify-tennis-europe-agenda-d1.mjs`, commit `fd160115293c8210b0c485d87d0179d86d6ae97c`. Interroga soltanto tornei, match, schedule, risultati, partecipanti, candidati e `app_matches` Europe; output vincolato a `circuit:'tennis-europe'`.
- Creato workflow autonomo `Court Watch Tennis Europe agenda D1`, commit `344d07f68dad3aa16033c8ff4d37a1612befa271`. Ripristina soltanto R2 Europe, genera/importa soltanto seed Europe, verifica soltanto parità Europe e viene richiamato esclusivamente dal live Europe verde o da modifiche ai file Europe.
- Il workflow Europe non esegue `restore-observed-indexes.sh`, non costruisce `observed_players`, non legge FITP e non legge ITF. Condivide con gli altri circuiti soltanto lo schema D1 e l'API applicativa.
- Il vecchio run misto `33340068154` è fallito durante lo shard `03-matches-34.sql` per stato transitorio Wrangler `Not currently importing anything`, dopo import riuscito degli shard precedenti; non è un errore dei dati o di un circuito.
- Aggiunto retry isolato fino a quattro tentativi per ogni shard D1 Europe, con attesa progressiva e fallimento finale rigoroso, commit `70799a5f6c7572505acd5319d6816a43adc5a918`.
- Run separato definitivo: `33340341203`. Verificare che sia l'unico workflow D1 avviato; nessun nuovo run del rebuild complessivo deve comparire.

## Aggiornamento 30 agosto 2026 — sostituzione placeholder agenda Europe

- Run Europe separato `33340341203` rosso esclusivamente nel controllo finale. Tutte le fasi operative erano verdi: import di tutti gli shard, parità D1 esclusiva Europe, 48.122 match, 47.813 risultati, 149 `app_matches`, 147 match distinti, zero payload invalidi, validazione e deploy Worker.
- Il controllo finale ha rilevato `missingFromAgenda=0` ma `invalidAgendaRows=46`. La causa non erano le 149 righe D1: erano 46 vecchi placeholder Tennis Europe in `dist/v3/agenda.json`, con stato `order_of_play_pending`, senza avversario/turno/risultato. L'unione precedente conservava tutti i 109 record legacy oltre alle 149 righe nuove, producendo 258 righe e rischio di duplicati.
- Regola corretta: quando la proiezione D1 Europe è disponibile, tutte le righe legacy con `circuit='tennis-europe'` vengono escluse e sostituite integralmente dalle righe certificate D1. Le righe legacy FITP e ITF restano intatte. Commit UI `d22e0788e4e924e6bc9404acf264c07ad4362cd2`.
- Verificatore aggiornato con la stessa regola di sostituzione; deve ottenere 149 righe Europe, zero mancanti e zero invalide senza valutare i placeholder dismessi. Commit `62dccfc320a45eff51781161b95aab23f0428cd5`.
- Run finale Europe separato: `33340641088`. Deploy Pages finale: `33340641098`. Nessun workflow FITP/ITF o rebuild universale richiamato.

## Aggiornamento 30 agosto 2026 — collaudo browser e separazione della freschezza

- I run `33340641088` e `33340641098` sono entrambi verdi. Il backend certifica 149 relazioni Court Watch–Europe, 147 match distinti, 212 righe agenda complessive, zero match Europe mancanti e zero righe Europe invalide.
- Il successivo collaudo sul sito pubblico, sulla giornata del 21 febbraio 2026, ha però mostrato ancora il vecchio placeholder per Virginia Cereghini (`Avversario da definire`) anziché i dettagli D1.
- Causa: `v3.js` applicava un unico gate di freschezza all'intera proiezione API. Quando l'indice universale giocatori/tornei risultava più vecchio dei JSON, veniva scartata anche la proiezione match Europe, pur essendo aggiornata e certificata.
- Correzione architetturale: il gate universale ora decide soltanto la sorgente di giocatori e tornei; i match Europe restano indipendenti e provengono dalla API del loro circuito. Commit `3c80463abea5452efd582f232c08d4c7f5e782fe`.
- Rimossa inoltre `v3.js` dai trigger del workflow D1 Europe: una modifica puramente UI richiama soltanto il deploy statico e non reimporta dati né coinvolge motori di altri circuiti. Commit `d235a37842821d0b746d9b47b89be6aa24361aac`.
- Il primo deploy della correzione (`33341026989`) è verde, ma il controllo browser continuava a mostrare il placeholder perché `v3.html` richiamava `v3.js` con la chiave cache fissa `202608291900`; il browser eseguiva quindi il client precedente.
- Aggiornata la versione del client a `202608302315`, commit `3a7a07c22259b5ee79c63b4c73ca74ba67e2be56`. Deploy Pages `33341149722` avviato. Anche questa modifica è esclusivamente statica: nessun import D1 e nessun motore di circuito richiamato.
- Deploy `33341149722` certificato verde. Per il commit sono partiti esclusivamente `Deploy CourtWatch` e il deployment Pages nativo; nessun workflow D1, Tennis Europe, FITP o ITF è stato richiamato.
- Collaudo browser pubblico completato sulla data campione 21 febbraio 2026. La voce di Virginia Cereghini mostra: ore 10:30, Tennis Europe, Bad Waltersdorf 2026 - Indoor, campo ufficiale, avversaria Anna Izabell Gazdig, risultato 6-0 6-1 e stato `Terminata`. Il precedente testo `Avversario da definire` non compare più.
- Punto 4 agenda certificato: OOP, avversario, ora, campo e risultato vengono mostrati nello stesso giorno del match usando la proiezione Europe D1, mantenuta indipendente dai motori degli altri circuiti.

## Aggiornamento 30 agosto 2026 — hardening ITF e serializzazione D1

- Chiarita la scansione completa FITP: i cicli incrementali girano ai minuti 17 e 47 di ogni ora; la domenica alle 02:11 UTC viene riletta l'intera base FITP per recuperare modifiche sfuggite, preservando storico e isolamento del circuito.
- Corretto il workflow legacy ITF: rimossi `set +e`, `exit 0`, `npm ci || true` e push tolleranti. Acquisizione, finalizzazione, validazione di `itf-sync.json` e pubblicazione ora falliscono esplicitamente in presenza di errori. Commit `781996bcb15ffa74b6e28bb68d9285a4520b5c64`; collaudo `33341777292`.
- Corretto il coordinamento D1: workflow universale e workflow Europe usano la coda condivisa `courtwatch-d1-writes` con `cancel-in-progress: false`, impedendo scritture concorrenti sul database remoto.
- L'import Europe eseguito dal workflow universale applica ora fino a quattro tentativi per ciascun file SQL, con attesa progressiva per gli stati transitori D1. Commit universale `6c1252755b9e279b710d04457a6c551d5db343e5`; collaudo `33341778825`.
- Workflow D1 Europe allineato alla stessa coda, commit `f7ffb1f997cd246c5873f30078fdfea631534c69`; collaudo `33341778973`, accodato dietro al collaudo universale.
- Stato alla revisione: modifiche pubblicate; certificazione conclusiva subordinata al verde dei tre collaudi ITF, D1 universale e D1 Europe.

## Aggiornamento 30 agosto 2026 — ripristino posizione dopo ricaricamento

- L'app conserva localmente giorno dell'agenda, mese del calendario, insieme dei giocatori selezionati e posizione verticale della pagina.
- Al ricaricamento viene ripristinata la stessa situazione invece di tornare automaticamente a giorno e mese correnti; l'eventuale profilo aperto resta preservato dall'URL con hash.
- Gestito esplicitamente anche lo stato con zero giocatori selezionati, evitando la precedente selezione automatica di tutti al reload.
- Modifica client `a688e2eaccb22da667f785b8eeca18c495c1ceda`; chiave cache aggiornata con commit `5f7f38f6105ee69dd8cddd384442101a97aaceaa`.
- Deploy `33342072029` avviato; resta da eseguire il collaudo browser con cambio giorno/mese, selezione e ricaricamento reale.

## Aggiornamento 30 agosto 2026 — comando Home · Oggi

- Il deploy della persistenza `33342072029` è verde.
- Aggiunto nell'intestazione il comando esplicito `Home · Oggi`: azzera giorno e mese salvati, chiude l'eventuale profilo, mostra la home e riporta la pagina in cima, preservando i giocatori selezionati.
- Modifica client `7dd033f025e2bbdf210b881c283cc9def48098ff`; pubblicazione/cache `b9c41e5588aac1b306391099b2cac49b76cdf392`; deploy `33342305197` avviato.
- Esiti infrastrutturali correlati registrati separatamente: D1 universale `33341778825` verde; ITF rigoroso `33341777292` rosso nello step di sincronizzazione; D1 Europe `33341778973` rosso durante l'import SQL. L'agenda Europe già certificata e pubblicata non è stata rimossa.

## Aggiornamento 30 agosto 2026 — eliminazione ITF legacy e proprietà D1 per circuito

- Log ITF `33341777292`: causa esatta `ENOENT former-players.json` nel wrapper legacy `run-with-former.mjs`; non era un errore della fonte ITF né del database validato.
- Il workflow `courtwatch-itf-live.yml` è stato rinominato `ITF legacy diagnostic (manual)` e privato di trigger automatici. L'acquisizione automatica resta affidata esclusivamente al motore ITF validato e shardato. Commit `4f2312a19912d3a315df7c34f3d2d201730c9c65`.
- Il seed universale D1 ora preserva tutte le righe possedute da Europe: `tennis_europe_players`, partecipanti, candidati, `app_matches`, match, schedule, risultati e tornei `te-oop`. Esclude inoltre i match Europe legacy dal reinserimento universale. Commit `c3256e201f02de73e35135bd2f1486349f22f303`.
- Il workflow D1 universale non genera né importa più la generazione Europe; la ripristina soltanto per la verifica di parità. Commit `c270f0ec3bc4fca7798b35714b1e00e8197d408c`; collaudo `33342507292`.
- Log Europe `33341778973`: Wrangler aveva processato 4.110 query dello shard `03-matches-22.sql` ma aveva restituito `Not currently importing anything`; il retry incontrava poi `UNIQUE constraint failed: matches.id`, prova che il primo tentativo aveva già scritto le righe.
- Tutti gli inserimenti degli shard Europe e della proiezione agenda sono ora `INSERT OR REPLACE`, quindi un retry aggiorna la stessa chiave ed è idempotente. Commit `e30c46a56b788d9713b06fb969fa3ffc5515b398` e `5d55fc189117c110aa64610744fb9d0fa474c653`; collaudo Europe sopravvissuto alla coda `33342536053`.
- Stato alla revisione: ITF legacy rimosso dall'automazione; D1 separato per proprietario di circuito; collaudi D1 universale ed Europe ancora in corso/attesa.

## Aggiornamento 30 agosto 2026 — pending ITF, verifica universale e tempi Europe

- `pending` ITF significa che il tabellone non è stato letto con prova sufficiente, tipicamente per challenge Incapsula. Il motore conserva la situazione precedente e non interpreta l'assenza di dati come assenza del giocatore.
- Il ciclo T−1 controllato aveva 26 tornei: 1 completo e 25 pending; è quindi operativo e fail-safe, ma parziale nella copertura live dei tabelloni. Acceptance live e storico restano completi: 241 tornei/33.617 partecipanti senza errori, archivio storico 1.065 tornei.
- Run universale `33342507292`: import D1 universale riuscito (98.365 query); rosso soltanto in verifica per assenza del file locale `seed-tennis-europe-oop/manifest.json`, non per errore D1.
- Aggiunta generazione locale e read-only dei manifest Europe prima della parità; nessun SQL Europe viene importato dal workflow universale. Commit `30ddcbb80562007db539c86096d61c8b18cf00be`; collaudo `33342726510`.
- Tempi Europe: il backfill iniziale di 453 tornei/47.048 match è eccezionale e non viene ripetuto dalla ricerca OOP live. Il live controlla soltanto tornei attivi/T−1 ogni 15 minuti. L'import D1 Europe corrente ricostruisce tuttavia ancora l'intera proiezione da circa 48 mila match e può richiedere diversi minuti; resta ottimizzabile a delta per ridurre il tempo di pubblicazione.

## Aggiornamento 31 agosto 2026 — import incrementali Europe e D1 universale shardato

- Confermati verdi rimasti indietro: Europe D1 `33342536053` e ITF discovery 42 giorni `33342432823`.
- `pending` ITF confermato come stato T−1 senza tabellone leggibile con prova sufficiente: nessuna esclusione viene prodotta finché il draw non è completo.
- Europe OOP/D1 convertito in modalità incrementale: il manifest continua a rappresentare storico+live, ma gli SQL ordinari contengono soltanto tornei, identità e match dello snapshot live. Gli stessi match eliminano e ricreano esclusivamente schedule, risultato e partecipanti propri, poi applicano UPSERT. Commit `dbe49228dcf91f8ac701e1369a669de34100d1c5`.
- Candidati e agenda Europe diventano cumulativi: nessuna cancellazione globale nei cicli incrementali, UPSERT delle relazioni e sostituzione mirata della sola voce giocatore-match aggiornata. Il gate 147/149 diventa una soglia minima, consentendo la crescita futura. Commit `08cc9c8e7aa8f3216bb658efc57a6999547757f5`.
- Verifica Europe adattata alla persistenza: zero record invalidi resta esatto; conteggi archivio/agenda devono essere almeno pari alla generazione corrente, così i match già salvati non vengono persi quando escono dalla finestra live. Commit `935af54b3eccfafb8ebd383968dcfd1f3f583bfa`.
- Workflow Europe configurato con `TE_INCREMENTAL=1`, commit `9ec9296aeff5cd7a89abeb9006bed5f51dac1e58`.
- Ultimo universale `33342726510` rosso durante il singolo import da 98.365 query per `D1 DB storage operation exceeded timeout`; nessun errore di sorgente.
- Seed universale modificato per preservare `observed_players`, usare UPSERT e produrre blocchi da 2.000 statement anziché un unico file. Workflow aggiornato con retry per blocco. Commit `a8260285b499f7d225207ce56519c42cd63009ea` e `2d49ffbcf547d6d2b53cb87870c5e6dd95297f43`; collaudo universale `33388120456` accodato.
- La coda ha mantenuto in esecuzione Europe `33387989252`, nato prima dell'attivazione `TE_INCREMENTAL`; i run Europe successivi sono stati cancellati dalla semantica GitHub della singola posizione pending. Dopo la conclusione del collaudo universale servirà un ultimo run Europe sulla revisione incrementale completa.

## Aggiornamento 31 agosto 2026 — coda rate-limited per tabelloni ITF T−1

- Confermati verdi i due collaudi D1: Europe `33387989252` e universale shardato `33388120456`.
- Causa operativa dei pending ITF: un singolo runner interrogava fino a 26 tornei e numerose sezioni consecutive; dopo le prime risposte ITF applicava challenge Incapsula. Non viene implementato alcun aggiramento della protezione.
- Il lettore T−1 è stato convertito in coda persistente ordinata per `checkedAt`: massimo due tornei per ciclo, priorità ai pending meno recenti, decisioni complete escluse dai cicli successivi. Commit `8c58eea11146a8880042215438c6c43aa3984ac8`.
- Audit draw portato a versione 5 con stato esplicito `pending_retry`/`batch_complete`, `batchLimit`, `challengeTournaments` e `queueRemaining`; l'assenza viene certificata solo quando tutte le famiglie di singolare risultano popolate.
- Frequenza T−1 portata a ogni cinque minuti, ritardo tra richieste aumentato a 1.800 ms e batch limit fissato a due tornei. Commit `bb2437a892f6f1d9ade790c5a561a342eea2cc03`; collaudo `33389057481` in coda.

## Aggiornamento 31 agosto 2026 — certificazione D1 Europe incrementale e stato ITF

- Collaudo ITF T−1 `33389057481` verde: il motore a coda rate-limited termina correttamente e conserva lo stato in R2. Il verde certifica il funzionamento della coda, non la disponibilità completa dei tabelloni.
- Ultimo audit pubblico precedente alla coda: 23 tornei pending, tutti nella finestra corrente; 21 con inizio 31 agosto 2026 e 2 con inizio 1 settembre 2026. Due tabelloni erano parzialmente pubblicati; gli altri risultavano prevalentemente bloccati da challenge Incapsula. Nessuna assenza di un giocatore viene dedotta da una lettura incompleta o bloccata.
- Primo collaudo D1 Europe incrementale `33392041698`: generazione dei delta, import D1, parità Europe e deploy Worker tutti verdi. Il solo gate finale era rosso per una differenza FITP estranea a Europe (un torneo di Gregorio Puccio presente nel JSON statico ma non nell'API).
- Il gate API è stato separato per responsabilità: quando `TE_INCREMENTAL=1`, il workflow Europe verifica esclusivamente OOP, match, risultati e agenda Europe; FITP e ITF restano responsabilità dei rispettivi workflow. Commit `392f6601f39c3f5da97f122bd07c371af642befe`.
- Run definitivo D1 Europe incrementale `33392430535` verde. Certificato che i cicli ordinari importano soltanto lo snapshot live nuovo o modificato, preservano lo storico già presente, applicano UPSERT idempotenti e mantengono almeno 149 relazioni agenda / 147 match Europe distinti con zero righe invalide.
- Stato conclusivo D1 Europe: risolto. I circuiti condividono il database relazionale `courtwatch-app`, ma acquisizione, proprietà delle righe e gate di validazione restano separati per FITP, ITF e Tennis Europe.

## Aggiornamento 31 agosto 2026 — report canonico e backup locale indipendente

- Questo report di passaggio di consegne è il documento canonico del progetto. Deve essere aggiornato dopo ogni modifica materiale a motori, dati, workflow, D1, R2, agenda, UI, backup o procedure di ripristino. Il precedente `docs/courtwatch-continuous-report.md` non sostituisce questo documento.
- Verificata la copertura del report: contiene cronologia operativa, decisioni architetturali, incidenti e correzioni, conteggi certificati, stato di FITP/ITF/Europe, D1, R2, agenda, UI, run di collaudo e punti ancora aperti. L'unico punto operativo non ancora certificato integralmente resta la convergenza della coda ITF T−1 contro i tabelloni bloccati o parzialmente pubblicati.
- Aggiunto `tools/backup/backup-courtwatch.sh`, commit `3051a6aa7d1dced4159a338ab6ec51160cd0e84d`: esporta D1 `courtwatch-app`, genera una copia SQLite locale, richiede `PRAGMA integrity_check=ok`, copia esclusivamente i prefissi R2 ufficiali FITP, ITF, storico Europe e live Europe e produce un manifest SHA-256.
- Aggiunta guida `tools/backup/README.md`, commit `65179e03e2fb65b6997e3fbde7940063d8dc9a19`: configurazione delle credenziali, esecuzione su computer/NAS, percorso su disco esterno, pianificazione settimanale, sicurezza e ripristino.
- La cancellazione delle copie locali oltre 30 giorni è disattivata per impostazione predefinita e richiede `COURTWATCH_PRUNE=1`. La directory `.courtwatch-backups/` è esclusa da Git con commit `a52b71a9a1b88f80d5ab440c7d4ef17de1709ba7`, evitando la pubblicazione accidentale del database nel repository pubblico.
- Copertura risultante: generazioni applicative R2 `current/backup-1/backup-2`, Time Travel D1 secondo il piano Cloudflare, cronologia Git, più procedura per una copia locale indipendente. La protezione fuori da Cloudflare diventa effettiva soltanto dopo la prima esecuzione dello script su un computer, NAS o disco esterno autorizzato.

## Aggiornamento 31 agosto 2026 — consolidamento definitivo del report

- I due report esistenti sono stati riallineati integralmente alla stessa revisione e allo stesso contenuto, eliminando la divergenza tra il vecchio report continuo e il documento di passaggio.
- Scelta definitiva: l'unico report canonico è `docs/CourtWatch_v3_handoff_report.md`, in formato Markdown e versionato su GitHub. Git è il sistema di conservazione e cronologia; Markdown è il formato del documento.
- `docs/courtwatch-continuous-report.md` resta soltanto come copia sincronizzata al momento della migrazione e non deve più essere aggiornato separatamente. Tutte le modifiche future devono essere applicate esclusivamente al report canonico.
- Non viene mantenuto un terzo report Word: evitato per prevenire divergenze manuali. Un eventuale `.docx` potrà essere generato solo come esportazione temporanea del Markdown canonico, mai come sorgente autonoma.
- Procedura obbligatoria per ogni intervento futuro: completare la modifica, verificarla, aggiungere al report canonico esito, commit/run, conteggi, impatto e punti aperti, quindi consegnare il risultato all'utente.

## Aggiornamento 31 agosto 2026 — proprietà concorrente dello stato ITF T−1

- Controllo richiesto dopo i primi cicli della coda: run T−1 `33397334573` verde, 23 tornei dovuti, 2 controllati, zero challenge Incapsula, ma ancora San Miguel de Tucumán e Frederiksberg. Entrambi hanno qualificazioni pubblicate e tabelloni principali ancora vuoti, quindi la decisione `pending` è corretta.
- Individuata una regressione di persistenza: il workflow acceptance ITF, partito da un checkout precedente, pubblicava successivamente l'intero `history/itf_draw_target_db.json` e riportava indietro i `checkedAt` della coda T−1. Simmetricamente, T−1 poteva sovrascrivere target acceptance aggiornati. Nessun dato FITP o Europe era coinvolto.
- Creato merge esplicito di proprietà `src/v3/merge-itf-draw-target-ownership.mjs`, commit `89248b1f43b6bb706beff448d1c00439671c9d1c`: acceptance possiede `targets` e conserva i `tournaments` correnti; T−1 possiede `tournaments` e conserva i `targets` correnti.
- Workflow acceptance corretto con commit `5cc4a38aa9544d68e2137c28ea06b7bb3ddd6f36`; workflow T−1 corretto con commit `0a4967ab4f0704d33a1d6a5e656712e99feddab6`.
- Collaudo T−1 `33399933333` avviato. Gate richiesto: verde, controllo di due tornei diversi dai due appena verificati oppure prova equivalente di avanzamento dei `checkedAt`, conservazione dei target acceptance e nessuna challenge interpretata come assenza.
- Collaudo `33399933333` certificato verde: la coda è avanzata da San Miguel de Tucumán/Frederiksberg a J30 Ambato/J30 Augsburg; merge di proprietà verde con 5 target acceptance e 55 stati torneo conservati. I due nuovi tornei restano pending per challenge Incapsula (`challengeTournaments=2`), senza conferme o rimozioni artificiali. La regressione di rotazione è risolta; la disponibilità dei tabelloni ufficiali continua a essere verificata nei cicli successivi.


## Aggiornamento 1 settembre 2026 — acquisizione esaustiva e persistente dei tabelloni ITF T−1

- Regola operativa confermata: quando un torneo entra nella finestra T−1, il motore interroga prima `GetEventFilters` e usa tutte le combinazioni restituite da ITF come insieme completo dei tabelloni da controllare. Nessuna combinazione può essere saltata o deduplicata impropriamente.
- Prima di modificare il motore operativo è stato eseguito un collaudo read-only sul ramo `test/itf-t1-exhaustive-sections`, senza scritture su R2, database, mappa o `main`. Run `33454447673` verde su `J-J60-LAT-2026-004`: 8 tabelloni dichiarati, 8 richiesti, 8 unici, zero mancanti e zero duplicati; 2 acquisiti e preservati, 6 correttamente classificati `incomplete_not_published`.
- Aggiunto `src/v3/build-itf-t1-section-matrix.mjs`, commit `6577b291cfb3ee37fff89f9a935e618f3226b6ce`: seleziona il torneo pending meno recente, acquisisce l’elenco corrente completo dei tabelloni, esclude soltanto le sezioni già salvate e costruisce una matrice con un job indipendente per ciascun tabellone mancante.
- `verify-itf-t-minus-one-all-players.mjs` ora riceve torneo, chiave esatta del tabellone e inventario completo del ciclo. Un torneo può diventare `complete` soltanto quando ogni combinazione restituita da ITF risulta acquisita; una sezione vuota, incompleta, illeggibile o soggetta a Incapsula resta pending. Commit `e20a02e81f172b3cb207c4893710dead9460b673`.
- Il merge conserva cumulativamente `eventCache` e inventario: un errore o una challenge su un tabellone non può cancellare, sostituire o degradare quelli già acquisiti. La decisione viene ricalcolata sul numero esatto di sezioni dichiarate, acquisite e mancanti. Commit `f288bbc2dcc6a8e73482246478858d621b5b22a1`.
- Il workflow T−1 usa una matrice dinamica, un runner isolato per ogni sezione mancante, artifact caricati anche in caso di errore e `cancel-in-progress: false`, impedendo che il ciclo successivo interrompa una raccolta prima del merge. Commit `970983bf6a79582cff026985ed61cf66216f9a7a`.
- Primo collaudo operativo: run `33454644777` verde su `J-J30-AUS-2026-004`. ITF ha dichiarato 7 tabelloni e il workflow ha avviato esattamente 7 job distinti; tutti gli artifact sono stati raccolti e validati. Il merge ha riutilizzato 7 sezioni già disponibili nei singoli snapshot, salvato 1 nuova sezione e pubblicato lo stato validato nel commit automatico `52bb6b80`.
- Dopo il ciclo, i tornei completi restano 18 e i pending complessivi 38; i pending tecnici sono scesi da 26 a 20, mentre 18 risultano ora correttamente classificati come pubblicazione ufficiale incompleta. Nessuna assenza è stata dedotta da sezioni mancanti o illeggibili e le 4 entry ITF visibili sono rimaste invariate.
- I cicli successivi continuano ogni cinque minuti: sezioni acquisite escluse dalle richieste successive; sezioni non pubblicate, incomplete, in errore o Incapsula ritentate su nuovi runner finché diventano leggibili. Storico ITF e acceptance list non sono stati modificati.


## Aggiornamento 1 settembre 2026 — audit dei pending ITF già conclusi

- L’audit incrociato tra `history/itf_draw_target_db.json` e il catalogo globale ha rilevato 17 tornei pending con data finale già trascorsa: 16 in stato tecnico e 1 con tabelloni mancanti/incompleti. Tutti hanno zero sezioni salvate nello stato T−1 corrente.
- I 16 pending tecnici conclusi sono: J30 Male, J30 Nuevo Leon, J30 Skopje, J30 Panama, J30 Cluj Napoca, J30 Dushanbe, J300 College Park, J60 São Paulo, J60 Vina del Mar, J60 Shenzhen, J60 Hyderabad, J60 Macau, J60 Singapore, J60 Kreuzlingen, J100 Barcelona e J60 Megrine.
- J60 Tacarigua è concluso ed è classificato come pubblicazione mancante/incompleta, senza errore tecnico esplicito e senza tabelloni salvati.
- Causa strutturale verificata: la selezione automatica corrente richiede `endDate >= TODAY`; un torneo ancora pending esce quindi dalla coda dopo la data finale. Il retry automatico non garantisce ancora la convergenza a zero e questi 17 tornei non vengono recuperati dal ciclo live ordinario.
- Correzione necessaria e non ancora applicata: distinguere permanentemente `technical_error`, `officially_missing_or_incomplete`, `acquired` e `complete`; mantenere in una coda di recupero anche i tornei conclusi finché ogni tabellone è acquisito oppure esiste una classificazione terminale ufficiale documentata. Nessun pending concluso deve essere eliminato soltanto per decorrenza della data.
