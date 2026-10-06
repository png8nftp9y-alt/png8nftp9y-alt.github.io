Warning: truncated output (original token count: 60300)
Total output lines: 1388

Warning: truncated output (original token count: 65010)
Total output lines: 1480

# Court Watch v3 — report completo di progetto e passaggio di consegne

Revisione documento: **2026-09-13.146**

- 13 settembre 2026 — Audit diretto del costo scritture D1 del 12 settembre. Cloudflare Analytics certifica 3.673.647 righe scritte e 5.100 query di scrittura sul solo database courtwatch-app, equivalenti a circa $3,67 al tasso di eccedenza di $1 per milione, arrotondabili a circa $4 nel pannello. Quattro run applicativi identificati (34692688427, 34693208969, 34694755038 e 34695209250) hanno eseguito D1_SKIP_OBSERVED=0 e scritto rispettivamente 604.753, 604.783, 604.753 e 604.753 righe: 2.419.042 complessive, il 65,85% della giornata. Query Insights attribuisce inoltre 553.964 scritture alla ricreazione ripetuta di quattro indici; le due cause spiegano direttamente 2.973.006 righe, l'80,93%. Le restanti 700.641 derivano dalla cascata di import incrementali, aggiornamenti dispositivi/analisi e operazioni minori non integralmente attribuite da Query Insights. GitHub ha registrato 2.996 workflow e 1.273 commit nella giornata, confermando una tempesta automatica, non normale traffico dell'app. I controlli read-only 34763823151 e 34763823172 sono verdi. Il 13 settembre alle 14:50 UTC il consumo parziale è 343.484 scritture; la regressione dei rebuild completi è contenuta, ma i cicli automatici restano da ridurre.

- 13 settembre 2026 — Abilitato l'avvio manuale del workflow read-only `Court Watch D1 cost audit`, che usa `wrangler d1 insights` per attribuire le righe lette e scritte alle query SQL aggregate degli ultimi 31 giorni. Il testo SQL viene sanificato prima della stampa. Il push del solo workflow avvia una verifica; nessuna query applicativa, scrittura D1 o modifica dell'app.

- 13 settembre 2026 — Esteso l'audit Cloudflare D1 autenticato, in sola lettura, per conservare la dimensione `databaseId` restituita da GraphQL Analytics, risolverla nel nome tramite l'API D1 e pubblicare totali e serie giornaliere per ciascun database. Il costo teorico ai tassi di eccedenza viene mostrato senza attribuire artificialmente a un database le quote mensili condivise. Nessuna query SQL, scrittura D1, modifica applicativa o variazione di frequenza.

- 13 settembre 2026 — Aggiunta una riga separatrice leggera tra partite consecutive nella pagina giocatore, mantenendo assenti bordi e ombre attorno al torneo e alle singole partite. La separazione usa esclusivamente un bordo superiore grigio chiaro dalla seconda partita in poi, con spaziatura verticale dedicata. Cache asset aggiornata a `2026091307`. Validazione: regola limitata alle sole righe partita adiacenti.

- 13 settembre 2026 — Rifinito il contrasto della pagina giocatore su feedback del proprietario: rimossi bordo scuro e qualsiasi ombra da contenitore torneo e righe partita; la gerarchia resta affidata a fondo grigio dell'intestazione, fondo bianco delle partite e maggiore spaziatura. Cache asset aggiornata a `2026091306`. Audit anagrafico per i futuri filtri Calendario: i 23 record correnti non espongono data/anno di nascita, categoria o sesso, quindi non è stata introdotta alcuna deduzione dai nomi; servono campi espliciti `category` (U10/U12/U14/U16/U18/O18) e `gender` (M/F). Verifica sparizione: Virginia Cereghini è presente nell'anagrafica pubblicata e in 17 relazioni torneo/agenda; Arginelli non compare nell'anagrafica monitorata né nei dati pubblicati, quindi il suo caso non può essere certificato come risolto. Validazione: sostituzione univoca CSS e verifica copertura campi anagrafici.

- 13 settembre 2026 — Rifinita la pagina giocatore: i tornei programmati mostrano soltanto il badge rosso `PROGRAMMATO`, senza freccia né apertura delle partite. Dalla data di inizio lo stato passa automaticamente a `ongoing`, il badge sparisce, ricompaiono statistiche e controllo di apertura e l'intestazione usa il giallo; il giorno corrente è ora parte della firma di rendering per aggiornare la transizione anche senza variazioni dei dati. Le statistiche di ogni torneo vengono ricalcolate sulle righe visibili dopo circuito, tipo, anno ed esito: `Tutte` mostra giocate/vinte/perse, `Vinte` solo vinte, `Perse` solo perse. Aumentato il contrasto fra intestazione torneo e righe partita con fondi, bordi e separatori più netti. Cache asset aggiornata a `2026091305`. Validazione: parsing JavaScript e nuove asserzioni nello scudo funzionale. Limite residuo: pubblicazione subordinata ai workflow avviati dal commit, non monitorati automaticamente.

- 13 settembre 2026 — Corretto il compromesso errato della precedente riparazione OOP: l'etichetta evento nella colonna sinistra (GD14, GS14, ecc.) torna a essere un link al tabellone. Per evitare collegamenti HTML annidati, la colonna mantiene la stessa disposizione visiva ma usa link fratelli: il turno e i dettagli di programmazione puntano all'OOP, l'etichetta evento punta al tabellone. Aggiornati scudo funzionale e cache asset a `2026091304`. Stato Pages osservato prima della modifica: diversi run cancellati automaticamente da commit successivi e ultimo run `34759528369` pending; nessun monitoraggio successivo. Validazione: parsing JavaScript e asserzioni strutturali sui due collegamenti distinti.

- 13 settembre 2026 — Ripristinato il collegamento OOP nell'agenda dopo la regressione del commit `7caaec2`: la sigla evento (GD14, GS14, ecc.) era stata resa come link al tabellone dentro il link OOP della colonna sinistra, producendo HTML con collegamenti annidati e inducendo il browser a spezzare il link esterno. La disposizione precedente dell'agenda resta invariata; nella colonna sinistra turno e sigla evento sono ora etichette adiacenti non interattive, mentre l'intera colonna mantiene il link OOP. Aggiunte verifiche automatiche contro la ricomparsa di link annidati; cache asset aggiornata a `2026091303`. Validazione: parsing JavaScript e controlli sorgente dello scudo funzionale. Limite residuo: pubblicazione subordinata al workflow Pages, non monitorato automaticamente su richiesta del proprietario.

- 13 settembre 2026 — Riparato il release guard del deploy Pages dopo il run rosso `34759113622`: lo scudo funzionale richiedeva ancora `#profileTournamentStatusFilter`, nonostante la tendina stato fosse stata rimossa intenzionalmente. L'asserzione ora verifica che la tendina sia assente. Evidenza del run: sintassi e dati agenda superati; unico errore `filtro stato tornei`; i passaggi Pages erano stati saltati. Validazione: sostituzione univoca dell'asserzione e coerenza con il requisito UI. Limite residuo: il nuovo workflow deve completare la pubblicazione; non viene monitorato automaticamente su richiesta del proprietario.

- 13 settembre 2026 — Correzione UI agenda/profilo: le etichette evento (GS14, BS14, GD14, ecc.) sono ora nello stesso gruppo visivo e immediatamente accanto all'etichetta del turno; non sono più accodate al nome del giocatore. Nei tornei futuri della pagina giocatore, lo stato `scheduled` calcolato dal filtro definitivo sostituisce sempre le statistiche giocate/vinte/perse con l'etichetta rossa `PROGRAMMATO`. Aggiornato il cache-buster degli asset a `2026091302`. Validazione: sostituzioni univoche, parsing JavaScript e controllo dei riferimenti HTML/CSS. Limite residuo: la visibilità pubblica dipende dal completamento del workflow GitHub Pages avviato dal commit; il workflow non viene monitorato automaticamente su richiesta del proprietario.

- 4 settembre 2026 — Corretto il rosso residuo del run Europe D1 `33896843868`. Tutti i passaggi Europe erano riusciti, inclusi import, parità D1, deploy Worker e validazione dell'agenda; l'ultimo script diventava rosso per quattro tornei FITP presenti nel JSON ma non ancora replicati dal workflow FITP. La modalità di verifica non dipende più erroneamente da `TE_INCREMENTAL`: il workflow Europe passa ora `VERIFY_SCOPE=tennis-europe` sia nei rebuild completi sia nei live incrementali e controlla soltanto API/OOP/agenda Europe. Il confronto universale di giocatori e tornei resta attivo nel workflow universale, senza nascondere discrepanze FITP o ITF.\n\n- 4 settembre 2026 — Estesa la pagina giocatore con filtri combinabili e riepiloghi per torneo. Restano disponibili i circuiti `Tutti/FITP/Tennis Europe/ITF`; una seconda tendina seleziona `Singolo e doppio/Singolo/Doppio`; i riquadri generali `Tutte/Vinte/Perse` sono pulsanti di filtro con stato attivo evidente. Conteggi e numero di tornei visibili si riallineano alla selezione. Ogni torneo mostra inoltre statistiche informative non cliccabili `giocate/vinte/perse`; le righe delle partite sono inizialmente compresse e si aprono o richiudono tramite una freccia accessibile. Layout mobile e cache-buster aggiornati.\n\n- 4 settembre 2026 — Corretto il rosso finale del rebuild D1 Europe `33895506157`. Import e vincoli referenziali erano riusciti; la parità attendeva 49.173 match ma D1 ne conteneva correttamente 49.174, perché il manifest OOP non include nel proprio conteggio il match padre manuale di Grimoldi. Il generatore espone ora `manualParentMatches` come conteggio esplicito e il verificatore somma esclusivamente tali genitori manuali al totale OOP atteso. Nessun confronto è stato allentato: la parità resta esatta per rebuild completi.\n\n- 4 settembre 2026 — Corretto il fallimento D1 Europe `33869145153` nello step `04-app-match-candidates.sql`. Il record manuale della finale Bonus Draw di Edoardo Grimoldi era presente tra i candidati dell'app ma mancava nella tabella padre `matches`, quindi la chiave esterna lo respingeva; i retry non potevano risolvere un errore deterministico. Il generatore inserisce ora con `INSERT OR IGNORE` il match padre manuale prima della relazione, soltanto dopo aver verificato che il torneo ufficiale Kufstein esista nell'archivio. La chiave esterna resta attiva e continua a bloccare riferimenti realmente orfani. Il push del generatore avvia un rebuild D1 completo.\n\n- 4 settembre 2026 — Aggiunto nella pagina giocatore il filtro a tendina `Tutte le partite`, `FITP`, `Tennis Europe`, `ITF`. La selezione nasconde immediatamente i tornei degli altri circuiti, aggiorna il numero di tornei visibili e ricalcola le statistiche giocate/vinte/perse sul solo circuito scelto; aprendo un altro giocatore il filtro riparte da `Tutte le partite`. Layout adattato anche agli schermi mobili e cache-buster aggiornato.\n\n- 4 settembre 2026 — Corretto il rosso del rebuild Europe D1 `33868356003`. Il run aveva ripristinato correttamente da R2 le generazioni storica e live, ma `restore-tennis-europe-oop.sh` conservava una terza duplicazione dei confronti esatti `453 tornei` e `47.048 partite`; sostituiti con le stesse baseline minime monotone e configurabili già applicate a merge e pubblicazione R2. Una ricerca completa non trova ulteriori confronti rigidi residui. I push di manutenzione e i merge storici eseguono ora una ricostruzione completa (`TE_INCREMENTAL=0`), mentre i normali workflow live restano incrementali: i campi storici `notBefore` e `court` raggiungono quindi D1 senza aumentare il lavoro dei cicli ordinari.\n\n- 4 settembre 2026 — Aggiunta nella pagina giocatore una sezione statistica automatica con partite giocate, vinte e perse. Il conteggio comprende soltanto match con esito certo (`advances=true/false`), quindi singolari, doppi e W/O conclusi; incontri programmati o in corso non vengono classificati prematuramente come sconfitte. Le statistiche derivano dalla raccolta generale delle partite e si aggiornano automaticamente quando i motori pubblicano nuovi risultati. Aggiornato il cache-buster del client.\n\n- 4 settembre 2026 — Individuata la mancata propagazione di campo e `N.B.` nell'app. L'artefatto reale del collaudo `33828515398` mostra `notBeforeParsed=511` e, per Virginia Cereghini a Bad Waltersdorf, `time=10:30`, `notBefore=true`, ma campo ancora concatenato come `FÜRSTENFELD1 Sportaktivpark Bad Waltersdorf/Fürstenfeld`. L'estrazione ora conserva esclusivamente il primo valore strutturato `nav-link__value`, ottenendo esattamente `FÜRSTENFELD1`. Riparato inoltre il workflow di merge storico: `required` e `default` erano fuori dal livello YAML di `source_run_id`, facendo fallire la validazione prima della creazione dei job; rimosso anche il trigger push inutile. La catena definitiva resta backfill verde → merge storico con ID del run appena concluso → rebuild D1 completo.

- 4 settembre 2026 — Su conferma dell'utente, tutti i run della seconda correzione campo/`notBefore` sono verdi. Rifinita l'agenda: l'ordine a destra del nome torneo è ora `Tennis Europe`, categoria e turno. I turni di qualificazione non usano più la dimensione residua (`SQ32`, `SQ16`): per ciascun torneo/evento le dimensioni ufficiali vengono ordinate dalla maggiore alla minore e trasformate nella sequenza `SQ1`, `SQ2`, ecc. Nella pagina giocatore la testata di ogni torneo riporta ora anche il nome del circolo prima di città e date.

- 4 settembre 2026 — Il collaudo reale `33828342128` ha correttamente respinto la prima correzione di campo/ora: 65 match Bad Waltersdorf letti, ma `badWaltersdorfCourtVerified=false` e `notBeforeParsed=0`. L'artefatto ha individuato tre cause esatte: l'intera intestazione veniva usata come campo (`F&#220;RSTENFELD1 Sportaktivpark…`), le entità numeriche HTML non erano decodificate e l'ora vuota diventava `00000` per effetto di `padStart`; inoltre `Not before` risiede nel blocco temporale precedente, non nel sottoblocco del campo. I tre parser ora decodificano le entità, estraggono esclusivamente `nav-link__value` come campo, leggono l'ora con datetime completo dal contesto temporale, non trasformano il vuoto e cercano lì il qualificatore `Not before`. Il gate semantico su `FÜRSTENFELD1` e su almeno un `notBefore` resta bloccante.

- 4 settembre 2026 — Agenda Tennis Europe ulteriormente riallineata: località sopra, nome torneo sotto, seguito a destra dalle etichette del codice evento (`BS12`, `GS14`, `BD16`, ecc.), turno normalizzato (`SQ1`, `SQ2`, `R64`, `R32`, `R16`, `QF`, `SF`, `F`; per il bonus draw `BONUS` più turno) e infine etichetta `Tennis Europe`. Anche `vs` usa peso normale; giocatore e compagno di doppio restano evidenziati. Il collaudo ufficiale del parser include ora Bad Waltersdorf del 21 febbraio 2026 e diventa rosso se non trova esattamente `FÜRSTENFELD1`; richiede inoltre almeno un vero `notBefore`, impedendo che una prova sintatticamente riuscita nasconda ancora campo o qualificatore errati.

- 4 settembre 2026 — Corretta integralmente la presentazione e l'associazione dei dati nell'agenda Tennis Europe. L'etichetta del circuito precede il nome del torneo; sotto compare città/Paese usando la stessa funzione del calendario e soltanto dopo il nome del giocatore. Campo spostato sopra l'orario. La causa comune di campi errati e qualificatori `Not before` mancanti era il parser, che cercava ora e campo in una finestra generica precedente al match: ora ogni partita eredita esclusivamente la propria intestazione ufficiale di programmazione e ne ricava insieme campo, ora e `notBefore`. Test sintetico certificato: `FÜRSTENFELD1`, `11:00`, `notBefore=true`. Aggiornati parser live, backfill e prova. Il backfill storico ora attiva automaticamente il merge certificato con il proprio run ID; il merge storico riuscito attiva una ricostruzione completa D1, mentre i cicli live restano incrementali. In questo modo la correzione raggiunge anche le partite storiche e non soltanto quelle future.

- 4 settembre 2026 — Agenda: nelle schede Tennis Europe l'etichetta del circuito è stata spostata accanto al nome del torneo. Il nome dell'avversario usa ora peso normale, mentre il nome dell'eventuale compagno di doppio resta in grassetto insieme al giocatore monitorato. Aggiornati gli identificatori di cache JS/CSS. L'utente ha confermato verde il run Europe precedente.

- 4 settembre 2026 — Agenda: rimossa anche l'etichetta `Doppio`; le schede non mostrano più alcuna etichetta della specialità. Confermato dall'utente verde il run Tennis Europe `33826131310`. Aggiornato il cache-buster senza ulteriori controlli o polling.

- 4 settembre 2026 — Agenda: il nome del torneo precede ora il nome del giocatore in ogni scheda match. Rimossa l'etichetta `Singolare` (l'etichetta `Doppio` resta informativa) e rimossa l'etichetta `Terminata` dalle partite con risultato; dati, navigazione e stato del match restano invariati. Aggiornato il cache-buster del client.

- 4 settembre 2026 — Corretto il falso rosso finale di Tennis Europe emerso nel run `33825816667`: tutte le 16 shard avevano concluso con zero errori, ma la diagnostica rendeva fatale anche lo stato previsto di due tabelloni non ancora pubblicati per tornei con inizio il 5 settembre (Anna Gambarini a Bari e Virginia Cereghini a Palermo). Il gate distingue ora i tabelloni ufficiali ancora in attesa dagli errori tecnici: timeout, eccezioni e HTTP 5xx restano bloccanti; un tabellone non pubblicato conserva l'iscrizione senza produrre un falso errore di sistema. Nessun polling e nessuna frequenza aumentata.

- 4 settembre 2026 — Risolto il residuo rosso del run `33825624625`: la sessione e le liste Tennis Europe erano operative, ma una singola GET della Piestany Cup U14 aveva superato il timeout di 12 secondi. Le sole GET scadute vengono ora ripetute una volta dopo 250 ms; le richieste riuscite non vengono duplicate e un secondo fallimento resta bloccante. Nessun polling o aumento della frequenza dei workflow.

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
| 24 agosto 2026 | Corretto il percorso di controllo Tennis Europe per Darko. Il primo esito negativo derivava dal fatto che `discover-tennis-europe-acceptance-shard.mjs` filtra a monte i giocatori configurati con circuito `Tennis Europe`: Darko era allora presente soltanto come FITP, quindi non poteva produrre entry TE. Inoltre era stata consultata la …332 tokens truncated…ultati Europe; soltanto dopo il suo verde D1 generale consolida gli ultimi snapshot disponibili di FITP, Tennis Europe e ITF.
- Resta vietata l’interruzione di una scrittura generale già iniziata: in quel solo caso Europe attende il tempo residuo, evitando una generazione D1 parziale. Nei cicli ordinari successivi Europe acquisisce il lock prima del generale.
- La frequenza dei sei motori e dell’OOP resta ogni 15 minuti. Le richieste D1 generali duplicate vengono eliminate, riducendo coda e consumo GitHub Actions; watchdog, avvio manuale e trigger push di manutenzione restano disponibili.

### 2026-09-07 — Complete Europe relative schedule agenda rules (`1b3b5750`)

## Revisione 2026-09-07.219 — completamento tempi relativi e larghezza condizionale Agenda Europe
- `Dopo riposo` compare immediatamente sotto il nome del campo. Quando è solo nasconde il numero match; quando il sotto-header contiene anche `Not before`, prevalgono esclusivamente `N.B.` e orario e il numero match resta visibile.
- La proiezione D1 ricostruisce `relativeMatchNumber` e `relativeFromTime` sull’intero OOP dello stesso torneo, giorno e campo prima di filtrare i giocatori CourtWatch. Anche i record storici già acquisiti con `Followed by` ricevono quindi la forma `A seguire` e il dettaglio, per esempio `(3° match dalle 9:00)`.
- Corretto anche il ciclo per campo del parser storico, che terminava dopo il primo campo e lasciava incompleti i tempi relativi degli altri campi.
- I nomi campo privi di prefisso ufficiale `Campo`, `Court`, `C` o `CC` vengono presentati con `Court` anteposto; il dato sorgente conservato in R2 e D1 non viene alterato.
- Ripristinata la larghezza precedente della colonna sinistra per i campi normali. L’allargamento e lo spostamento della colonna destra si applicano soltanto ai nomi campo lunghi.
- Cache CSS/JavaScript aggiornate a `2026090714`/`2026090717`. Schedulazioni, schema D1, R2 e motori FITP/ITF non sono modificati.

### 2026-09-08 — Speed up CourtWatch initial agenda loading (`2d4f6e56`)

## Revisione 2026-09-08.220 — caricamento iniziale Agenda accelerato
- Individuata nel client la causa del ritardo percepito: le dieci letture JSON venivano attese integralmente prima di avviare la richiesta alla proiezione D1, sommando i due tempi di rete. La misurazione browser mostrava guscio HTML in circa 0,2 secondi e contenuto Agenda dopo circa 2,7 secondi.
- Le letture JSON e D1 partono ora contemporaneamente. L’unione e tutti i controlli di freschezza restano invariati; cambia soltanto l’ordine asincrono delle richieste.
- Se esiste una copia locale valida, viene renderizzata immediatamente durante l’aggiornamento e sostituita dalla nuova generazione appena verificata. Al primo accesso senza cache resta il caricamento di rete parallelo.
- Cache JavaScript aggiornata a `2026090801`. Motori, dati, R2, D1, schedulazioni e regole Agenda non sono modificati.

### 2026-09-08 — Stabilize accelerated CourtWatch loading (`22da6742`)

## Revisione 2026-09-08.221 — caricamento parallelo senza rendering instabile
- Il primo tentativo di mostrare la cache prima del completamento del refresh rendeva l’interfaccia interattiva mentre il DOM veniva subito ricostruito. Lo Scudo ha bloccato il deploy con un timeout su un comando torneo; l’utente ha inoltre osservato Agenda vuota durante quella finestra.
- Rimosso esclusivamente il rendering anticipato della cache. La copia locale resta disponibile come fallback in caso di errore, secondo il comportamento stabile precedente.
- Conservata l’ottimizzazione sicura: JSON e proiezione D1 vengono richiesti contemporaneamente anziché in sequenza. L’Agenda viene renderizzata una sola volta con una generazione coerente.
- Cache JavaScript aggiornata a `2026090802`. Motori, dati, R2, D1 e schedulazioni restano invariati.

### 2026-09-08 — Remove legacy ITF D-2 rule and stabilize Shield (`69fd1320`)

## Revisione 222 — 2026-09-08 — rimozione definitiva ITF D−2 e stabilizzazione Scudo
- Rimossa dai quattro record storici ITF la regola obsoleta `official_start_minus_2_days`: la data iniziale coincide ora con `officialStartDate` e non viene più sottratto alcun giorno.
- Normalizzato anche `history/itf_player_tournament_db.json` e il dataset pubblicato `dist/v3/tournament_entries.json` (4 relazioni corrette), così la vecchia regola non può riapparire da copie derivate.
- Il costruttore universale D1 ora, per ITF, usa nell'ordine `qualificationStartDate`, `officialStartDate`, `startDate`; questo impedisce la reintroduzione di date D−2 legacy.
- Corretto lo Scudo E2E: la proiezione D1 esterna viene isolata con una risposta controllata durante il test; un errore temporaneo del Worker non produce più un falso rosso del deploy, mentre restano attivi tutti i controlli funzionali su UI, Agenda, profili e CRUD.
- Caricamento app: JSON e proiezione D1 restano richiesti in parallelo. In apertura l'app usa i dati correnti; se una sorgente fallisce usa l'ultima copia locale disponibile. La dicitura di aggiornamento resta nascosta quando i dati sono freschi e appare soltanto in fallback o oltre la soglia di ritardo.

### 2026-09-08 — Remove ITF D-2 from from generator and published data (`cbdd17d1`)

## Revisione 223 — 2026-09-08 — eliminazione D−2 nel generatore effettivo
- Individuata la causa residua: `src/v3/entries-engine.mjs`, nella funzione `toTournament`, applicava ancora esplicitamente `addDaysIso(officialStartDate,-2)` a ogni torneo ITF. Questa era la regola realmente usata per rigenerare `dist/v3/tournaments.json` dopo ogni workflow.
- Eliminata la sottrazione: per ITF la data pubblicata è ora la data ufficiale disponibile, senza D−2.
- `maintain-itf-database.mjs` normalizza inoltre ogni relazione ITF letta dallo storico/R2, elimina `startDateRule` e `tMinusOneApplied` legacy e impedisce che una copia remota vecchia li reintroduca.
- Corretti immediatamente 4 record nel calendario pubblicato, 4 nel D1 universale e 4 relazioni nel database ITF.

### 2026-09-08 — Use ITF factsheet qualifying start dates (`8b8d6c09`)

## Revisione 224 — 2026-09-08 — ripristino vincolante data qualificazioni ITF da factsheet
- Corretto l'errore della revisione 223: la data ITF visibile non deve coincidere forzatamente con il main draw. La priorità vincolante è `qualificationStartDate` letta dalla riga `First day of Singles Qualifying` del factsheet; soltanto quando assente si usa `startDate`/data ufficiale disponibile.
- `entries-engine.mjs` conserva ora esplicitamente `qualificationStartDate` e `officialStartDate` e pubblica il torneo dalla data qualificazioni. Nessuna sottrazione matematica D−2 viene eseguita.
- Il mantenitore del database converte i vecchi record etichettati `official_start_minus_2_days` nel campo semantico `qualificationStartDate`, elimina le due proprietà legacy e preserva la data qualificazioni nei successivi merge da R2.
- Riallineati fonte ITF, storico, database relazionale, entry pubblicate, calendario e D1 universale. Palermo usa il factsheet già verificato: qualificazioni dal 5 settembre 2026, main draw dal 7 settembre 2026.

### 2026-09-08 — Fix ITF R2 certification for qualification dates (`d69fe9fe`)

## Revisione 225 — 2026-09-08 — riparazione pubblicazione ITF R2
- Il run R2 rosso non era un errore del bucket: si fermava in `Validate certified history` prima della configurazione R2.
- Cause: il workflow richiedeva ancora lo stato letterale precedente, imponeva `relationCount==4` nonostante la quinta relazione valida di Palermo e, dopo l'upload, cercava campi `audit` nel database relazionale che non li contiene.
- Ripristinato lo stato canonico dell'archivio storico. Il validatore ora verifica conteggio dinamico coerente con `relations`, almeno quattro relazioni, assenza delle proprietà D−2 legacy e corrispondenza tra `startDate` e `qualificationStartDate` quando quest'ultima è pubblicata.
- Il controllo dopo il download da R2 verifica lo stesso schema relazionale effettivo; nessuna regola factsheet, dato o motore di acquisizione è stato modificato.

### 2026-09-08 — Fix Shield tournament visibility selector (`2d0876e8`)

## Revisione 226 — 2026-09-08 — eliminazione falso positivo Scudo su torneo nascosto
- Il deploy rosso `34222713383` non indicava un errore applicativo: nove controlli E2E, compreso CRUD, erano già superati; il test si fermava tentando di cliccare il primo `[data-open-tournament]` presente nel DOM, che nella vista corrente era nascosto.
- Corretto lo Scudo selezionando esclusivamente `[data-open-tournament]:visible`. Restano invariati timeout, verifiche funzionali e capacità di bloccare regressioni reali.
- Nessuna modifica a motori, factsheet ITF, dati, R2, D1 o schedulazioni.

### 2026-09-08 — Deduplicate shared doubles and enrich after-rest agenda (`cb1413e7`)

## Revisione 227 — 2026-09-08 — doppi condivisi e dettaglio Dopo riposo
- Agenda: quando due giocatori monitorati sono compagni nello stesso doppio, le due proiezioni personali vengono riconosciute dalla stessa coppia, torneo, data e identità OOP e mostrate in un solo riquadro. I singolari e i doppi con squadre diverse restano separati.
- Per una voce `Dopo riposo` priva di N.B., sotto l'etichetta viene mostrato `x° match dalle HH:MM` usando `relativeMatchNumber` e `relativeFromTime`, già calcolati sull'intero OOP dello stesso campo.
- Eccezione richiesta: il dettaglio non viene mostrato quando la posizione è il 2° match. Restano invariati la soppressione del numero match ordinario e il comportamento N.B.
- Aggiornata la versione cache di CSS e JavaScript. Motori, database, R2, D1 e schedulazioni invariati.

### 2026-09-08 — Fix Matilde Mambrini display capitalization (`2dc39f28`)

## Revisione 228 — 2026-09-08 — correzione grafica Matilde Mambrini
- Correzione esclusivamente di presentazione: la grafia sorgente `matilde Mambrini` viene mostrata come `Matilde Mambrini`.
- Il dato originale resta invariato; nessuna modifica a OOP Europe, D1, R2, motori, associazioni, risultati o schedulazioni.
- Aggiornata la versione cache JavaScript.

### 2026-09-08 — Add full-court OOP context and highlight ongoing tournaments (`be551ce5`)

## Revisione 229 — 2026-09-08 — sequenza completa campo e tornei in corso
- OOP Europe: ogni match conserva ora `overallMatchNumber` e `overallFromTime`, calcolati sull'intera sequenza dello stesso torneo, giorno e campo; il conteggio non dipende dai soli giocatori CourtWatch.
- `Dopo riposo`: usa la posizione complessiva e l'orario del primo match programmato sul campo. Mostra `x° match dalle HH:MM` soltanto oltre il 2° match, come richiesto. Questo copre il doppio Puccio del 20 luglio senza correzioni manuali.
- `A seguire`: conserva il conteggio relativo già mostrato. Se la posizione complessiva differisce, aggiunge nella stessa parentesi `, x° match complessivo dalle HH:MM`; il caso Gelli del 20 luglio diventa quindi `(2° match dalle 10:30, 4° match complessivo dalle 8:30)`.
- Pagina giocatore: l'intera sezione di un torneo con stato `ongoing` è evidenziata con giallo tenue anche nella vista `Tutti i tornei`.
- Aggiornati cache-buster CSS/JS. Nessuna modifica a risultati, identità o frequenze di schedulazione.

### 2026-09-08 — Refine agenda colors, wrapping and ongoing tournament styling (`802e108d`)

## Revisione 230 — 2026-09-08 — rifiniture Agenda, tornei in corso e bandiere
- Colonna sinistra Agenda: campo, Dopo riposo, numero/dettaglio match e orario usano ora uniformemente il blu già adottato; l'etichetta turno conserva il proprio stile circuito.
- I dettagli lunghi (`x° match dalle...` e conteggio complessivo) possono andare a capo entro la larghezza della colonna sinistra e non invadono la colonna dei giocatori.
- Evidenziazione torneo in corso confermata dinamica e inclusiva: è gialla quando `startDate <= oggi <= endDate`; dopo `endDate` torna bianca al successivo rendering/aggiornamento. Tra due tornei in corso consecutivi il separatore è bianco.
- Bordo bandiere attenuato da opacità 0,18 a 0,08, mantenendo la separazione necessaria per le bandiere con margini bianchi.
- Aggiornato il cache-buster CSS. Nessuna modifica a dati, motori, D1, R2 o schedulazioni.

### 2026-09-08 — Wrap overall match detail after comma (`1155139e`)

## Revisione 231 — 2026-09-08 — a capo conteggio complessivo
- Nell'etichetta `A seguire`, quando sono presenti conteggio relativo e complessivo, il conteggio complessivo inizia obbligatoriamente su una nuova riga dopo la virgola.
- Esempio: prima riga `2° match dalle 11:00,`; seconda riga `4° match complessivo dalle 09:00`.
- Modifica esclusivamente grafica; calcoli OOP, dati, D1, R2, motori e schedulazioni invariati.

### 2026-09-08 — Refine agenda label sizing and flag borders (`6ebe6565`)

## Revisione 232 — 2026-09-08 — dimensione etichette Agenda e bordo bandiere
- `Dopo riposo` e `A seguire` hanno ora la stessa dimensione tipografica del nome del campo: 16 px desktop e 14 px mobile. I dettagli subordinati del conteggio restano più piccoli.
- Le bandiere usano un bordo nero hairline da 0,5 px. La modifica è solo CSS e può essere ripristinata senza intervenire sui dati.
- Aggiornato il cache-buster CSS. Nessuna modifica a OOP, D1, R2, motori o schedulazioni.

### 2026-09-08 — Document restored subtle flag border (`8023b5c0`)

## Revisione 233 — 2026-09-08 — ripristino bordo attenuato bandiere
- Rimosso il bordo nero hairline da 0,5 px introdotto nella revisione 232, perché non approvato nella verifica visiva.
- Ripristinato il bordo precedente da 1 px con opacità 0,08: resta appena percepibile sulle bandiere con margini bianchi senza creare un contorno nero evidente.
- Conservate senza modifiche la dimensione di `Dopo riposo` e `A seguire`, l'a capo dei dettagli e tutte le altre regole Agenda.
- Aggiornato il cache-buster CSS a `2026090820`. Nessuna modifica a OOP, D1, R2, motori o schedulazioni.

### 2026-09-08 — Document flicker-free refresh (`2d4503f3`)

## Revisione 234 — 2026-09-08 — aggiornamento senza sfarfallio
- Individuata la causa dello sfarfallio periodico: il controllo dati ogni 30 secondi richiamava sempre il renderer completo e sostituiva con `innerHTML` Agenda, calendario e bandiere anche quando il contenuto visibile non era cambiato.
- Introdotta una firma del contenuto visualizzato. I soli timestamp tecnici di acquisizione vengono ignorati: se giocatori, tornei, match, agenda, risultati, avversari e iscrizioni sono invariati, il DOM principale viene preservato e viene aggiornata soltanto la diagnostica.
- Quando esiste una modifica reale, il rendering completo continua a essere eseguito, conservando la pubblicazione tempestiva dei nuovi dati.
- Le piccole bandiere SVG usano ora caricamento immediato anziché `loading="lazy"`, riducendo il lampo residuo nei rendering realmente necessari.
- Aggiornato il cache-buster JavaScript a `2026090807`. Nessuna modifica alla frequenza di controllo, ai motori, a D1, R2 o alle schedulazioni.

### 2026-09-08 — Document official OOP agenda links (`fc05d6cb`)

## Revisione 235 — 2026-09-08 — collegamento Agenda all’ordine di gioco
- Nell’Agenda, l’intera colonna di programmazione della partita è ora un unico collegamento: nome campo, numero match, orario e le eventuali diciture `A seguire`, `Dopo riposo` e relativi dettagli.
- Il collegamento apre in una nuova scheda l’ordine di gioco ufficiale dello stesso torneo e della stessa giornata. Viene usato il `sourceUrl` certificato del match; per Tennis Europe è disponibile anche la ricostruzione deterministica dell’endpoint `/tournament/{competitionId}/matches/{YYYYMMDD}` quando il campo manca.
- Se un record non possiede ancora un URL ufficiale giornaliero verificabile, la colonna resta testo e non viene creato un collegamento generico o potenzialmente errato.
- Aggiunti stato hover discreto e focus da tastiera senza alterare dimensioni, allineamento o colori della colonna sinistra.
- Aggiornati i cache-buster CSS/JavaScript a `2026090821`/`2026090808`. Nessuna modifica ai motori, a D1, R2 o alle schedulazioni.

### 2026-09-08 — Document back navigation and player hover (`d911be2d`)

## Revisione 236 — 2026-09-08 — navigazione Indietro ed evidenziazione giocatori
- Il comando `← Torna al calendario` nelle viste di dettaglio è stato sostituito da `← Indietro`.
- Il comando usa ora la cronologia di navigazione: dalla pagina torneo o giocatore ritorna alla vista immediatamente precedente, invece di forzare sempre la Home/Calendario. In assenza di una cronologia precedente disponibile resta il fallback alla Home.
- Nella colonna Giocatori, il passaggio del puntatore evidenzia ora l’intera riga con il blu tenue già usato nell’app, ripristinando il comportamento visivo richiesto.
- Aggiornati i cache-buster CSS/JavaScript a `2026090822`/`2026090809`. Nessuna modifica a dati, motori, D1, R2 o schedulazioni.

### 2026-09-08 — Document player row pointer cursor (`f7e0e9b9`)

## Revisione 237 — 2026-09-08 — puntatore manina sulle righe giocatore
- Nella colonna Giocatori, il cursore `pointer` a forma di manina viene ora imposto sull’intera riga e su tutti i suoi elementi interni, inclusi avatar, nome e descrizione.
- La dichiarazione usa priorità vincolante per impedire che sui nodi testuali ricompaia il cursore a forma di I dedicato alla selezione del testo.
- Conservata l’evidenziazione azzurra dell’intera riga al passaggio del puntatore introdotta nella revisione 236.
- Aggiornato il cache-buster CSS a `2026090824`. Nessuna modifica a JavaScript, dati, motori, D1, R2 o schedulazioni.

### 2026-09-09 — Document ITF qualifying dates and agenda chronology (`82a81bd8`)

## Revisione 238 — 2026-09-09 — qualificazioni ITF, apertura Agenda e ordine temporale
- Corretto il punto residuo della data iniziale ITF: la risposta HTML ottenuta durante il bootstrap della sessione veniva consumata e scartata; la seconda richiesta poteva essere bloccata e lasciare vuota `qualificationStartDate`. Il bootstrap restituisce ora il contenuto della prima risposta valida e il lettore factsheet estrae da quella la riga ufficiale `First day of Singles Qualifying`.
- La regola di pubblicazione resta semantica e non matematica: per ITF il calendario usa `qualificationStartDate`; soltanto se il factsheet non pubblica tale campo resta disponibile la data ufficiale del torneo. Il caso pubblico J60 Pescara espone qualificazioni il 26 settembre 2026 e main draw il 28 settembre 2026; il successivo ciclo ITF deve quindi pubblicare il 26 settembre.
- Cliccando un giorno nel calendario, l’Agenda viene impostata sulla data selezionata e la pagina scorre immediatamente alla parte superiore, rendendo visibile l’Agenda invece di lasciare il punto di vista sul calendario.
- L’ordinamento Agenda usa ora un valore temporale anche per `A seguire`. Dall’orario del primo match sul campo somma 90 minuti per ciascuno dei primi due incontri, 105 minuti per terzo e quarto e 120 minuti per ogni incontro successivo.
- Esempio certificato dalla formula: primo match alle 08:00 e giocatore nel quarto match → 08:00 + 90 + 90 + 105 minuti = 12:45. La stima serve esclusivamente all’ordinamento; la dicitura ufficiale `A seguire` resta visualizzata senza inventare un orario ufficiale.
- L’ordine cronologico precede ora la priorità di circuito sia tra le partite sia tra i blocchi torneo. Aggiornato il cache-buster JavaScript a `2026090901`. Nessuna modifica alle frequenze di schedulazione.
- La correzione ITF entra nei dati al primo successivo ciclo live ITF; non è stato introdotto polling né un valore manuale specifico per Pescara.

### 2026-09-09 — Document ITF retry fix and loading diagnosis (`ef9adcaa`)

## Revisione 239 — 2026-09-09 — retry ITF completo e caricamento con cache HTTP
- Chiuso il percorso residuo ITF: anche il retry delle acceptance list leg…300 tokens truncated…indirizzo ufficiale, con sorgente factsheet persistita.
- La protezione contro pagina vuota è attiva, ma un primo accesso senza cache non può essere garantito sempre istantaneo: dipende dalla rete fino al caricamento dei dataset essenziali. Con cache valida il rendering è immediato; senza fonti e senza cache viene mostrato un errore esplicito, non una pagina vuota.
- Cache-buster aggiornati a `v3.js?v=2026091015` e `v3.css?v=2026091006`; sintassi JavaScript verificata. Nessuna modifica a motori, frequenze o schedulazioni.

### 2026-09-10 — docs: record ITF gender selector verification (`32a7c1d8`)

## Revisione 248 — 2026-09-10 — verifica diretta selettore Girls/Boys ITF
- Verificato nel browser il caso pubblico J60 Pescara: la pagina ufficiale Acceptance List si apre su `Boys`; scegliendo `Girls` il contenuto cambia, ma URL, query string, hash, localStorage e sessionStorage restano invariati. Il selettore è esclusivamente stato interno del componente React ITF e non espone un collegamento profondo distinto per sesso.
- Confermato quindi che `entryType=Girls` introdotto nella revisione 247 non è interpretato dal sito ITF. Un normale link esterno non può imporre `Girls` o `Boys` senza supporto del sito sorgente; non vengono introdotti parametri ulteriori non documentati o automazioni fragili sulla pagina ITF.
- Verifica ufficiale Pescara confermata: primo giorno qualificazioni 26 settembre 2026, main draw 28 settembre, sede `CIRCOLO TENNIS PESCARA` e indirizzo `VIA GUGLIELMO MARCONI 355, Pescara, ITALIA, 65126, Italy`.
- Il recupero di data qualificazioni, sede e indirizzo è attivo nei cicli ITF live e known-fast e conserva l'ultimo metadato verificato. La regola è generale anche per i tornei futuri acquisiti dai cicli, ma resta dipendente dalla struttura/protezione del sito ITF: nessuna integrazione esterna può essere garantita immutabile contro futuri cambiamenti del sito sorgente.
- Nessuna modifica ai motori ITF/ITF-1, alle schedulazioni o ai database.

### 2026-09-10 — docs: record Pescara address deduplication (`eb1d2b8d`)

## Revisione 249 — 2026-09-10 — indirizzo Pescara senza località duplicata
- Corretta la composizione del luogo nella pagina torneo: quando ITF fornisce un indirizzo ufficiale completo, città e nazione non vengono più aggiunte nuovamente dai campi separati `location`, `city` e `country`.
- J60 Pescara viene quindi mostrato con circolo e indirizzo ufficiale una sola volta, senza ripetere `Pescara, Italia`.
- La correzione è generale per tutti i tornei dotati di indirizzo completo; se l'indirizzo non è disponibile, restano attivi i campi separati come fallback.
- Cache-buster JavaScript aggiornato a `v3.js?v=2026091016`; sintassi verificata. Nessuna modifica a motori ITF/ITF-1, acquisizione, schedulazioni o database.

### 2026-09-10 — docs: record Pescara country deduplication and schedule check (`2587e816`)

## Revisione 250 — 2026-09-10 — paese duplicato nell'indirizzo ITF Pescara
- Riprodotta nell'app pubblicata la stringa effettiva `CIRCOLO TENNIS PESCARA, VIA GUGLIELMO MARCONI 355, Pescara, ITALIA, 65126, Italy`.
- Individuata la causa residua: `ITALIA` e `Italy` erano già presenti insieme nello stesso campo indirizzo fornito dal factsheet ITF; la revisione 249 eliminava soltanto i campi città/nazione aggiunti separatamente dall'app.
- La presentazione dell'indirizzo rimuove ora il suffisso inglese `Italy` quando il medesimo indirizzo contiene già `Italia`. Pescara viene mostrato come `CIRCOLO TENNIS PESCARA, VIA GUGLIELMO MARCONI 355, Pescara, ITALIA, 65126`.
- Verificata la regolarità operativa: i lavori critici risultano verdi e i cicli live osservati sono partiti alle 01:15 e 01:30 UTC, rispettando la cadenza di 15 minuti. ITF può restare in esecuzione più a lungo senza indicare un salto della schedulazione.
- Cache-buster JavaScript aggiornato a `v3.js?v=2026091017`; sintassi verificata. Nessuna modifica ai dati sorgente, ai motori ITF/ITF-1 o alle schedulazioni.

### 2026-09-10 — docs: record draw links and agenda modes (`2bfa39dc`)

## Revisione 251 — 2026-09-10 — collegamenti Tabelloni e modalità Agenda
- Nella testata della pagina torneo è stata aggiunta la riga `Tabelloni:`. Mostra una sola etichetta per ciascuna categoria nella quale è presente almeno un giocatore monitorato, usando i codici già condivisi con l'Agenda, per esempio `GS14`, `GD14`, `BS14` e `BD14`.
- Le etichette riusano le classi cromatiche femminile/maschile dell'Agenda e sono collegamenti. Viene privilegiato l'URL specifico del tabellone fornito dal record; quando la fonte non espone un deep link viene aperta la sezione ufficiale Draws and Results del torneo.
- Accanto al titolo Agenda è stato aggiunto un menu con `Per torneo` e `Cronologico`. `Per torneo` è il valore predefinito e conserva struttura, priorità ITF → Tennis Europe → FITP, raggruppamenti e regola dei tre match simultanei dell'Agenda precedente.
- In modalità `Cronologico` i blocchi vengono ordinati globalmente per orario reale o stimato; tornei diversi possono quindi intercalarsi. I match dello stesso torneo con identica fascia temporale restano raggruppati fino a tre sulla stessa riga.
- La scelta Agenda viene conservata nello stato locale dell'interfaccia. Aggiunto comportamento responsive per selettore e riga Tabelloni.
- Cache-buster aggiornati a `v3.js?v=2026091018` e `v3.css?v=2026091007`; sintassi JavaScript e collegamenti degli asset verificati. Nessuna modifica a motori, schedulazioni o database.

### 2026-09-10 — docs: record exact Tennis Europe draw URLs (`d1f81909`)

## Revisione 252 — 2026-09-10 — collegamenti esatti ai tabelloni Tennis Europe
- Individuata la causa dei link Tennis Europe che aprivano la homepage del torneo: il parser dell'ordine di gioco leggeva l'evento e il collegamento al relativo draw dalla stessa riga ufficiale, ma conservava nel match soltanto l'URL giornaliero `/matches/{data}`.
- Il motore Tennis Europe live e il parser storico conservano ora anche il `drawUrl` esatto ricavato dal link ufficiale della partita, per esempio `/tournament/{competitionId}/draw/{drawId}`.
- La proiezione D1 porta `drawUrl` fino ai match dell'app. Le etichette `GS/BS/GD/BD` della pagina torneo privilegiano già questo campo e aprono quindi il tabellone corrispondente invece della homepage.
- La correzione vale sia per singolare sia per doppio e non ricostruisce numeri di draw per tentativi. Diventa visibile sui tornei live dopo il successivo ciclo Tennis Europe/OOP e la successiva proiezione D1.
- Chiarita la regola della modalità Agenda `Cronologico`: due match di tornei diversi con lo stesso orario restano in blocchi e righe separate, perché ciascuno mantiene la propria intestazione torneo. L'affiancamento fino a tre elementi riguarda i match dello stesso torneo e della stessa fascia temporale.
- Nessuna modifica alle cadenze, alle priorità Agenda o agli altri motori.

### 2026-09-10 — docs: record cross-tournament chronological alignment (`0edd289e`)

## Revisione 253 — 2026-09-10 — pari orario tra tornei diversi in Agenda Cronologico
- In modalità Agenda `Cronologico`, il raggruppamento temporale usa ora soltanto l'orario reale o calcolato, senza includere l'identità del torneo nella chiave.
- Due o tre match con lo stesso orario vengono quindi mostrati sulla stessa riga anche quando appartengono a tornei diversi. Il quarto match con il medesimo orario apre una nuova riga, conservando il limite massimo di tre.
- Ogni scheda nella vista cronologica mostra al proprio interno nome torneo, luogo e circuito, così l'affiancamento tra tornei non elimina il contesto. Il nome del torneo resta cliccabile verso la relativa pagina Court Watch.
- La modalità `Per torneo` non cambia: intestazioni, priorità ITF → Tennis Europe → FITP e raggruppamenti restano quelli precedenti.
- Cache-buster aggiornati a `v3.js?v=2026091019` e `v3.css?v=2026091008`; sintassi JavaScript e riferimenti degli asset verificati. Nessuna modifica ai motori, ai dati o alle schedulazioni..

### 2026-09-10 — docs: record Tennis Europe draw URL D1 realignment (`ec30b014`)

## Revisione 254 — 2026-09-10 — riallineamento D1 dei link draw Tennis Europe
- Verificata la persistenza del collegamento alla homepage dopo la revisione 252. Il ciclo OOP Tennis Europe n. 396, contenente l'acquisizione del `drawUrl` esatto, era terminato verde; l'ultima proiezione D1 n. 918 era però iniziata prima di quel ciclo e conteneva ancora i match precedenti senza `drawUrl`.
- Confermata quindi l'assenza di un nuovo errore nel selettore dell'interfaccia: senza `drawUrl` nella generazione D1 visibile, la pagina applicava correttamente il fallback alla homepage del torneo.
- Richiesto un riallineamento completo D1 tramite il workflow ufficiale, che ripristina lo snapshot Tennis Europe OOP verificato da R2 e rigenera i candidati applicativi includendo `drawUrl`.
- La catena futura resta automatica: OOP pubblica lo snapshot su R2, Agenda Europe agisce da gate e il rebuild generale D1 consolida la generazione successiva. Nessun numero di tabellone viene inventato lato interfaccia.
- Nessuna modifica alla visualizzazione Agenda o agli altri motori.

### 2026-09-10 — docs: correct Tennis Europe draw link incident diagnosis (`65915d28`)

## Revisione 255 — 2026-09-10 — causa reale del mancato aggiornamento link Tennis Europe
- Riprodotta nell'app pubblicata la pagina del 4° Memorial Padre Pino Puglisi: le etichette `GD16` e `GS16` puntavano ancora entrambe alla homepage `/tournament/6131A096-712D-4E53-B191-158EE50E83CE`.
- Il ciclo OOP Tennis Europe n. 396 aveva acquisito correttamente il nuovo `drawUrl`, ma l'import Agenda D1 n. 1079 era iniziato prima della pubblicazione completa dello snapshot R2 e aveva quindi importato la generazione precedente.
- L'import successivo n. 1080, avviato dopo OOP 396 e quindi idoneo a importare i link esatti, è stato cancellato dalla nuova richiesta di rebuild generale D1 n. 921. I due workflow condividono la coda `courtwatch-d1-writes`; il trigger manuale aggiunto durante la diagnosi ha sostituito il job in attesa. La precedente indicazione di controllare soltanto D1 921 era quindi errata.
- Non vengono aggiunti altri trigger per non cancellare nuovamente la scrittura corretta. Agenda D1 n. 1081 è il ciclo che deve importare lo snapshot contenente i `drawUrl` esatti; dopo il suo completamento verde l'app non deve più usare il fallback alla homepage per GD16/GS16.
- Nessuna modifica al codice o ai motori in questa revisione; viene preservata la coda attiva e documentata la causa operativa reale.

### 2026-09-10 — Document failed live verification after Agenda D1 1081 (`6682972e`)

## Revisione 256 — 2026-09-10 — verifica reale successiva ad Agenda D1 1081
- Il workflow Agenda Tennis Europe D1 n. 1081 si è concluso verde alle 02:21 UTC.
- La verifica diretta nell'app pubblicata ha però confermato che, nella pagina del 4° Memorial Padre Pino Puglisi, entrambe le etichette `GD16` e `GS16` puntano ancora alla homepage del torneo invece che ai rispettivi tabelloni.
- Il verde certifica dunque il completamento dell'importazione, non la presenza effettiva del campo `drawUrl` nei record applicativi visibili. La correzione non viene dichiarata risolta.
- Non sono stati avviati altri workflow e non è stato eseguito polling. Il prossimo intervento deve verificare la presenza del `drawUrl` nello snapshot OOP e lungo la proiezione D1 prima di richiedere un nuovo run.

### 2026-09-10 — Link agenda draw labels and prioritize singles (`6fd03612`)

## Revisione 257 — 2026-09-10 — link tabelloni in Agenda e priorità singolare
- Su conferma dell'utente, i collegamenti specifici ai tabelloni Tennis Europe in pagina torneo risultano funzionanti.
- Le etichette evento presenti nelle schede dell'Agenda, per esempio `GS16` e `GD16`, sono ora collegamenti al medesimo tabellone ufficiale utilizzato nella pagina torneo. Il collegamento si apre in una nuova scheda e conserva colore e aspetto dell'etichetta.
- Nella riga `Tabelloni:` della pagina torneo, tutte le categorie di singolare sono ordinate prima delle categorie di doppio; all'interno della stessa specialità resta l'ordinamento alfabetico del codice.
- Cache-buster JavaScript aggiornato a `v3.js?v=2026091020`; sintassi verificata. Nessuna modifica a motori, database o schedulazioni.

### 2026-09-10 — Add account device registry to admin (`07eb55b6`)

## Revisione 258 — 2026-09-10 — dispositivi connessi nell’Admin
- Aggiunto il registro D1 `app_user_devices`, inizialmente limitato all'account Federico Quadri. Ogni browser riceve un identificativo casuale persistito soltanto nel proprio localStorage; il server conserva etichetta indicativa dispositivo/browser, prima connessione, ultimo accesso, ultima rotta e stato.
- Il registro viene aggiornato esclusivamente durante le normali richieste già eseguite dall'app verso sessione e proiezione privata. Non sono stati aggiunti polling, workflow, chiamate AI o nuove schedulazioni.
- Nella pagina Admin → Utenti compare la sezione `Dispositivi connessi`, con conteggio dei dispositivi attivi negli ultimi 15 minuti, elenco degli accessi e comando di revoca del singolo identificativo browser.
- Un identificativo revocato riceve risposta 403 dalle API private. La revoca riguarda il browser registrato in CourtWatch e non sostituisce la gestione centrale delle sessioni Cloudflare Access.
- La migrazione è retrocompatibile: il Worker ignora in sicurezza il registro finché la nuova tabella non è stata applicata, evitando interruzioni durante il deploy preliminare.
- Cache-buster aggiornato a `v3.js?v=2026091021`; sintassi del client verificata e sorgente Worker preparata per il controllo del workflow. Nessuna modifica ai motori tennis, ai dati sportivi o alle loro frequenze.

### 2026-09-10 — Document green device registry deployment (`35a7d0b7`)

## Revisione 259 — 2026-09-10 — conferma deploy registro dispositivi
- L'utente ha confermato verde il workflow Cloudflare D1 e App API n. 922 relativo al registro dispositivi.
- Migrazione D1, Worker e interfaccia Admin risultano quindi distribuiti dalla pipeline. Il primo browser viene registrato alla successiva richiesta privata dell'app e diventa visibile in Admin → Utenti.
- Nessun polling o ulteriore controllo automatico è stato eseguito.

### 2026-09-10 — Keep admin available when device registry fails (`da016103`)

## Revisione 260 — 2026-09-10 — ripristino pagina Admin dopo errore registro dispositivi
- Dopo il deploy del registro dispositivi, l'apertura di Admin → Utenti restituiva `internal_error`.
- La lettura della nuova tabella è ora isolata: qualsiasi errore del registro produce un avviso nella sola scheda Dispositivi connessi e non può più impedire l'apertura dell'intera pagina Admin.
- Aggiunta la migrazione idempotente `0016_ensure_user_devices.sql`, che garantisce tabella e indice anche se il precedente passaggio `0015` non è stato registrato correttamente da Wrangler. Il run precedente riportava infatti `No migrations to apply!`.
- Sintassi Worker verificata. Nessuna modifica ai motori, alle schedulazioni o ai dati sportivi.

### 2026-09-10 — Document green admin device registry recovery (`643d160e`)

## Revisione 261 — 2026-09-10 — conferma verde ripristino Admin
- L'utente ha confermato verde il workflow Cloudflare D1 e App API relativo alla revisione 260.
- La migrazione di garanzia del registro dispositivi e l'isolamento degli errori della relativa sezione risultano quindi distribuiti dalla pipeline.

### 2026-09-10 — Add historical Tennis Europe ranking model (`d6514c42`)

## Revisione 262 — 2026-09-10 — fondazione storica classifiche Tennis Europe
- Aggiunte in D1 tre strutture separate: storico settimanale ufficiale per profilo/categoria/data, associazioni verificate dei profili e fotografie immutabili della classifica dei partecipanti per singolo match.
- La fotografia distingue giocatore monitorato, partner e avversari, conserva categoria, pubblicazione e data della classifica e impedisce che un aggiornamento futuro modifichi retroattivamente la classifica mostrata per una partita già disputata.
- L’API privata arricchisce lo snapshot già caricato dall’app: nei match Tennis Europe espone il ranking pertinente alla categoria giocata; nell’intestazione giocatore prepara entrambe le ultime classifiche disponibili U14 e U16.
- L’interfaccia mostra il formato richiesto `n°84 TE` immediatamente dopo il nome e prima di nazionalità e bandierina. Sono predisposti valori distinti anche per ciascun componente di una coppia di doppio.
- La migrazione e l’arricchimento API sono retrocompatibili: finché lo storico non contiene una posizione, nome e bandierina continuano a essere visualizzati senza errore. Nessuna modifica ai motori Tennis Europe OOP/TE-1, alle loro frequenze o all’ordine dell’Agenda.
- Cache-buster JavaScript aggiornato a `v3.js?v=2026091022`; nessun polling e nessuna chiamata AI aggiunti.

### 2026-09-10 — Restore agenda tournament headers (`395959b9`)

## Revisione 263 — 2026-09-10 — ripristino immediato intestazioni Agenda
- Corretto il rilascio 262: `v3.js` e `v3.html` vengono ripristinati esattamente alla revisione applicativa precedente, recuperando le intestazioni torneo dell’Agenda e tutte le regole grafiche già funzionanti.
- La causa era una pubblicazione costruita su una base JavaScript precedente agli ultimi aggiornamenti automatici del repository.
- Le tabelle D1 delle classifiche restano additive e innocue, ma la funzione classifiche non viene dichiarata completata: i dati ufficiali non sono ancora stati acquisiti e quindi non potevano essere visibili.
- Nessun motore Tennis Europe/TE-1, dato sportivo o schedulazione è stato modificato. Nessun polling eseguito.

### 2026-09-10 — Restore agenda headers and sync TE rankings (`5d910a9a`)

## Revisione 264 — 2026-09-10 — ripristino deploy e acquisizione reale ranking TE
- Individuata nel log la causa del run rosso 1578: lo Scudo ha bloccato il deploy con `cache-v3.js: asset modificato senza incremento cache in v3.html`. Il cache-buster è ora `v3.js?v=2026091023`.
- Le intestazioni torneo dell’Agenda restano costruite dalla versione applicativa ripristinata; il nuovo codice classifiche modifica soltanto la composizione dei nomi dei partecipanti.
- Aggiunto un motore classifiche Tennis Europe autonomo, settimanale e manuale. Legge le quattro liste ufficiali B14, G14, B16 e G16, archivia pubblicazione e data in D1 e non modifica i motori OOP Tennis Europe o TE-1.
- Per ciascun match salva separatamente giocatore, partner e avversari con la classifica della categoria disputata. L’API restituisce la fotografia del match; gli aggiornamenti successivi non sostituiscono il valore storico di una partita passata.
- La visualizzazione è `n°84 TE` tra nome e nazionalità/bandierina. L’intestazione giocatore riceve entrambe le ultime classifiche disponibili U14 e U16.
- Nessun polling e nessuna chiamata AI aggiunti. Il motore usa soltanto richieste HTTP settimanali alle pagine ufficiali Tennis Europe e condivide la coda D1 per evitare scritture concorrenti.

### 2026-09-10 — Exclude TE U12 and freeze match rankings (`e11a80b2`)

## Revisione 265 — 2026-09-10 — esclusione U12 e congelamento temporale ranking TE
- Corretto un errore di classificazione: gli eventi Tennis Europe U12 non vengono più fatti ricadere automaticamente nella categoria U16. Tennis Europe non pubblica classifiche U12, quindi per questi match non viene mostrato alcun valore `TE`.
- Il ciclo elimina anche eventuali fotografie U16 precedentemente associate per errore a un match U12.
- Per U14 e U16 una pubblicazione viene associata al match soltanto se la sua data è uguale o precedente alla data della partita. Dopo la giornata del match, le pubblicazioni successive non possono più sostituire quella fotografia.
- Restano le sei posizioni logiche dei partecipanti: giocatore monitorato, eventuale partner e uno o più avversari. Il formato resta `n°84 TE` prima di nazionalità e bandierina.
- Nessuna modifica alla costruzione delle intestazioni torneo dell’Agenda, ai motori OOP Tennis Europe/TE-1 o alle relative schedulazioni. Nessun polling e nessuna chiamata AI aggiunti.

### 2026-09-10 — Document Tennis Europe ranking workflow fix (`d4439eb6`)

# Revisione 266 — 10 settembre 2026
- Diagnosticata la causa della mancata visualizzazione delle classifiche Tennis Europe: entrambi i primi run del nuovo workflow ranking (`34509881081` e `34510799610`) sono stati cancellati prima dell'importazione perché condividevano la coda globale `courtwatch-d1-writes` con gli altri motori. Il codice UI/API era quindi presente, ma D1 non era mai stato popolato. Il workflow ranking usa ora una coda dedicata, senza modificare i motori ITF, ITF-1, FITP o Tennis Europe live, e verifica dopo l'importazione che `tennis_europe_ranking_history` contenga realmente record; in assenza di dati il run diventa rosso e non può distribuire un falso successo. Restano esclusi gli U12, per i quali Tennis Europe non pubblica una classifica ufficiale.

### 2026-09-10 — Document chronological agenda header rule (`9ccb460b`)

- 10 settembre 2026 — Rifinita l'intestazione dell'Agenda in modalità `Cronologico`: quando uno slot orario contiene esclusivamente partite dello stesso torneo viene mostrata una sola intestazione identica a quella della modalità `Per torneo`; l'intestazione compatta dentro ogni scheda resta soltanto quando nella stessa riga sono raggruppate partite di tornei differenti. La decisione usa l'identità circuito/competizione e non il semplice numero di match. Cache-buster aggiornato a `2026091024`; nessun motore dati o workflow modificato.

### 2026-09-10 — Document Tennis Europe ranking parser failure (`1c824b22`)

- 10 settembre 2026 — Diagnosticato il rosso del run classifiche Tennis Europe `34512383170`: migrazioni D1 e lettura match erano verdi, mentre `Acquire official rankings` falliva in circa un secondo prima dell'importazione. La pagina ufficiale espone i profili come `profile/default.aspx?id=<UUID>`; il parser riconosceva soltanto UUID collocati dopo una barra e scartava quindi tutte le righe, producendo `Classifica vuota B14`. Il parser accetta ora entrambi i formati ufficiali, incluso `player-profile/<UUID>`, con prova locale bloccante per ciascuno. Frequenza settimanale e volume delle richieste restano invariati; Agenda e motori ITF non sono stati modificati.

### 2026-09-10 — Document ranking serialization and agenda headers (`e4ff96ea`)

- 10 settembre 2026 — Agenda cronologica: l'intestazione grande del torneo non viene più ripetuta negli slot successivi consecutivi appartenenti alla stessa competizione; ricompare soltanto al cambio torneo. Se uno slot contiene match di tornei diversi, ciascuna scheda conserva invece l'intestazione compatta necessaria a distinguerli. Corretto inoltre il secondo rosso del ranking `34513425433`: il parser non era coinvolto, poiché il job falliva già su `wrangler d1 migrations apply` per sovrapposizione introdotta dalla coda dedicata. Il ranking torna nella coda globale `courtwatch-d1-writes` e viene avviato dopo la conclusione verde di `Court Watch Cloudflare D1 and app API` tramite `workflow_run`; il push diretto del ranking è rimosso, evitando che i due writer partano insieme. Aggiunta diagnostica per categoria acquisita. Cache-buster UI `2026091025`.

### 2026-09-10 — Document reliable ranking workflow isolation (`e28c74af`)

- 10 settembre 2026 — Il primo tentativo di serializzare il ranking dopo il writer principale non è affidabile su GitHub Actions: il run Cloudflare `34513856762` è stato cancellato mentre era pending perché un gruppo concurrency conserva al massimo un'esecuzione in corso e una in attesa, sostituendo la pending precedente. Il ranking torna quindi su una coda dedicata, ma non esegue più `d1 migrations apply`: la migrazione `0017` era già stata applicata con successo nel run `34512383170` e il secondo rosso avveniva esclusivamente tentando di riapplicare migrazioni durante un writer concorrente. Il workflow ranking legge `app_matches` e scrive soltanto le proprie tabelle ranking già create, senza intervenire su motori, ricostruzioni o schema D1; il trigger push isolato è ripristinato.

### 2026-09-10 — Document Tennis Europe ranking cookie-wall fix (`8a1fc103`)

- 10 settembre 2026 — Diagnosticato il terzo rosso ranking `34513990108`: configurazione e lettura D1 erano verdi, `Acquire official rankings` falliva in un secondo prima di acquisire qualsiasi categoria. Il confronto con l'acquisitore Tennis Europe già operativo ha individuato la differenza strutturale: il ranking usava una richiesta senza sessione e seguiva automaticamente il redirect, ricevendo dal runner GitHub la cookie wall invece della classifica. Il ranking ora apre e conserva una singola sessione con la stessa gestione del consenso essenziale già collaudata dal motore TE, segue esplicitamente i redirect e riutilizza il cookie per tutte le pagine. Aggiunta diagnostica non sensibile con byte, settimana e publication ID; frequenza e numero delle pagine ranking invariati.

### 2026-09-10 — Document exact ranking response failure (`e7912004`)

- 10 settembre 2026 — Letto finalmente il log autenticato completo del rosso `34514340063`. Errore esatto: `TypeError: response.text is not a function` alla riga 6 del sincronizzatore ranking. La nuova funzione `request()` restituiva correttamente `{status, url, text}`, ma `get()` trattava erroneamente la proprietà stringa `text` come il metodo della Fetch Response (`response.text()`). Corretto in `return response.text`. Il fallimento avveniva prima di qualsiasi accesso o parsing delle categorie; non era un blocco Tennis Europe né un problema D1.

### 2026-09-10 — Document ranking overview parser evidence (`01c49d08`)

- 10 settembre 2026 — Dal log autenticato del rosso `34514741722` è emersa la prova completa: overview ricevuta correttamente (`151925` byte), ma `week` vuota e `publicationId=null`, seguiti da `Pubblicazione Tennis Europe non riconosciuta`. Rete e cookie erano quindi funzionanti. Il parser cercava il titolo nell'HTML grezzo, dove i tag possono separare le parole, e richiedeva l'ordine fisso `category=525&id=...`. Ora estrae settimana/data dal testo HTML ripulito e analizza tutti i link categoria con `URLSearchParams`, accettando qualsiasi ordine dei parametri e `&amp;`. Due prove bloccanti coprono tag intermedi e i due ordini del link.

### 2026-09-10 — Document authoritative ranking match source (`1d407e63`)

- 10 settembre 2026 — Scartata prima della pubblicazione la sostituzione della lettura D1 con `dist/v3/agenda.json`: il test locale ha confermato 46 record Tennis Europe, ma tutti sono segnaposto Agenda privi dei dettagli storici completi necessari (`event/draw`, avversari e categoria), quindi avrebbe potuto generare un falso verde senza snapshot match. Conservata la sorgente autorevole `app_matches` in D1. La lettura Wrangler usa ora un file temporaneo, non nasconde più l'errore dentro il JSON finale e applica fino a otto retry progressivi per assorbire contese o limiti Cloudflare transitori; soltanto un export riuscito viene promosso a input del ranking.
- 10 settembre 2026 — Il run `34518021009` è fallito prima del parser nello step `Read Tennis Europe matches`: Wrangler D1 è uscito con codice 1 e il redirect dello stdout nel JSON ha nascosto il dettaglio. Rimossa del tutto questa lettura remota non necessaria. Il ranking usa ora `dist/v3/agenda.json`, già versionato e certificato dal release guard (439 match complessivi, 46 Tennis Europe), filtrando localmente il circuito e mantenendo gli stessi identificativi/date/partecipanti. Il parser accetta sia il vecchio export D1 sia la proiezione Agenda. L'import finale nelle sole tabelle ranking conserva retry limitati per eventuale contesa D1 temporanea.

### 2026-09-10 — Bound Tennis Europe ranking imports (`727af501`)

- 10 settembre 2026 — Diagnosticato il rosso ranking `34518489779`: acquisizione ufficiale riuscita, ma ogni categoria arrivava artificialmente al limite di 20.000 righe perché il sito restituiva nuovamente una pagina già letta e il ciclo si fermava soltanto sull'etichetta generica `Next`. Ne risultavano 160.024 istruzioni e un import D1 monolitico rimasto a lungo in elaborazione. L'acquisitore deduplica ora per UUID ufficiale e termina alla prima pagina senza nuovi profili, preservando tutte le righe uniche. L'SQL viene inoltre suddiviso in blocchi deterministici da 2.000 istruzioni, importabili e ripetibili indipendentemente. Nessun polling, chiamata AI, nuova frequenza o riduzione delle categorie è stato introdotto.

### 2026-09-10 — Document D1 import cost fix (`a8a2c775`)

### 2026-09-11 — Eliminata l'amplificazione delle letture D1 nell'import Tennis Europe
- Motivo: l'import incrementale usava `INSERT OR REPLACE` sulla tabella padre `matches`. SQLite implementa `REPLACE` come cancellazione e reinserimento; la cancellazione attivava i controlli/cascade verso `app_match_candidates`, che non disponeva di un indice con `match_id` come prima colonna. Ogni aggiornamento di una partita poteva quindi scandire l'intera tabella delle candidate.
- Componenti: `generate-tennis-europe-oop-seed.mjs` elimina esplicitamente le candidate della sola partita e usa `INSERT ... ON CONFLICT(id) DO UPDATE`; la migrazione `0018_app_match_candidates_match_index.sql` aggiunge l'indice su `app_match_candidates(match_id)`.
- Compatibilità funzionale: l'eliminazione esplicita preserva la precedente semantica di `REPLACE` (le candidate della partita vengono ricostruite dal generatore successivo), mentre l'UPSERT conserva l'identità della riga padre ed evita le cascade implicite. Payload, calendario, risultati e partecipanti prodotti non cambiano.
- Validazione: controllo sintattico Node superato; la CI reale esegue ripristino degli archivi, migrazioni, generazione, import, verifica D1 e controllo API.
- Limitazione residua: le query di verifica con più `COUNT(*)` restano inefficienti, ma dai D1 Insights rappresentano meno di un miliardo di letture complessive e non sono la causa dell'eccedenza da 42,71 miliardi.

### 2026-09-10 — Record change-only D1 import guard (`abc8a57a`)

- Rafforzamento immediato: gli import attivati da modifiche tecniche sono ora incrementali; ogni shard registra in una tabella temporanea soltanto gli ID il cui record D1 differisce dal payload sorgente. Cancellazioni e reinserimenti di schedule, risultati, partecipanti e candidate avvengono esclusivamente per questi ID. Le partite invariate producono solo lookup su chiave primaria e zero riscritture persistenti. Il run completo corretto 34543803214 ha confermato la rimozione dell'amplificazione: 8.138 righe lette nei file match contro circa 190,5 milioni per il precedente import incrementale; parità D1, Worker API e agenda tutte verdi.

### 2026-09-11 — Record definitive D1 cost resolution (`4e5b180b`)

### 2026-09-11 — Chiusura definitiva anomalia costi D1 Tennis Europe
- Il run definitivo `34545548010` (#1175) è verde in ogni fase: migrazioni, import, parità D1, validazione e deploy Worker, verifica API e agenda.
- I file `03-matches-*` hanno letto complessivamente 1.889 righe e scritto 0 righe per le 1.857 partite invariate. Prima della correzione lo stesso import leggeva circa 190,5 milioni di righe.
- La riduzione deriva dalle cancellazioni aggregate per shard, dagli indici sui riferimenti `match_id` e dall'aggiornamento dei soli match il cui payload è realmente cambiato.
- La causa dell'eccedenza Cloudflare è chiusa: frequenza, dati pubblicati e funzionamento dell'app restano invariati. Eventuali incrementi tardivi della fattura corrente riguardano esclusivamente consumo precedente già maturato.

### 2026-09-11 — Complete Cloudflare D1 incident timeline (`4786cdd2`)

### 2026-09-11 — Cronologia completa incidente Cloudflare D1
- Segnalazione iniziale: il pannello Cloudflare mostrava $19,71 nel ciclo corrente, composti da $17,71 per 17,71 miliardi di righe D1 lette oltre i 25 miliardi inclusi e $2,00 per 1,03 milioni di righe scritte oltre i 50 milioni inclusi.
- Audit autenticato read-only: creato il workflow `Court Watch D1 cost audit`; run `34542353363` e `34543444978` verdi. D1 Query Insights ha attribuito meno di 700 milioni di letture alle normali query visibili, escludendole come spiegazione dei 42,71 miliardi totali.
- Attribuzione operativa: i log del workflow agenda Tennis Europe mostravano circa 190,5 milioni di righe lette per ogni import dei file generati `03-matches-*`. La causa era `INSERT OR REPLACE` sulla tabella padre `matches`, combinato con lookup/cascade non indicizzati sulle tabelle figlie.
- Prima correzione: migrazione `0018_app_match_candidates_match_index.sql` e UPSERT non distruttivo dei match. Il run `34543803214` (#1169) ha mantenuto verdi D1, Worker API e agenda, eliminando l'amplificazione del `REPLACE` nell'import completo.
- Primo tentativo change-only: il run `34544669082` (#1172) è fallito con `SQLITE_AUTH` perché D1 vieta tabelle `TEMP` negli import remoti; nessun deploy finale è stato eseguito.
- Secondo tentativo: sostituita la tabella temporanea con `tennis_europe_changed_matches` tramite migrazione `0019`. Il run `34544961871` (#1174) è risultato verde e ha portato a zero le scritture dei match invariati, ma ha rivelato che le cancellazioni condizionali per singola partita conservavano circa 190 milioni di letture.
- Correzione finale: cancellazioni aggregate per shard e indici `schedules(match_id)` e `results(match_id)` nella migrazione `0020_match_child_lookup_indexes.sql`.
- Certificazione: il run `34545548010` (#1175) è verde in tutte le fasi. Per 1.857 match invariati, gli otto file `03-matches-*` hanno letto complessivamente 1.889 righe e scritto 0 righe, contro circa 190,5 milioni di letture precedenti. Frequenza e comportamento dell'app sono invariati.
- Run universale cancellato: `34545536901` è stato interrotto durante l'import di una nuova generazione universale, prima delle verifiche e del deploy finale. Il successivo #1175 ha certificato l'integrità di D1, API e agenda.
- Stato conclusivo: la causa dell'eccedenza D1 Tennis Europe è risolta. Eventuali ulteriori movimenti della fattura corrente possono derivare solo da consumo già maturato e contabilizzato in ritardo o da sorgenti indipendenti, non da questa anomalia.

### 2026-09-11 — Certify full post-D1 operational health (`52806d8f`)

### 2026-09-11 — Certificazione operativa completa dopo correzione D1
- Diagnostici pubblicati alle 00:26 UTC: tutti i nove componenti critici sono verdi — catalogo e live FITP, live Tennis Europe, discovery/labels/T−1 ITF, OOP Europe, D1 generale e D1 agenda Europe.
- Il D1 generale è verde nel run `34545948514`; il D1 agenda Europe è verde nel run `34545767971`. Il successivo aggiornamento generale chiude anche il rischio operativo lasciato dal rebuild universale interrotto.
- App/UI generate correttamente; ultimo merge 11 settembre alle 02:26 locali. Tennis Europe riporta zero pending, zero inconclusive, zero warning e zero errori. FITP riporta 391/391 entry con tessera e zero errori di refresh. L'archivio ITF è completo con 1.057 tornei correnti/storici, 15.018 giocatori e 87.499 risultati.
- La correzione costi ha modificato esclusivamente la strategia SQL dell'import D1: nessuna regola applicativa, dato pubblicato, motore sorgente o schedulazione è stata modificata.
- Lo stato diagnostico aggregato `yellow` deriva da indicatori informativi non bloccanti di Calendario, Agenda legacy, Risultati e Avversari; nessun componente critico è rosso o giallo.

### 2026-09-11 — Fix Tennis Europe ranking pagination and imports (`71d47602`)

### 2026-09-11 — Ripresa classifiche Tennis Europe
- Corretto il ciclo di paginazione delle quattro classifiche ufficiali B14, G14, B16 e G16: i profili vengono deduplicati per UUID ufficiale e l'acquisizione termina alla prima pagina senza nuovi profili, impedendo che una pagina ripetuta venga accumulata fino al limite artificiale di 20.000 righe.
- L'import D1 non usa più un singolo file da circa 160.000 istruzioni: genera blocchi deterministici da 2.000 istruzioni, importati con retry limitati e verificati prima del deploy.
- Restano invariati categorie, frequenza settimanale, snapshot storici per match, esclusione U12 e formato visuale dell'app. Nessun polling o chiamata AI è stato aggiunto al workflow.
- Validazione locale: sintassi Worker e sincronizzatore verde; verifica UI analisi verde. La certificazione reale richiede il run avviato dal commit atomico di script, workflow e report.

### 2026-09-11 — Certify Tennis Europe rankings green (`a6c7000e`)

### 2026-09-11 — Classifiche Tennis Europe certificate verdi
- Run `34546734387` verde in tutte le fasi: lettura match D1, acquisizione ufficiale, import a blocchi, verifica D1 e deploy API.
- Pubblicazione ufficiale `53665`, settimana `37-2026`, data ranking `2026-09-07`.
- Acquisite 100 posizioni uniche per ciascuna categoria B14, G14, B16 e G16; 824 istruzioni in un solo blocco controllato.
- Import D1: 1.600 righe lette e 2.400 scritte; storico verificato a 400 record. Il consumo è compatibile con la quota gratuita e il workflow resta settimanale.

### 2026-09-11 — Show Tennis Europe rankings in app (`85ce766d`)

### 2026-09-11 — Correzione visibilità classifiche Tennis Europe nell'app
- Causa accertata: `app-snapshot` arricchiva correttamente i giocatori con `ranking` e `tennisEuropeRankings`, ma il caricatore UI sostituiva poi l'array API con quello statico di `players.json`, scartando entrambi i campi prima del rendering.
- Correzione: l'elenco statico resta la fonte anagrafica e viene arricchito, per `id`, esclusivamente con i campi classifica restituiti dalla API. Nessun dato di calendario, torneo, match, motore o schedulazione cambia.
- Cache-bust aggiornato per forzare Safari a caricare il JavaScript corretto. Nessun polling, run di acquisizione o chiamata AI aggiuntiva introdotta.
- Validazione: controllo sintattico JavaScript e test deterministico del merge; la pagina profilo può ora mostrare `classifica n°… TE U14/U16` per i giocatori associati.

### 2026-09-11 — Include all Tennis Europe matches in ranking snapshots (`1549a8ff`)

### 2026-09-11 — Correzione snapshot classifiche TE nell'agenda
- Verifica diretta sull'app pubblicata: JavaScript aggiornato caricato, ma il match Tennis Europe di Virginia Cereghini era ancora privo del badge classifica.
- Causa accertata: l'export ranking selezionava soltanto i payload con campo `circuit='tennis-europe'`; i match applicativi possono identificare la sorgente tramite `sourceId`, `source` o `sourceName`, perciò non venivano esportati e non nasceva alcuno snapshot classifica per agenda/avversari.
- Correzione: selezione compatibile con tutti i campi sorgente già supportati dalla UI. Nessuna regola di calendario o visualizzazione modificata; un solo run di riallineamento è necessario.

### 2026-09-11 — Audit Tennis Europe historical ranking update times (`06e13dd4`)

### 2026-09-11 — Audit storico orari Tennis Europe
- Aggiunto un workflow manuale/di modifica controllata in sola lettura per estrarre dal selettore ufficiale Tennis Europe le pubblicazioni storiche e i relativi orari `Last updated`, senza accesso o scrittura su D1.

### 2026-09-11 — Fix Tennis Europe history audit wrapper (`179ed8a8`)

- Primo tentativo audit fallito per un errore sintattico locale nel wrapper del workflow; nessuna chiamata D1 o modifica applicativa è stata eseguita. Wrapper corretto nel commit successivo.

### 2026-09-11 — Simplify Tennis Europe history audit output (`5c58ef41`)

- Secondo tentativo fallito solo nell'output diagnostico finale (regex di logging); la richiesta HTTP era già partita ma il job è stato corretto nuovamente per produrre esclusivamente le opzioni e non eseguire parsing superfluo.

### 2026-09-11 — Follow Tennis Europe cookie session for history audit (`297436b9`)

- Gestione cookie wall aggiunta dopo il redirect 302 osservato; il workflow segue il flusso ufficiale senza scritture.

### 2026-09-11 — Read historical Tennis Europe ranking update times (`4a052542`)

- Audit storico esteso: per le settimane 26–36 usa gli identificativi ufficiali esposti dal selettore e verifica i parametri della pagina, registrando solo il campo `Last updated` restituito da Tennis Europe.

### 2026-09-11 — Inspect Tennis Europe ranking selector postback (`5942fad3`)

- Audit storico: il selettore espone gli identificativi di pubblicazione; il terzo passaggio stampa il contesto HTML del selettore per ricostruire il postback ufficiale senza fare ipotesi sui parametri URL.

### 2026-09-11 — Read Tennis Europe ranking history postbacks (`0ec32918`)

- Postback storico completato: il selettore ranking ASP.NET richiede `__EVENTTARGET` e i campi hidden del form; l'audit ora riproduce quel flusso ufficiale e raccoglie `Last updated` per le settimane 26–36.

### 2026-09-11 — Fix ranking history audit regex escaping (`dbc82d74`)

- Corretto l'escaping dei regex nel postback audit; il tentativo precedente si fermava prima dell'invio per sintassi JavaScript, senza effetti esterni.

### 2026-09-11 — Diagnose Tennis Europe historical postback response (`7ec2f587`)

- Audit postback: aggiunto URL/anteprima della risposta per diagnosticare il contratto ASP.NET restituito dal server, senza trasmettere dati dell'utente.

### 2026-09-11 — Diagnose historical ranking postback contract (`99349d8d`)

- Audit storico limitato a una sola settimana per diagnosi del postback: registra contratto form e marker `Last updated` senza ulteriori richieste non necessarie.

### 2026-09-11 — Use correct Tennis Europe ranking postback route (`200bae07`)

- Rotta del postback corretta da `/ranking.aspx` (404) a `/ranking/ranking.aspx`; audit riattivato per tutte le settimane richieste.

### 2026-09-11 — Record official Tennis Europe ranking update times (`dfbd2287`)

### 2026-09-11 — Orari ufficiali pubblicazioni Tennis Europe, settimane 26–36
Verificati tramite il selettore storico ufficiale Tennis Europe e il relativo postback della pubblicazione:
| Settimana | Ultimo aggiornamento ufficiale |
|---|---|
| 36-2026 | 01 settembre 2026 15:41 |
| 35-2026 | 25 agosto 2026 09:24 |
| 34-2026 | 18 agosto 2026 09:12 |
| 33-2026 | 10 agosto 2026 16:07 |
| 32-2026 | 03 agosto 2026 16:14 |
| 31-2026 | 27 luglio 2026 15:49 |
| 30-2026 | 21 luglio 2026 11:03 |
| 29-2026 | 13 luglio 2026 14:45 |
| 28-2026 | 06 luglio 2026 14:57 |
| 27-2026 | 29 giugno 2026 14:39 |
| 26-2026 | 22 giugno 2026 12:51 |
La settimana 37-2026 resta verificata sulla pagina ufficiale come **07 settembre 2026 16:10**.

### 2026-09-12 — Update Cloudflare cost forecast report (`a76be929`)

## Aggiornamento 12 settembre 2026 — costo aggiornato e previsione post-correzione
- Audit Cloudflare autenticato delle 18:46 UTC, run `34712214295`: 61.525.998.551 righe lette e 69.998.729 righe scritte dal 1° settembre. Applicando le quote Workers Paid correnti (25 miliardi di letture e 50 milioni di scritture incluse), l'eccedenza D1 maturata stimata è $56,52, esclusi canone Workers Paid, IVA, storage e altri prodotti.
- Distribuzione del costo stimato: $36,53 per letture oltre quota e $20,00 per scritture oltre quota. L'importo nel pannello può differire temporaneamente per ritardi di contabilizzazione e per l'effettiva data di rinnovo dell'abbonamento.
- Tentata la lettura in sola lettura della data di rinnovo tramite endpoint ufficiale Cloudflare Accounts Subscriptions. Il token operativo consente Analytics ma l'endpoint fatturazione restituisce HTTP 403; la data esatta non è quindi certificabile tramite l'accesso disponibile. Il reset delle quote avviene nel giorno mensile di rinnovo del piano, non necessariamente il primo del mese.
- Proiezione fino al prossimo reset, senza rebuild manuali: scenario ordinario circa $0,68 di ulteriore eccedenza D1 al giorno; limite cautelativo circa $1,23 al giorno, ricavato dalla prima finestra post-correzione ancora interessata da commit e verifiche.
- Proiezione al 16 settembre: $59,24 scenario ordinario, $61,45 cautelativo. Proiezione al 30 settembre: circa $68,75 ordinaria, $78,67 cautelativa. Dopo il reset, il consumo corretto proiettato resta sotto entrambe le quote mensili incluse e quindi non genera eccedenza D1, salvo avvio manuale di `full_refresh` o nuove regressioni.
- Il workflow di audit è schedulato quotidianamente alle 07:00 UTC (09:00 CEST) e registra direttamente Analytics Cloudflare; commit audit rinnovo `81ad72bc4fadfea5c2f416a56e165c7b014f37a9`.

### 2026-09-12 — Document permanent D1 consumption policy (`d64ef488`)

## Aggiornamento 12 settembre 2026 — politica permanente anti-consumo D1
- Introdotta un'impronta SHA-256 del contenuto applicativo effettivo nella generazione D1. I timestamp puramente tecnici (`generatedAt`, `lastSeen`, `lastSeenAt`, `lastDrawCheckedAt`, `acceptanceLastUpdated`) sono esclusi: non devono provocare riscritture.
- Il workflow confronta l'impronta locale con quella pubblicata in `generations.counts_json.importHash`; quando coincidono salta l'intero import universale e dichiara `rows_written=0`. Frequenza, acquisizione, API e dati visibili restano invariati.
- Il primo run inizializza necessariamente la nuova impronta. Il run manuale `34713406100` è verde su D1, API e parità, ma ha importato 6.913 righe perché tra le due revisioni erano presenti cambiamenti sorgente; la prova di skip identico resta da certificare su un ciclo senza modifiche applicative.
- Su istruzione dell'utente, le soglie D1 non interrompono più automaticamente gli aggiornamenti: il guard opera in modalità `warn`, produce annotazioni e report ma lascia proseguire l'app. La modalità bloccante resta disponibile solo se impostata esplicitamente con `D1_GUARD_MODE=block`.
- Regola per modifiche future: nessun rebuild completo automatico; impronta contenuto obbligatoria; timestamp tecnici non sono cambiamenti; soglie segnalate senza fermare l'app; consumo account controllato dall'audit giornaliero.

## Aggiornamento 13 settembre 2026 — richieste UI, causa sparizioni e stato Cloudflare

### Interventi UI richiesti e ancora da eseguire

- Agenda, partite di doppio: il collegamento sul giocatore Court Watch deve comprendere esclusivamente il suo nome. Il compagno deve avere un collegamento autonomo, associato esclusivamente al proprio nome.
- Pagina giocatore, tornei futuri: non mostrare i conteggi `giocate`, `vinte` e `perse`, perché prima dell'inizio sono statistiche prive di significato. Sostituirli con l'etichetta `PROGRAMMATI`, sfondo rosso acceso e testo bianco.
- Rimuovere la tendina di stato `in corso / conclusi / programmati`. La distinzione dei tornei programmati viene resa direttamente e senza ambiguità dall'etichetta visiva.

### Perché sono aumentati i costi Cloudflare

- L'aumento non è stato causato principalmente dall'agenda Tennis Europe: il run `34708561269` ha scritto soltanto 6.378 righe.
- La causa misurata erano i push applicativi con `D1_SKIP_OBSERVED=0`: ogni push ricostruiva l'intera proiezione D1 e un singolo run, `34695209250`, ha prodotto 604.753 scritture. Più push tecnici nella stessa giornata hanno moltiplicato letture e scritture.
- Dal 1° al 12 settembre l'audit ha rilevato 61.525.998.551 letture e 69.998.729 scritture. Applicando le quote Workers Paid registrate nel report, l'eccedenza stimata era $56,52: $36,53 da letture e $20,00 da scritture, oltre a canone, IVA, storage e altri prodotti.
- La correzione `4a686be3` impedisce rebuild completi automatici; `full_refresh=true` resta esclusivamente manuale. Il run certificato `34709459093` ha ridotto le scritture per push da 604.753 a 6.913, circa −98,86%.
- L'impronta SHA-256 ignora timestamp tecnici e deve saltare integralmente l'import quando il contenuto non cambia. Resta da certificare un ciclo identico con `rows_written=0`.

### Perché Arginelli/Cereghini erano scomparse

- La causa funzionale documentata era una proiezione troppo aggressiva davanti a snapshot temporaneamente incompleti: se un aggiornamento non restituiva una relazione giocatore–torneo o un match corrente/futuro, l'interfaccia poteva eliminarlo immediatamente pur senza una prova definitiva di ritiro o esclusione.
- Per Cereghini esisteva inoltre una fragilità separata nella classifica Tennis Europe: l'API dipendeva dall'alias; quando l'associazione non era presente nella proiezione, la classifica TE spariva anche se il profilo ufficiale era ancora valido.
- La mitigazione pubblicata conserva l'ultima classifica Tennis Europe valida durante vuoti temporanei, recupera Cereghini tramite nome normalizzato univoco/UUID ufficiale e conserva match correnti o futuri mancanti da un singolo aggiornamento fino a due giorni dopo la data prevista.
- Questa spiegazione riguarda la causa tecnica osservata; una sparizione futura deve essere trattata come regressione e verificata contro snapshot sorgente, alias e stato della relazione, senza dedurre automaticamente un ritiro.

## Integrità del documento

## Aggiornamento 13 settembre 2026 — barriera permanente contro regressioni di costo D1

- Aggiunto `verify-d1-cost-invariants.mjs`, eseguito da `npm run check` prima che il workflow generale raggiunga configurazione, migrazioni o import D1.
- Il controllo fallisce se una modifica futura rimuove le impronte/no-op, rende nuovamente integrali le verifiche su dati invariati, riattiva migrazioni periodiche, collega il CRUD smoke a ogni deploy, reintroduce `INSERT OR REPLACE` sulle proiezioni Tennis Europe protette o elimina il limite di scrittura del registro dispositivi.
- I tre workflow D1/CRUD sono inclusi nei path che attivano il controllo generale: una modifica alla politica di costo viene quindi verificata prima delle operazioni remote.
- Nessun trigger temporale dei motori è stato modificato. La barriera riguarda esclusivamente regressioni che aumenterebbero letture o scritture senza produrre nuovi dati visibili.
- Limite esplicito: una barriera nel repository protegge le modifiche ordinarie; un amministratore con facoltà di rimuovere contemporaneamente workflow e controllo può sempre aggirarla. Una garanzia organizzativa assoluta richiede anche branch protection obbligatoria lato GitHub.

## Aggiornamento 13 settembre 2026 — causa certificata dei picchi D1 del 9–10 settembre e contenimento permanente

### Evidenza e causa

- Analytics Cloudflare D1 sul database `courtwatch-app`: il 9 settembre sono state conteggiate **15.654.196.445 righe lette** e **5.814.575 righe scritte**; il 10 settembre **18.063.182.373 lette** e **13.490.723 scritte**.
- La cronologia Git registra 1.326 commit il 9 settembre e 1.321 il 10. Di questi, rispettivamente 769 e 773 erano aggiornamenti automatici della diagnostica; si aggiungono centinaia di pubblicazioni dei motori FITP, Tennis Europe e ITF. Questa tempesta non equivale da sola a consumo D1, ma moltiplicava i workflow a valle.
- Query Insights attribuisce l'amplificazione delle letture soprattutto alle verifiche integrali: la query multi-tabella dei conteggi ha letto 703.922.932 righe in 1.104 esecuzioni (media 637.611), più ulteriori conteggi completi di tabelle e snapshot applicativi. Venivano rieseguiti anche quando l'import non aveva prodotto una variazione utile.
- Le scritture derivavano da import completi o ripetuti di righe identiche e, in misura minore, da creazione ripetuta di indici, aggiornamento del registro dispositivi e test CRUD. Il 10 settembre il numero di scritture è più che doppio rispetto al 9 perché più cicli di import/scrittura sono arrivati a D1 prima dell'introduzione dei delta e del contenimento dei rebuild.
- Alle tariffe D1 registrate (letture oltre quota: $0,001/milione; scritture oltre quota: $1/milione), il controvalore marginale massimo dei due giorni, se tutta la quota mensile fosse già esaurita, è circa **$21,47 il 9 settembre** e **$31,55 il 10 settembre**. La fattura effettiva applica invece le quote incluse al totale del periodo di rinnovo, quindi questi valori non vanno sommati automaticamente alla fattura.

### Correzioni applicate senza ridurre i motori

- Frequenze, trigger e schedulazioni di tutti i motori di acquisizione restano invariati. Anche il ripristino R2, la generazione completa dei candidati e il deploy API continuano: la decisione di non scrivere avviene solo dopo aver generato e confrontato l'output.
- L'import generale usa una SHA-256 semantica che esclude anche i timestamp tecnici di osservazione/verifica. Se i dati visibili sono invariati, l'import D1 viene saltato integralmente e dichiara `rows_written=0`.
- Anche l'import Tennis Europe agenda/OOP ora possiede una SHA-256 deterministica dell'intero SQL generato e la confronta con `generations.counts_json.teImportHash`. A impronta uguale non esegue alcun file SQL; a impronta diversa importa tutto il delta e registra la nuova impronta soltanto dopo successo.
- Le verifiche integrali D1 vengono eseguite esclusivamente dopo un import realmente cambiato. Su un no-op il confronto dell'impronta remota costituisce la verifica; restano il dry-run del Worker e la verifica dell'API pubblicata.
- Gli upsert di tornei, identità e candidati Tennis Europe ora aggiornano soltanto colonne realmente diverse. La proiezione `app_matches` conserva le righe identiche e sostituisce solo quelle cambiate.
- Le migrazioni vengono applicate su push/manuale che modifica il codice o lo schema, non a ogni completamento periodico a valle. Nessuna migrazione viene rimossa.
- Il test CRUD remoto resta disponibile manualmente e viene eseguito quando cambia la relativa implementazione, ma non scrive più cinque volte dopo ogni deploy ordinario.
- Il registro dispositivi conserva integralmente revoca, user-agent, percorso e stato attivo; a valori invariati limita il rinnovo di `last_seen` a una scrittura ogni 10 minuti per dispositivo/percorso.

### Garanzie, previsione e limiti

- Nessun dato sorgente viene scartato e nessuna frequenza di acquisizione viene rallentata. Ogni variazione funzionale cambia l'impronta, viene importata e subisce la verifica completa prima della pubblicazione.
- A regime, i cicli senza cambiamenti producono una sola lettura puntuale della generazione e zero scritture bulk. I cicli cambiati hanno scritture proporzionali al delta; ciò porta l'uso ordinario sotto le quote mensili già documentate e rende eventuali eccedenze limitate a pochi dollari, salvo una crescita eccezionale dei dati o un `full_refresh` manuale.
- Non è tecnicamente corretto garantire un tetto monetario assoluto senza bloccare aggiornamenti, perché l'utente ha richiesto completezza e continuità anche oltre soglia. La barriera scelta elimina gli sprechi e non interrompe mai i dati reali. L'audit Cloudflare quotidiano resta il controllo contabile; `full_refresh` rimane esclusivamente manuale.
- Validazione locale: sintassi Node dei generatori e del Worker, controllo whitespace Git, verifica del guard SQL. La generazione TE completa richiede gli archivi R2 non presenti nel checkout locale ed è quindi certificabile soltanto dal workflow autenticato dopo il push.

### 2026-09-13 — Nuova verifica diretta del costo scritture D1

- Riavviati insieme l'audit Analytics D1 per database e l'audit Query Insights in sola lettura per spiegare le circa 3,67 milioni di righe scritte registrate il 12 settembre.
- Modifica limitata a commenti di attivazione nei due workflow: nessun codice applicativo, dato pubblicato o database viene modificato.
- Validazione prevista: completamento dei due workflow e confronto tra totale giornaliero Cloudflare, query attribuibili e log dei workflow di importazione del 12 settembre.
- Limite: Query Insights può non conservare o attribuire integralmente le scritture bulk; in tal caso il totale Analytics resta autorevole e l'origine viene correlata ai report `rows_written` dei run GitHub.

- Ricostruzione eseguita dalla versione integra `f01a4d21` del 5 settembre e dalle aggiunte recuperabili dei successivi commit Git che hanno modificato il report.
- Le voci sono conservate con commit sorgente; nessun testo corrotto è stato usato come fonte.
- Il precedente blob danneggiato resta integralmente disponibile nella cronologia Git.

### Commit censiti senza patch testuale disponibile nell’API GitHub

- `1bf5bc37` — Revert latest agenda result ordering change. Modifica transitoria successivamente annullata.
- `aab3b5d5` — Restore agenda result ordering change. Ripristino della disposizione dell’agenda; lo stato finale è documentato dai commit successivi.
- `b0a8dd8b` — Restore last known working CourtWatch application. Ripristino applicativo di emergenza; lo stato finale è documentato dalle verifiche e revisioni successive.
- `8394498a` — Complete Tennis Europe ranking coverage. Completamento della copertura classifiche Tennis Europe.
- `6f434025` — Record Tennis Europe ranking certification. Registrazione della certificazione delle classifiche Tennis Europe.
- `ea29e9eb` — Show every ranking in player and tournament views. Pubblicazione di tutte le classifiche disponibili nelle viste giocatore e torneo.
- `222903a5` — Document Cloudflare D1 rebuild containment. Registrazione del contenimento dei rebuild D1; dettagli quantitativi e correzione sono riportati nella sezione “Perché sono aumentati i costi Cloudflare”.

## Aggiornamento 13 settembre 2026 — applicazione effettiva delle correzioni UI richieste

- Agenda doppio: sostituito il singolo pulsante che racchiudeva giocatore e compagno. Il giocatore Court Watch ha ora un link limitato al proprio nome; il compagno ha un link autonomo quando dispone di un profilo Court Watch, altrimenti il suo nome resta testo separato e non viene incluso nel link del giocatore.
- Pagina giocatore: per ogni torneo con data iniziale futura, rimossi dalla testata i conteggi `giocate`, `vinte` e `perse`; al loro posto viene mostrata l’etichetta `PROGRAMMATI` con sfondo rosso acceso e testo bianco. Il pulsante per aprire le partite resta disponibile.
- Rimossa dalla UI la tendina `Tutti i tornei / In corso / Programmati / Conclusi`. Restano i filtri Circuito, Partita e Anno.
- Aggiornati i cache-buster di `v3.js` e `v3.css`.
- Verifica statica: JavaScript analizzato senza errori di sintassi; presenza dei link separati, dell’etichetta programmati e assenza del selettore stato certificate prima del commit.

## Aggiornamento 13 settembre 2026 — filtri Categoria e Sesso nel calendario

- Aggiunte nel Calendario due tendine indipendenti: `Categoria` (`U10`, `U12`, `U14`, `U16`, `U18`, `O18`) e `Sesso` (`M`, `F`), entrambe con opzione iniziale per mostrare tutti.
- Le categorie sono calcolate per l'anno del mese visualizzato a partire dall'anno di nascita acquisito; cambiando anno nel calendario il gruppo anagrafico si aggiorna automaticamente.
- I giocatori e le bande dei tornei mostrati nel calendario rispettano entrambi i filtri. `Seleziona tutti` e `Deseleziona tutti` agiscono soltanto sui giocatori del gruppo visibile, senza alterare le selezioni degli altri gruppi.
- La scelta delle due tendine viene conservata localmente sul dispositivo insieme allo stato dell'interfaccia.
- Età e sesso sono risolti nel browser dai metadati anagrafici dei 23 giocatori monitorati; l'intervento non introduce chiamate API, letture D1, scritture D1, motori o schedulazioni aggiuntivi.
- Componenti modificati: `v3.html`, `v3.css`, `v3.js`; aggiornati i cache-buster degli asset.
- Validazione: sintassi di `v3.js`, presenza di entrambi i selettori e controllo whitespace Git. Limite noto: per un futuro nuovo giocatore i metadati anagrafici dovranno essere inseriti durante il flusso di aggiunta, altrimenti comparirà soltanto con i filtri impostati su tutti.

## Aggiornamento 14 settembre 2026 — filtri calendario multipli e nascita nel profilo

- Spostati i controlli `Categoria` e `Sesso` nella testata, immediatamente a fianco della scritta `Calendario`.
- La tendina Categoria consente la selezione simultanea di più gruppi tra `U10`, `U12`, `U14`, `U16`, `U18` e `O18`; nessuna selezione equivale a `Tutte`.
- I nomi dei 23 giocatori restano sempre visibili. Quelli esclusi dalla combinazione Categoria/Sesso appaiono deselezionati, mentre calendario e comando seleziona/deseleziona operano esclusivamente sui giocatori visibili per il filtro.
- Nella pagina giocatore l'informazione anagrafica è collocata tra circolo e tessera. Una data ISO completa viene resa, per esempio, come `data di nascita 12 gen 2001`; quando la fonte ufficiale disponibile espone soltanto l'anno, viene mostrato correttamente `anno di nascita 2012`, senza inventare giorno e mese.
- Stato dati: per i giocatori attuali le fonti ufficiali già raccolte certificano l'anno di nascita, non la data completa. Il formatter è pronto a usare automaticamente `birthDate`/`dateOfBirth` non appena una fonte pubblica attendibile fornisce giorno e mese.
- Nessuna chiamata API o operazione D1 aggiunta: filtri e formattazione avvengono nel browser. Motori e schedulazioni invariati.

## Aggiornamento 14 settembre 2026 — selezione libera, navigazione e comandi giocatore

- Corretto l'anno di nascita di Martina Danesi da `2010` a `2009`: il valore precedente era un'inferenza errata dalla categoria U16/ITF, non una data ufficiale, e non deve essere considerato fonte attendibile.
- Categoria e Sesso ora impostano una selezione rapida iniziale. Tutti i nomi restano visibili e ogni giocatore esterno ai gruppi scelti può essere selezionato manualmente; il calendario segue sempre la selezione effettiva dei nomi.
- La tendina multipla Categoria si chiude cliccando fuori dal menu.
- Nella testata Giocatori sono presenti i comandi `+` e `−`, con descrizioni native `Aggiungi giocatore` e `Rimuovi giocatore`; `Altri` resta separato.
- Nella pagina giocatore è stato collocato a destra, alla stessa altezza di `Indietro`, il comando `− Rimuovi giocatore`, sopra il profilo e il contatore delle partite.
- L'apertura di una pagina giocatore porta all'intestazione; la navigazione indietro riporta all'inizio della home, dove l'Agenda è il primo contenuto.
- I comandi di rimozione sono predisposti nell'interfaccia ma non cancellano ancora il registro: la cancellazione persistente richiede il CRUD giocatori previsto nel lavoro dedicato, con conferma esplicita per evitare rimozioni accidentali.
- Nessuna modifica a motori, schedulazioni o accessi D1.

## Aggiornamento 14 settembre 2026 — filtri facilitatori e righe torneo senza partite

- Categoria e Sesso restano scorciatoie per creare una selezione iniziale, non vincoli permanenti. Se viene selezionato manualmente un giocatore escluso dai gruppi attivi, entrambi i controlli anagrafici tornano automaticamente a `Tutte/Tutti` e la selezione manuale viene rispettata.
- Ripristinate le diciture esatte `Seleziona tutti` e `Deseleziona tutti`; il comando opera nuovamente sull'intero elenco e azzera i filtri anagrafici, secondo il comportamento globale precedente.
- Nella pagina giocatore `Rimuovi giocatore` è ora nero, con peso normale e senza il segno meno.
- Nella pagina torneo la freccia di espansione non viene renderizzata accanto a `Iscritto` quando non esistono ancora partite da mostrare; anche l'interazione di espansione viene collegata soltanto alle righe che possiedono partite.
- Cache-buster aggiornati; nessuna modifica a motori, schedulazioni o consumo D1.

## Aggiornamento 14 settembre 2026 — mese calendario e separatori annuali

- Inserita tra i nomi dei giocatori e la legenda FITP/Tennis Europe/ITF un'intestazione centrale con mese e anno del calendario, per esempio `Settembre 2026`.
- L'intestazione usa direttamente `state.month`: resta quindi sincronizzata con Agenda e navigazione mensile senza introdurre uno stato o una richiesta dati separati.
- Nella pagina giocatore, selezionando `Tutti gli anni`, i tornei visibili vengono raggruppati tramite separatori annuali (`2026`, `2025`, ecc.), seguendo lo schema indicato dall'utente. I separatori rispettano anche i filtri circuito, tipo partita ed esito e vengono rimossi quando si seleziona un singolo anno.
- Aggiornati markup, stile, logica client e cache-buster. Nessuna lettura/scrittura D1 aggiuntiva e nessuna modifica ai motori o alle schedulazioni.

### Rifinitura separatore anno

- Aumentata la dimensione dell'anno nei separatori della pagina giocatore da 18 a 26 pixel e spostato l'allineamento sul margine destro, mantenendo invariato il raggruppamento dei tornei.

## Aggiornamento 19 settembre 2026 — comando rimozione e luoghi ITF permanenti

- Conservata l'icona `−` accanto al `+` nella testata della colonna Giocatori. La scritta estesa `Rimuovi giocatore` viene mostrata esclusivamente quando il contenitore di dettaglio visualizza una pagina giocatore ed è esplicitamente nascosta nella pagina torneo, che riusa lo stesso contenitore.
- Sostituita la lista di quattro circoli ITF scritta nel generatore con un registro persistente di metadati ufficiali. Per ogni torneo che contiene un giocatore Court Watch, il ciclo acceptance acquisisce dal fact sheet ufficiale data delle qualificazioni, nome del circolo e indirizzo, completa singolarmente gli eventuali campi mancanti e li include nell'artefatto dello shard.
- Il merge degli shard conserva i metadati in `history/itf_official_metadata.json`; i cicli successivi li riusano anche quando il sito ITF non è momentaneamente leggibile. Il generatore del calendario consulta automaticamente questo registro per tornei storici, correnti e futuri. I workflow live, known-fast, safety e backfill includono il registro nei commit automatici.
- Conservati nel registro i quattro luoghi ITF già verificati in precedenza e il fact sheet completo di J60 Pescara; non sono più eccezioni incorporate nel codice.
- La correzione non aggiunge letture o scritture Cloudflare D1 e non modifica frequenze, trigger o schedulazioni dei motori. Aggiunge l'acquisizione del fact sheet soltanto per un torneo ITF in cui l'acceptance rileva almeno un giocatore monitorato e soltanto quando mancano metadati.
- Validazione: sintassi Node dei componenti modificati, generazione calendario, release guard e verifica della visibilità del comando per route giocatore/torneo. L'audit Cloudflare del periodo corrente deve essere acquisito separatamente dal workflow autenticato prima della stima al 15 ottobre.
- Correzione operativa successiva: il backfill ITF completo non è necessario per valorizzare i luoghi dei soli tornei Court Watch. Tutti i job del workflow completo sono quindi subordinati a `workflow_dispatch`; un push del file genera soltanto un run senza job costosi e, tramite la concorrenza `cancel-in-progress`, interrompe l'esecuzione completa avviata accidentalmente. L'acquisizione dei luoghi resta nel ciclo acceptance dei soli tornei in cui viene riconosciuto un giocatore monitorato.
- Ripulita la dicitura tecnica `View in Google Maps` dagli indirizzi ITF: viene eliminata sia durante l'acquisizione del fact sheet sia in fase di visualizzazione, così sono corretti anche i dati già memorizzati (incluso Bari) senza un backfill globale.
- Le città internazionali ricevute interamente in maiuscolo vengono normalizzate nella visualizzazione del calendario (`BARI` → `Bari`); il dato sorgente resta invariato e la regola vale automaticamente per i prossimi tornei.
- Chiusura regressione J60 Bari: inseriti nel registro persistente i dati del fact sheet ufficiale (qualificazioni 3 ottobre 2026, main draw 5 ottobre, NEW COUNTRY TENNIS ACADEMY A.S.D. c/o COUNTRY CLUB BARI, STRADA SANTA CATERINA 18/G, Bari, Bari, 70124, Italy). Il generatore ora applica dal registro anche `qualificationStartDate` e `officialStartDate`, non soltanto sede e indirizzo; inoltre l'indirizzo ufficiale persistente ha precedenza su copie vuote o obsolete degli shard. I cicli automatici possono aggiornare l'acceptance senza riportare l'inizio al main draw o cancellare l'indirizzo.

## Aggiornamento 19 settembre 2026 — riparazione deploy 1689

- Il run `Deploy CourtWatch #1689` è fallito esclusivamente nello scudo funzionale alla verifica `transizione giornaliera stato torneo`; release guard e preparazione del browser erano verdi, mentre pubblicazione e verifica remota sono state saltate.
- La logica applicativa era già presente in `renderDataSignature` come `today: iso(new Date())`. Il controllo cercava invece la sola forma non formattata `today:iso(new Date())`, producendo un falso rosso dopo la formattazione automatica del sorgente.
- L'asserzione usa ora un'espressione regolare limitata che tollera esclusivamente gli spazi sintattici attorno ai due punti, continuando a richiedere `today`, `iso` e `new Date()` nella firma di rendering. Nessuna logica applicativa, dato sportivo, operazione D1, frequenza o schedulazione è stata modificata.

## Aggiornamento 19 settembre 2026 — riparazione verifica pubblica deploy 1690

- Il run `Deploy CourtWatch #1690` ha superato la pubblicazione degli asset attesi ed è fallito soltanto nello smoke test successivo con `players=0` e `tournaments=0`.
- Lo smoke apre una copia controllata di `v3.html` dopo aver rimosso il redirect verso il Worker protetto. La formattazione automatica aveva disposto su più righe e aggiunto spazi allo script di redirect; l'espressione precedente riconosceva esclusivamente la forma compatta e lasciava quindi attivo il redirect. Il browser di prova finiva sulla pagina protetta anziché sull'app statica da verificare.
- Il riconoscimento tollera ora spazi, righe e virgolette della formattazione corrente, ma resta vincolato al dominio GitHub Pages e alla chiamata `location.replace`. L'applicazione, gli asset pubblicati, i dati sportivi, D1, motori e schedulazioni non sono stati modificati.

## Aggiornamento 19 settembre 2026 — scansione completa motori, override Bari e riparazione D1

- Scansione eseguita sul diagnostico operativo consolidato delle 18:05: FITP catalogo e live verdi; Tennis Europe live, Agenda/OOP e D1 Europe verdi; ITF discovery/R2, labels/R2 e T−1/R2 verdi. La copertura dati certificata comprende 6.015 tornei FITP, 407 iscrizioni FITP abbinate 407/407 tramite tessera, 607 tornei Tennis Europe con 38 conferme, 7 esclusioni, zero pending/inconclusive/errori e 550 snapshot partecipanti, più 6 presenze ITF di cui 2 acceptance correnti. L'acquisizione dei tre circuiti risulta completa secondo i gate disponibili.
- L'unico rosso era `Court Watch Cloudflare D1 and app API #1882`, fermato nello step locale `Check source` prima di migrazioni, import o deploy. Il verificatore UI cercava numerose espressioni JavaScript soltanto nella forma compatta e con virgolette singole, mentre il formatter usa spazi e virgolette doppie. Le verifiche semantiche ora canonicalizzano esclusivamente spazi e stile delle virgolette, mantenendo tutti i marker richiesti e i divieti su prompt/confirm.
- J60 Bari riceve un override manuale persistente `location: Bari, Italy` nel registro ufficiale `history/itf_official_metadata.json`. Il generatore ITF dà precedenza esplicita a tale valore manuale rispetto alla mappa e alle acceptance; anche il calendario pubblicato corrente è stato corretto direttamente. La modifica è limitata al torneo `J-J60-ITA-2026-002`.

## Aggiornamento 19 settembre 2026 — eliminazione del doppio deploy Pages

- Identificata la causa dei timeout ripetuti su `purging_cdn`: il repository usa già la pubblicazione automatica GitHub Pages da `main`, mentre `Deploy CourtWatch` avviava una seconda pubblicazione completa a ogni push. I numerosi commit automatici dei motori producevano quindi deployment concorrenti, cancellazioni e nuove purghe CDN prima del completamento della precedente.
- Il workflow protetto `Deploy CourtWatch` resta disponibile manualmente con release guard, scudo funzionale e smoke test, ma non parte più automaticamente a ogni commit. La pubblicazione automatica ordinaria resta affidata all'unica pipeline nativa `pages build and deployment`, che continua a pubblicare i dati aggiornati da `main`.
- Verificata nello stesso commit la permanenza dell'override manuale `Bari, Italy`, della precedenza del registro ITF nel generatore, del calendario corrente corretto e della riparazione del verificatore D1.

## Aggiornamento 19 settembre 2026 — audit fatturabile e stima al 15 ottobre

- Audit Cloudflare Analytics D1 in sola lettura completato con successo. Dal 1° al 19 settembre il database `courtwatch-app` ha totalizzato 62.182.864.358 righe lette, 72.055.118 righe scritte, 99.758 query di lettura e 52.992 query di scrittura. Questi totali includono i picchi già attribuiti e contenuti del 5–12 settembre e non rappresentano il nuovo regime ordinario.
- Per la proiezione del periodo 15 settembre–15 ottobre sono stati usati i quattro giorni completi successivi al contenimento, 15–18 settembre: media giornaliera 91.024.329 righe lette e 215.398 righe scritte. Proiezione su 31 giorni: circa 2,82 miliardi di letture e 6,68 milioni di scritture.
- Rispetto alle quote mensili D1 già documentate per il piano in uso (25 miliardi di letture e 50 milioni di scritture), la proiezione resta sotto entrambe le soglie. Stima dell'eccedenza variabile D1 al 15 ottobre: **$0**. La stima non include l'eventuale canone fisso del piano Cloudflare né prodotti diversi da D1.
- Il token di audit legge correttamente Analytics e l'elenco dei database, ma l'endpoint account subscriptions risponde HTTP 403. Il periodo 15 settembre–15 ottobre è quindi quello richiesto dal proprietario e la stima usa le quote già certificate nel report; non viene presentata come lettura diretta della fattura o dell'abbonamento.
- Query Insights in sola lettura conferma che i maggiori costi storici residui provengono dalle verifiche integrali multi-tabella e dalla ricreazione ripetuta degli indici. Negli ultimi 31 giorni le quattro creazioni di indice principali censite spiegano circa 553.964 scritture; le scritture applicative ordinarie su dispositivi e analisi sono invece nell'ordine di poche migliaia.
- Audit eseguiti: `Court Watch Cloudflare D1 usage audit #16` e `Court Watch D1 cost audit #5`, entrambi verdi. Nessuna query SQL di scrittura, migrazione, import o modifica delle frequenze è stata eseguita dall'audit.



## Aggiornamento 19 settembre 2026 — caricamento più rapido senza variazioni funzionali

- Le dieci risorse JSON statiche dell'app mantengono gli stessi URL, contenuti, ordine di caricamento, merge e fallback, ma non ricevono più un parametro temporale diverso a ogni richiesta. Il browser usa ora la rivalidazione condizionale `cache: no-cache`: quando il file non è cambiato, può riutilizzare la copia locale dopo la verifica HTTP invece di riscaricarlo integralmente.
- La proiezione privata `/app/api/app-snapshot` resta deliberatamente `cache: no-store` con parametro temporale, così autenticazione e aggiornamento dei dati applicativi non cambiano.
- Restano invariati rendering, aggiornamento automatico ogni 30 secondi, motori FITP/Tennis Europe/ITF, database D1, R2 e schedulazioni. Il beneficio riguarda soprattutto aperture successive e refresh; la prima apertura senza cache deve ancora scaricare i dati completi.
- Cache-buster di `v3.js` aggiornato a `2026091903`. Verifica statica: sintassi JavaScript valida, dieci dataset invariati, API privata ancora no-store e timer di 30 secondi presente.


## Aggiornamento 19 settembre 2026 — anticipo del primo caricamento

- Il documento HTML avvia immediatamente, durante la lettura della testata e prima del download/esecuzione di `v3.js`, il preload CORS dei cinque dataset che rappresentano quasi tutto il peso iniziale: giocatori, tornei, agenda, iscrizioni e risultati.
- La funzione applicativa continua a richiedere gli stessi dieci JSON, ad attendere gli stessi risultati e ad applicare lo stesso merge. Il browser riutilizza le richieste già avviate dal preload: cambiano esclusivamente il momento e la priorità di trasferimento, non dati o comportamento.
- API privata, fallback, cache locale, refresh ogni 30 secondi, motori FITP/Tennis Europe/ITF, D1, R2 e schedulazioni restano invariati. L'intervento riduce anche il primo caricamento senza introdurre nuove chiamate: le cinque richieste anticipate sono le stesse che `load()` avrebbe comunque eseguito poco dopo.


## Aggiornamento 19 settembre 2026 — stabilizzazione delle sorgenti Admin

- La pagina Admin non forza più URL diversi con un timestamp per i sei documenti pubblici: gli URL restano stabili e possono essere riutilizzati.
- Ogni risposta remota valida viene conservata nella Cache API del Worker. Per cinque minuti viene servita direttamente; dopo tale intervallo viene rivalidata e, se GitHub è temporaneamente lento, in errore o oltre il timeout di cinque secondi, viene usata automaticamente l'ultima risposta valida fino a 24 ore.
- Un errore transitorio di GitHub non azzera più i documenti diagnostici e non trasforma le relative spie in gialle. La logica di freschezza interna ai documenti resta invariata: una sorgente realmente non aggiornata continua a essere segnalata in base al proprio `generatedAt`.
- Nessuna modifica a motori, acquisizione, dati applicativi, D1, R2 o schedulazioni. Le chiamate remote dell'Admin diminuiscono e il caricamento della pagina risulta più stabile.


## Aggiornamento 19 settembre 2026 — stato Copertura basato sui problemi operativi

- Lo stato complessivo della sezione Admin “Copertura” considera ora esclusivamente i controlli marcati come critici. Indicatori informativi o legacy non possono più abbassare da soli lo stato generale.
- La mancanza dell'indirizzo nel JSON statico FITP è trattata come avviso informativo quando iscrizione, identificativo P.U.C., torneo e sorgente ufficiale sono presenti; non rende più giallo il controllo critico Calendario, perché l'app può già mostrare il dato aggiornato proveniente dalla proiezione D1.
- Restano gialli o rossi i problemi evidenti sui controlli critici: motore non aggiornato, soglie di copertura non rispettate, errori di acquisizione, identificativi ufficiali mancanti o sorgenti essenziali incomplete.
- Aggiornati anche gli artefatti diagnostici correnti; la regola è permanente nelle generazioni successive. Nessuna modifica a dati sportivi, motori di acquisizione, D1, R2 o schedulazioni.


## Aggiornamento 19 settembre 2026 — stati motore Admin uniformati

- La riga FITP dell'Admin mostra ora il valore sintetico `green` quando il documento è recente, lo stato sorgente dichiara completezza e non contiene errori. La descrizione tecnica `fitp_entries_complete_from_versioned_participant_cache` resta nel dato sorgente e non viene alterata.
- La riga ITF passerà automaticamente a `green` soltanto quando il sistema è certificato, il documento è recente, gli errori sono zero e risultano zero pubblicazioni e zero problemi tecnici pendenti nei controlli T−1.
- Finché ITF dichiara tabelloni ufficiali non ancora pubblicati, l'Admin conserva lo stato descrittivo corrente. Nessun colore viene forzato e un problema reale continua a impedire il verde.
- Nessuna modifica ai motori, ai dati sportivi, a D1, R2 o alle schedulazioni; cambia esclusivamente la normalizzazione del testo mostrato nell'Admin.


## Aggiornamento 19 settembre 2026 — lettura corretta ITF 120 giorni e watchdog

- L'Admin interroga ora l'endpoint GitHub dedicato del workflow `courtwatch-v3-itf-safety-120d.yml`; il run giornaliero non dipende più dalla finestra degli ultimi 50 run globali e non appare “non disponibile” soltanto perché altri workflow lo hanno fatto uscire dall'elenco.
- La riga del watchdog è stata rinominata `Deploy watchdog Cloudflare`: la data mostrata è correttamente la data dell'ultima pubblicazione del Worker e della sua configurazione cron, non l'ultima esecuzione pianificata.
- L'operatività sorvegliata continua a essere rappresentata dalle righe dei workflow FITP, Tennis Europe e ITF effettivamente controllati dal watchdog. Un deploy vecchio ma verde non viene più presentato come watchdog fermo.
- Nessuna modifica alle frequenze, ai motori, ai dati sportivi, a D1 o R2; cambia soltanto l'origine e il significato delle informazioni mostrate nell'Admin.


## Aggiornamento 19 settembre 2026 — scaglionamento watchdog per circuito

- Le frequenze live restano identiche, una volta ogni 15 minuti, ma i dispatch non partono più tutti contemporaneamente: ITF ai minuti 00/15/30/45, Tennis Europe ai minuti 05/20/35/50 e FITP ai minuti 10/25/40/55.
- I controlli di manutenzione D1 e sicurezza ITF 120 giorni restano ogni 10 minuti e sono spostati ai minuti 03/13/23/33/43/53, separandoli dai dispatch principali.
- La protezione contro duplicati nello stesso quarto d'ora, i controlli sui run già attivi e le frequenze di acquisizione restano invariati. Lo scaglionamento riduce la concorrenza simultanea su GitHub Actions, rete e R2 senza diminuire la copertura.
- Aggiornati i test del watchdog per certificare l'esatta appartenenza dei workflow ai tre gruppi e la permanenza dei controlli di manutenzione.


## Aggiornamento 19 settembre 2026 — diagnostica applicativa coerente con le pipeline autorevoli

- `Agenda legacy` non è più gialla per definizione: segue lo stato fresco e congiuntamente verde di `Agenda/OOP Europe` e `D1 agenda Europe`, che sono le pipeline autorevoli usate dall'app.
- `Risultati` non richiede più che il file legacy cambi entro 45 minuti. Verifica che il documento sia strutturalmente valido e che la pipeline Agenda/OOP + D1 sia operativa; l'assenza di nuovi risultati non viene confusa con un motore fermo.
- `Avversari` considera valido un array vuoto quando il numero di record da completare è zero. Diventa giallo soltanto se il documento non è valido o contiene record incompleti.
- I workflow operativi restano controllati separatamente e una loro anomalia rende ancora gialle le righe applicative collegate. Nessun dato, motore, database o schedulazione è stato modificato.


## Aggiornamento 19 settembre 2026 — avversario Tennis Europe ancora da definire

- Il parser dell’ordine di gioco Tennis Europe non scarta più una partita programmata quando è pubblicato un solo partecipante: la riga viene acquisita come incontro singolare con avversario pendente.
- In Agenda e nel dettaglio partita viene mostrato `Avversario da definire`. La dicitura `Possibili: Nome A / Nome B` compare soltanto se la pagina ufficiale associa senza ambiguità una riga con il giocatore noto e una riga con esattamente due candidati; in caso contrario non vengono formulate ipotesi.
- Ogni riga pendente usa l’identità ufficiale dello slot (torneo, data, campo e numero d’ordine). Nell’import incrementale, un record successivo dello stesso slot elimina quello precedente prima dell’inserimento: quando il vincitore viene pubblicato resta una sola partita con l’avversario effettivo.
- Adeguati il generatore D1 e i controlli di parità per accettare l’avversario vuoto soltanto quando la sorgente lo marca esplicitamente come pendente. Gli incontri completi continuano a richiedere l’avversario e un’anomalia reale resta rossa.


## Aggiornamento 19 settembre 2026 — incontri fra giocatori CourtWatch e intestazione avversario

- L’Agenda deduplica ora tutte le proiezioni Tennis Europe che condividono lo stesso identificativo ufficiale di partita, non soltanto i doppi. Se due giocatori CourtWatch si affrontano, la vista generale mostra una sola scheda; il record ufficiale resta unico e le due prospettive personali restano disponibili nei rispettivi storici.
- Il nome mostrato come avversario viene confrontato con il registro CourtWatch. Se appartiene a un giocatore seguito, usa lo stesso stile in grassetto e lo stesso collegamento alla pagina CourtWatch completa; non viene aperta la pagina avversario limitata.
- Per un avversario non seguito, il nome in Agenda è cliccabile e apre la nuova route dedicata. La prima intestazione contiene nome, nazionalità e ranking Tennis Europe fotografato per la partita, accompagnato dalla data della pubblicazione ranking.
- La API applicativa espone ora insieme al ranking anche `profile_id` e `ranking_date` degli snapshot già presenti in D1. Non vengono introdotte nuove scansioni o riscritture massive.
- La pagina avversario non usa avatar né iniziali: tali elementi restano esclusivi dei giocatori CourtWatch. È predisposta la sezione «Stato di forma — Ultimi 5 tornei», che verrà popolata dal relativo storico limitato.


### Rifinitura Agenda — gerarchia avversari e vincitore esplicito

- Il nome di un avversario non CourtWatch resta cliccabile ma usa peso normale e la dimensione secondaria della riga «vs»; il grassetto non viene più applicato agli avversari esterni.
- Quando l’avversario è anch’esso CourtWatch, il suo nome riceve la stessa dimensione e lo stesso peso del giocatore CourtWatch mostrato sopra. Entrambi restano collegati alle rispettive pagine complete.
- Per una sfida conclusa fra due giocatori CourtWatch, la scheda unica e neutrale non mostra più il solo punteggio dalla prospettiva del primo record: indica `Vincitore: Nome Cognome · Risultato: punteggio`, usando il campo autorevole `advances` della proiezione della partita.
- Per tutti gli altri incontri il formato del risultato resta invariato. La modifica non cambia acquisizione, D1, motori o schedulazioni.


### Rifinitura intestazione pagina avversario

- L’intestazione della pagina avversario è ora una sola riga non spezzata: nome, nazionalità e ranking con data della pubblicazione. Sugli schermi stretti resta su un’unica riga ed è scorribile orizzontalmente, senza introdurre avatar o iniziali.
- Il ranking specifica `TE U14` oppure `TE U16`. La categoria proviene dallo snapshot D1; il codice evento viene usato soltanto come fallback quando lo snapshot storico non espone ancora la categoria.
- Nella pagina avversario il comando della testata diventa `Segui giocatore`. Aprendo una pagina CourtWatch torna automaticamente a `Rimuovi giocatore`; nella pagina torneo resta nascosto.
- La API include ora la categoria dello stesso snapshot che fornisce ranking e data. Nessuna nuova scansione, riscrittura massiva o modifica alle schedulazioni.


### Navigazione pagina avversario da tutte le viste e per i compagni di doppio

- La pagina avversario è ora raggiungibile cliccando il partecipante nell’Agenda, nella pagina del torneo e nella pagina del giocatore CourtWatch.
- La stessa pagina limitata viene usata anche per un compagno di doppio non CourtWatch. Il link conserva il ruolo (`opponent` o `partner`), l’identità Tennis Europe, la partita e l’indice del partecipante, così intestazione, nazionalità e snapshot ranking vengono letti dai campi corretti.
- Se avversario o compagno è già CourtWatch, il link continua ad aprire direttamente la pagina CourtWatch completa.
- La proiezione espone anche l’identificativo sorgente del compagno come fallback; non vengono aggiunte acquisizioni, scansioni complete o riscritture D1.


### Rifinitura visiva nazionalità e data ranking avversario

- Nell’intestazione su una sola riga, codice nazionalità e bandiera usano ora la stessa scala tipografica del nome del giocatore; la bandiera è dimensionata proporzionalmente e resta allineata al testo.
- La data dello snapshot è mostrata nel formato `(ranking del …)` accanto a posizione e categoria U14/U16.
- Il ranking e la relativa data hanno `font-style: normal` esplicito e non possono ereditare il corsivo.
- Restano in vigore: avversario esterno a peso normale; avversario CourtWatch con stessa dimensione e grassetto del primo giocatore; vincitore nominato esplicitamente nelle sfide CourtWatch concluse; formato invariato negli altri incontri.

- Precisazione visiva: il compagno di doppio resta in grassetto anche quando non è CourtWatch; il clic apre comunque la pagina avversario limitata.

- Correzione terminologica richiesta: ranking e data usano peso normale, quindi non sono in grassetto; il compagno di doppio resta invece in grassetto.


## Aggiornamento 19 settembre 2026 — fotografia avversario e ultimi cinque tornei

- La pagina avversario è una fotografia temporale: la route conserva la partita di origine e la richiesta dello storico usa la data di quella partita come limite `asOf`. Ranking dell’intestazione, tornei e partite successive non possono modificare retroattivamente la fotografia.
- Se lo stesso avversario viene incontrato tre mesi dopo, il nuovo link porta una nuova partita e una nuova data `asOf`; la pagina mostra quindi la fotografia aggiornata al secondo incontro, mentre il collegamento precedente resta congelato.
- L’API protetta legge da D1 le partite Tennis Europe del partecipante non successive alla fotografia, raggruppa i cinque tornei più recenti disponibili e calcola lo stato di forma sulle partite concluse mostrate. Non vengono acquisiti o mostrati tornei futuri.
- L’intestazione della scheda storico mostra ora `Ultimi 5 tornei` a sinistra e `Stato di forma: V · S` a destra.
- Ogni partita occupa una sola riga orizzontale con data, avversario, nazionalità e bandiera, ranking più data dello snapshot, turno ed esito/punteggio. Su schermi stretti la riga resta unica e il contenitore scorre orizzontalmente.
- Corretto l’allineamento verticale della bandiera grande nell’intestazione mediante contenitori flex con altezza e linea comuni al nome.


### Rifinitura righe storico avversario e collegamenti ai tabelloni

- La data della singola partita non viene più mostrata nella riga: la prima colonna contiene il turno.
- Il ranking degli avversari incontrati nello storico resta quello selezionato internamente alla data della partita, ma non mostra più tra parentesi la data della classifica.
- Ogni nominativo incontrato è preceduto da `vs`.
- Accanto al nome del torneo vengono mostrate le etichette evento effettivamente disputate dall’avversario, per esempio `GS14`; quando il match contiene il collegamento ufficiale al draw, l’etichetta apre direttamente quel tabellone in una nuova scheda.
- La riga unica contiene ora turno, avversario con nazionalità/bandiera/ranking e risultato.


### Pagina avversario come studio pre-partita

- La partita CourtWatch dalla quale viene aperta la pagina è ora esclusa esplicitamente tramite `excludeMatchId`. Restano visibili soltanto gli incontri precedenti o, nella stessa data, gli altri incontri già presenti: la scheda serve a studiare l’avversario prima del match considerato.
- Per una partita futura la pagina viene resa disponibile automaticamente appena il match entra in Agenda, perché il collegamento nasce dalla stessa proiezione Agenda; lo storico viene limitato alla data del match ed esclude il match stesso.
- Le righe risultato non mostrano più `V` o `S`: riportano soltanto il punteggio. Lo stato di forma aggregato continua a indicare vittorie e sconfitte.
- Il ranking resta visibile quando disponibile, senza data. Se manca, lo spazio viene omesso completamente e non appare alcuna dicitura sostitutiva.
- Il nome del torneo apre la homepage ufficiale Tennis Europe; le etichette evento continuano ad aprire i rispettivi tabelloni.
- La colonna del turno è stata ampliata a 160 pixel, con separazione di 24 pixel prima dell’avversario ed ellissi di sicurezza, eliminando sovrapposizioni.


### Orientamento punteggio, ranking e turni nello studio avversario

- Il punteggio dello storico viene normalizzato dalla prospettiva del giocatore studiato: se occupava la seconda squadra nel dato ufficiale, ciascun set viene invertito. Il suo numero è quindi sempre a sinistra, indipendentemente da vittoria o sconfitta.
- Il turno non viene più troncato: la colonna usa larghezza minima di 190 pixel espandibile, nessuna ellissi e 28 pixel di separazione dall’avversario. Le diciture round robin, group stage o RR vengono sintetizzate in `RR`.
- Se lo snapshot specifico della partita non contiene il ranking, l’API cerca nello storico Tennis Europe la pubblicazione più recente non successiva alla data del match, privilegiando la stessa categoria B/G U14/U16. Il ranking torna quindi visibile sia nell’intestazione sia accanto agli avversari incontrati quando esiste una pubblicazione ufficiale applicabile.
- Per gli incontri futuri, il link alla pagina avversario è disponibile automaticamente appena il match compare in Agenda; la pagina esclude il match futuro e mostra esclusivamente il materiale precedente.


### Vincitore a sinistra, RR e stato di forma grafico

- Il punteggio viene ora orientato sulla squadra vincente: il vincitore è sempre il lato sinistro di ogni set, indipendentemente dalla prospettiva del giocatore studiato.
- Il riconoscimento round robin comprende RR, round robin, group, girone e pool. La sigla `RR` viene applicata sia alle righe della pagina avversario sia tramite `agendaRoundCode` nelle pagine dei giocatori CourtWatch.
- Il recupero ranking degli altri partecipanti usa sia il nome normalizzato sia il profile ID Tennis Europe; resta vincolato alla pubblicazione non successiva alla partita e alla categoria corretta quando disponibile.
- Lo stato di forma è nero; vittorie e sconfitte sono mostrate in due cerchi separati, rispettivamente verde e rosso.
- Nei doppi lo storico include il compagno del giocatore studiato e rende la formazione come `con [compagno] vs [avversario 1] / [avversario 2]`, includendo nazionalità, bandiera e ranking disponibili.



## Aggiornamento 20 settembre 2026 — designazioni tabellone e condizioni campo

- Corretto il riconoscimento trasversale delle designazioni dei partecipanti: testa di serie numerica, `WC` e `Q` vengono ora lette anche dagli alias sorgente `entryType`, `seed`, `seedNumber`, `seeding`, `wildCard` e `qualifier`, compresi i corrispondenti array per avversari e compagni di doppio.
- L'ordine visivo resta nome, designazione, nazionalità/bandiera e ranking in Agenda, pagina giocatore, pagina torneo e pagina avversario. Se la fonte ufficiale non pubblica una designazione, l'app non ne inventa una.
- Superficie e ambiente Indoor/Outdoor sono ora esposti non soltanto nella pagina torneo, ma anche nelle intestazioni torneo di Agenda e pagina giocatore; lo storico avversario li mostra quando lo snapshot del torneo li possiede.
- La normalizzazione delle iscrizioni accetta anche `courtSurface`, `playingSurface`, `courtEnvironment` e i flag booleani `indoor`/`outdoor`, oltre ai campi già supportati.
- Incrementata la versione dell'asset `v3.js` a `2026092017` per impedire che dispositivi già registrati continuino a usare una copia precedente. Non sono state modificate schedulazioni, selezione giocatori, punteggi o logica di navigazione.


### Correzione definitiva metadati e stabilità pagina avversario

- La pagina avversario non viene più ricostruita dal refresh generale ogni 30 secondi: la route attiva resta stabile e lo storico viene richiesto una sola volta per combinazione giocatore/data/match escluso, con cache in memoria e deduplicazione delle richieste simultanee.
- Le teste di serie Tennis Europe vengono ora acquisite dalla pagina ufficiale `Seeded entries`, associandole a giocatore ed evento; `Q` e `WC` vengono acquisiti dalle righe ufficiali dell'acceptance list e trasferiti ai partecipanti dei match.
- Superficie e Indoor/Outdoor vengono letti dal markup realmente pubblicato nel factsheet (`Court surface boys/girls`, `Location type`) e dal valore accanto all'icona campo, inclusa la grafia ufficiale `Acryllic`.
- Aggiunta una verifica deterministica delle varianti HTML ufficiali. La modifica resta limitata a Tennis Europe; FITP e ITF non sono stati modificati.


## Aggiornamento 21 settembre 2026 — etichetta Agenda e identità torneo nel calendario

- Nell'Agenda l'etichetta del circuito Tennis Europe riporta ora nello stesso badge anche superficie e ambiente, per esempio `TENNIS EUROPE · Clay · Outdoor`. Le condizioni non vengono duplicate sotto il nome del torneo.
- Quando Tennis Europe non pubblica superficie e ambiente, il badge indica esplicitamente `SUPERFICIE/AMBIENTE NON PUBBLICATI`; non viene attribuito un valore inventato.
- Nel calendario i tornei Tennis Europe usano prioritariamente il nome ufficiale `tournamentName`/`searchTournamentName`, anziché il nome del circolo eventualmente presente nel campo generico `name`.
- La seconda riga del calendario continua a mostrare città e nazione, seguite dai giocatori Court Watch. Il circolo resta disponibile nella pagina torneo e nell'indirizzo, ma non sostituisce più il nome della competizione.
- Verifica sui dati pubblicati: 539 tornei su 608 espongono superficie e ambiente; i 69 rimanenti sono tutti contrassegnati dalla fonte come `qualifying_date_not_published` e le pagine ufficiali controllate non pubblicano condizioni del campo. La pipeline continuerà a recuperarli automaticamente quando Tennis Europe li renderà disponibili.
- Incrementata la versione dell'asset `v3.js` a `2026092102`. Nessuna modifica a FITP, ITF, database, punteggi o selezione giocatori.


### Rifinitura posizione condizioni campo in Agenda

- Superficie e ambiente non sono più incorporati nel badge arancione `TENNIS EUROPE`: vengono mostrati in un badge neutro separato, immediatamente alla sua destra, sia nella vista per circuito sia nella vista cronologica.
- Il contenuto resta quello ufficiale già acquisito; quando non è pubblicato continua a comparire l'avviso esplicito, senza valori inventati.
- Verificati sintassi del client e rendering delle due varianti di intestazione Agenda. Versione dell'asset incrementata a `2026092103`; nessuna modifica a dati, motori, database, FITP o ITF.


### Correzione ambiente già presente nel nome torneo

- Il badge condizioni dell'Agenda mostra sempre sia superficie sia Indoor/Outdoor, anche quando l'ambiente compare già nel nome ufficiale del torneo. `Bad Waltersdorf 2026 - Indoor` viene quindi visualizzato correttamente come `Carpet · Indoor`, non più come il solo `Carpet`.
- La soppressione delle ripetizioni nel testo descrittivo delle altre viste resta invariata. Verificata la regressione specifica con i dati pubblicati di Bad Waltersdorf; asset aggiornato a `v3.js?v=2026092104`.


### Calendario Tennis Europe senza nome del circolo

- La seconda riga delle bande Tennis Europe nel calendario elimina il `venueName` iniziale dalla località ufficiale e mostra esclusivamente città e nazione. Per i due nuovi tornei di Virginia Cereghini, i valori verificati sono `Telde (Las Palmas), Spain` e `Meneou Larnaka, Cyprus`.
- Il nome ufficiale del torneo resta nella prima riga. Acceptance list, sigle live, posizioni, `Q`, `WC` e teste di serie non sono state modificate. Asset aggiornato a `v3.js?v=2026092105`.


## Aggiornamento 22 settembre 2026 — designazioni complete e ritorno alla posizione

- Il motore OOP Tennis Europe distingue ora le teste di serie del main draw da quelle delle qualificazioni usando insieme codice evento e fase ufficiale. La pagina `Seeded entries` viene letta anche quando la tabella non usa la classe CSS storica `seeding`.
- Le designazioni ufficiali `Q`, `WC` e il nuovo caso `LL` vengono acquisite sia dai badge accanto al partecipante sia dalle righe dell'acceptance list, comprese le diciture estese `Qualifier`, `Wild Card` e `Lucky Loser`. La propagazione resta partecipante-specifica attraverso OOP live, storico, D1 e UI; le etichette live dell'acceptance list non sono state modificate.
- Aggiunti test deterministici distinti per testa di serie main draw, testa di serie qualificazioni, `Q`, `WC` e `LL`, oltre alle varianti già coperte.
- La navigazione interna conserva per 15 secondi la posizione verticale della pagina appena lasciata. Aprendo un profilo, torneo o avversario e tornando indietro entro tale finestra, la vista precedente viene ripristinata allo stesso punto; una navigazione successiva o più tarda continua ad aprire la destinazione dall'alto.
- Asset aggiornato a `v3.js?v=2026092201`. Nessuna modifica alle frequenze dei motori, alla selezione giocatori o alle sigle live dell'acceptance list.


### Turno completo nello storico avversario

- Nella pagina avversario il turno occupa una colonna autonoma dimensionata sul testo completo: non si sovrappone più ai giocatori e non viene più abbreviato con puntini di sospensione.
- La colonna risultato resta separata e allineata a destra; sui display stretti è il nome dell'avversario a usare lo spazio residuo, senza alterare dati o designazioni.
- Cache CSS aggiornata a `v3.css?v=2026092202`. Nessuna modifica alle sigle live dell'acceptance list.


### Ranking datato nell'intestazione avversario

- L'intestazione della pagina avversario non dipende più esclusivamente dallo snapshot già allegato alla partita cliccata: l'API restituisce anche il ranking Tennis Europe storico più recente non successivo alla data della partita.
- La categoria dell'evento cliccato seleziona prioritariamente `U14` o `U16`; l'intestazione mostra numero, categoria e data della pubblicazione della classifica.
- Il fallback funziona anche quando l'avversario non possiede tornei precedenti da elencare. Asset aggiornato a `v3.js?v=2026092203`; nessuna modifica alle sigle live dell'acceptance list.


### Designazioni acquisite dai tabelloni ufficiali

- Il motore OOP apre ora ogni tabellone ufficiale collegato alle partite e legge accanto al partecipante teste di serie, `WC`, `Q` e `LL`; il dato del tabellone ha priorità sui fallback `Seeded entries` e acceptance list.
- La chiave evento/fase distingue il main draw dalle qualificazioni, quindi una testa di serie del tabellone di qualificazione non viene confusa con la testa di serie del main draw.
- Le designazioni vengono propagate ai partecipanti delle partite e quindi ad Agenda, pagina giocatore, pagina torneo e pagina avversario. Aggiunti test deterministici per tutti i casi; nessuna modifica alle sigle live dell'acceptance list.


### Badge evento e condizioni campo nello storico avversario

- I badge evento `GS`, `GD`, `BS` e `BD` della pagina avversario riutilizzano le stesse classi colore rosa/blu dell'Agenda e mantengono il collegamento al tabellone ufficiale.
- L'API dello storico avversario trasferisce superficie e ambiente dal payload ufficiale del torneo, anche quando il torneo non appartiene al calendario di alcun giocatore Court Watch.
- L'interfaccia usa prima l'eventuale torneo Court Watch corrispondente e poi il metadato autonomo dello storico, mostrando insieme superficie e Indoor/Outdoor. Asset aggiornato a `v3.js?v=2026092204`.


### Home a tre sezioni dedicate

- La pagina iniziale presenta tre grandi accessi, nell'ordine `Giocatori`, `Calendario`, `Agenda`, adattati in colonna sui display stretti.
- `Giocatori` apre una griglia di avatar iniziali e conserva l'accesso alla pagina completa di ciascun giocatore; `Calendario` e `Agenda` aprono le rispettive viste già esistenti in pagine dedicate.
- Logo Court Watch e avatar dell'utente restano nell'intestazione comune a tutte le viste. Nessuna modifica ai dati, ai motori, alle classifiche, alle designazioni o alle sigle live dell'acceptance list.
- Asset aggiornati a `v3.css?v=2026092206` e `v3.js?v=2026092206`.


### Navigazione rapida e riepilogo settimanale Agenda

- Fuori dalla home, il pulsante centrale `Home` viene sostituito dai tre accessi rapidi a `Giocatori`, `Calendario` e `Agenda`; logo e avatar restano invariati.
- In Agenda, quando la data selezionata non è oggi, compare un pulsante `Oggi` separato che riporta immediatamente alla giornata corrente.
- Sopra l'Agenda è disponibile l'icona `Tornei della settimana`, che apre l'elenco dei tornei compresi nella settimana visualizzata e dei relativi giocatori Court Watch iscritti.
- La modifica usa esclusivamente i dati già caricati e non cambia motori, frequenze, classifiche, designazioni o sigle live dell'acceptance list. Asset aggiornati a `v3.css?v=2026092207` e `v3.js?v=2026092207`.


### Righe partita uniformate allo storico avversario

- Le partite nelle pagine giocatore e torneo adottano la struttura a colonne della pagina avversario: data e turno, tipo e avversario, risultato.
- Restano presenti tutti i dati già mostrati, inclusi compagno di doppio, designazioni, nazionalità, risultato e accesso all'analisi della partita.
- Il comando `Tornei della settimana` è ora allineato a sinistra sopra l'Agenda. La memoria della posizione per il ritorno Indietro entro 15 secondi resta invariata.
- Asset aggiornati a `v3.css?v=2026092208` e `v3.js?v=2026092208`; nessuna modifica alle sigle live dell'acceptance list.


### Contatori torneo e ritorno dal logo

- I contatori delle partite nei singoli tornei leggono ora le nuove righe uniformate, ripristinando i valori di giocate, vinte e perse dopo il cambio grafico.
- Logo e nome `Court Watch` sono cliccabili da ogni ambiente e riportano alla home senza alterare filtri o dati.
- Asset aggiornati a `v3.css?v=2026092209` e `v3.js?v=2026092209`; nessuna modifica alle sigle live dell'acceptance list.


### Condizioni dei tornei avversari e righe settimanali

- Rimossa l'etichetta centrale `Home`: il ritorno alla home resta affidato al logo e al nome `Court Watch`.
- Lo storico avversario recupera superficie e ambiente dal catalogo ufficiale Tennis Europe completo quando il torneo non appartiene alla proiezione dei giocatori Court Watch; il catalogo è riutilizzato dalla cache edge per non moltiplicare le richieste.
- `Tornei della settimana` mostra ora un elenco ordinato cronologicamente a righe, con circuito, torneo, luogo e giocatori iscritti.
- Asset aggiornati a `v3.css?v=2026092301` e `v3.js?v=2026092301`; nessuna modifica alle sigle live dell'acceptance list.


### Gruppi singolare/doppio e ranking Tennis Europe correnti

- Le pagine giocatore, torneo e avversario dividono le partite di ciascun torneo in `Singolare` e in uno o più gruppi `Doppio con [compagno]`, mantenendo turno, avversari, designazioni, nazionalità, punteggio e analisi.
- Nei tornei Tennis Europe programmati della pagina giocatore la sigla già acquisita è preceduta dall'etichetta `Acceptance list:`; il valore live non viene modificato.
- Il ranking corrente della pagina giocatore risolve anche i nomi pubblicati da Tennis Europe nell'ordine `Cognome Nome`, mentre Court Watch usa `Nome Cognome`. La sincronizzazione ufficiale resta invariata e continua a fornire il valore più recente per categoria.
- Asset aggiornati a `v3.css?v=2026092302` e `v3.js?v=2026092302`; nessuna modifica alle sigle live dell'acceptance list.


### Profilo avversario corrente e navigazione ricorsiva

- La pagina avversario non è più limitata alla data della partita cliccata: mostra l'ultima classifica disponibile alla data odierna e gli ultimi cinque tornei disputati fino a oggi, includendo tutte le relative partite.
- Dentro ogni partita storica, ranking e nazionalità dei partecipanti continuano a provenire dallo snapshot congelato alla data dell'incontro.
- Ogni avversario o compagno non Court Watch nello storico è cliccabile e apre a sua volta il profilo corrente; la navigazione può proseguire senza limiti tra avversari successivi. I giocatori Court Watch continuano ad aprire il profilo Court Watch completo.
- Lo stato di forma riferito alla vecchia data di studio è sostituito dall'indicazione della data corrente del profilo. Il ritorno Indietro con ripristino della posizione resta invariato.
- Asset aggiornati a `v3.css?v=2026092303` e `v3.js?v=2026092303`; nessuna modifica alle sigle live dell'acceptance list.


### Classifica Europe live e accesso futuro ad Altri

- La classifica Tennis Europe nell'intestazione giocatore sceglie ora, per ciascuna categoria, il record con la data più recente anche quando esistono più profili o alias associati.
- Le righe delle partite non ripetono più `Singolare` o `Doppio con`: l'informazione è già esposta dalla relativa mini-intestazione.
- Sono state predisposte, ancora inattive, le etichette `Altri` accanto a `Tornei della settimana` e al filtro `Sesso`, oltre a `Vai a Altri` nella testata della home.
- Asset aggiornati a `v3.css?v=2026092304` e `v3.js?v=2026092304`; nessuna modifica alle sigle live dell'acceptance list.


### Profili avversario precaricati e stabili

- Rimossa dalla pagina avversario la scritta `Aggiornato al ...`; resta visibile soltanto la data propria della classifica, quando disponibile.
- I profili collegati nella pagina visibile vengono precaricati in background e condividono richiesta e cache: al clic i dati già disponibili vengono mostrati immediatamente, anche proseguendo verso gli avversari degli avversari.
- Durante una pagina avversario l'aggiornamento periodico generale viene sospeso e un eventuale caricamento già avviato non forza un nuovo rendering della pagina.
- Asset aggiornati a `v3.css?v=2026092305` e `v3.js?v=2026092305`; nessuna modifica alle sigle live dell'acceptance list.


### Ranking giocatore diretto e turni uniformi

- La pagina giocatore interroga ora direttamente D1 tramite `/app/api/player-ranking` a ogni apertura e seleziona la data più recente per ciascuna categoria Tennis Europe, senza dipendere dal ranking incorporato nello snapshot generale.
- Pagina giocatore, pagina torneo e pagina avversario condividono la stessa struttura di riga e mostrano il turno per esteso come testo, non come badge.
- I turni di qualificazione basati sulla dimensione del tabellone vengono convertiti in `Qualification round 1`, `Qualification round 2` e successivi.
- `Altri` e `Vai a Altri` usano esattamente la classe grafica `playersHeaderAction` già presente nell'ambiente Giocatori e restano per ora privi di azione.
- Asset aggiornati a `v3.css?v=2026092306` e `v3.js?v=2026092306`; nessuna modifica alle sigle live dell'acceptance list.


### Riparazione una tantum della parità D1

- Dopo il deploy del ranking diretto, il run D1 `35811364336` ha fallito la verifica di parità mentre il ripristino e la ricostruzione di `observed_players` erano stati saltati dal percorso rapido.
- Il workflow riconosce ora un commit con prefisso `Repair D1 observed index` e forza per quel solo run la ricostruzione completa; i run ordinari successivi conservano il percorso rapido.
- Il workflow storico ranking ricevuto tramite `workflow_run` resta intenzionalmente saltato salvo una sincronizzazione ufficiale dei giocatori; l'aggiornamento corrente delle classifiche è gestito dal workflow dedicato `courtwatch-tennis-europe-rankings.yml`.


### Stabilità profilo avversario e ricerca globale giocatori

- Il prefetch massivo dei profili avversari è stato rimosso: rimane soltanto il precaricamento mirato su hover, focus o primo tocco, con richieste concorrenti condivise.
- Il caricamento dello storico ha un limite di 15 secondi e offre `Riprova` in caso di errore; la route `#opponent-profile` viene renderizzata anche prima dello snapshot generale, quindi il refresh manuale conserva la pagina avversario.
- Nell'ambiente Giocatori, accanto al totale, è disponibile la ricerca D1 per nome, cognome o frammento. I suggerimenti aprono direttamente il profilo; Invio apre una pagina completa con tutti i risultati trovati.
- I giocatori Court Watch aprono la pagina giocatore completa; gli altri risultati aprono la pagina avversario.
- Asset aggiornati a `v3.css?v=2026092307` e `v3.js?v=2026092307`; nessuna modifica alle sigle live dell'acceptance list.


### Ranking immediato, turni Bonus e prefetch avversari limitato

- L'ultimo ranking Tennis Europe live ricevuto per ciascun giocatore Court Watch viene conservato localmente e mostrato già al primo rendering della pagina; la richiesta D1 continua in background ad aggiornarlo. La data tra parentesi non viene mostrata nella pagina giocatore.
- Nei tabelloni `Bonus draw` il turno completo è preceduto da `Bonus`, per esempio `Bonus Round of 16`, `Bonus Quarter final` e `Bonus Semi final`.
- Le pagine avversario collegate vengono precaricate in una coda con massimo due richieste concorrenti e mantenute nella cache di sessione. Il caricamento diretto del profilo cliccato conserva la priorità.
- Asset aggiornati a `v3.css?v=2026092308` e `v3.js?v=2026092308`; nessuna modifica alle sigle live dell'acceptance list.

### Ranking sempre visibile e profili avversari pronti

- La pagina giocatore conserva il ranking Tennis Europe già noto anche se una richiesta live restituisce temporaneamente zero righe; l'endpoint riconosce inoltre i nomi invertiti senza dipendere esclusivamente dall'alias Court Watch.
- La cronologia avversari non esegue più scansioni D1 con `LIKE '%token%'` e `lower(profile_id)`: usa lookup esatti indicizzati per nomi e profili, riducendo timeout e consumo CPU.
- I profili avversari preparati sono conservati in cache persistente, renderizzati prima della richiesta di aggiornamento e non vengono più sostituiti da uno stato di errore. Il testo `Caricamento storico…` è stato rimosso.
- Il prefetch resta limitato ma prepara fino a sei profili contemporaneamente. Le sigle live dell'acceptance list non sono state modificate.
- Asset aggiornati a `v3.css?v=2026092309` e `v3.js?v=2026092309` per impedire che il browser riutilizzi il JavaScript precedente.

### Persistenza del profilo avversario al refresh

- L'ultimo profilo avversario aperto viene salvato separatamente dalla cache generale e ripristinato sincronicamente prima di qualunque richiesta API: un refresh manuale non svuota più intestazione, ranking, tornei o partite.
- La cache generale conserva fino a venti profili per lasciare sempre spazio alla copia protetta del profilo attivo; l'aggiornamento di rete avviene soltanto dopo il rendering dei dati salvati.
- Asset aggiornati a `v3.css?v=2026092310` e `v3.js?v=2026092310`; nessuna modifica alle sigle live dell'acceptance list.

### Completezza avversari Tennis Europe e controllo costi Cloudflare

- Le pagine avversario interrogano lo storico con la data corrente (`asOf`) e usano una chiave cache giornaliera: a ogni nuova giornata consultano l'archivio aggiornato, mentre ranking e partite vengono alimentati dai workflow Tennis Europe live e ranking.
- L'audit completo Tennis Europe viene eseguito ogni giorno e diventa rosso per ID ufficiali mancanti, struttura partita incompleta, collisioni di identità o assenza di nome, date, superficie e indoor/outdoor nei tornei recenti mostrabili nella pagina avversario.
- L'audit consumi D1 viene eseguito ogni lunedì, proietta su trenta giorni le prime cinquanta query di lettura e le prime trenta di scrittura e applica una soglia prudenziale pari a 20 miliardi di righe lette e 40 milioni scritte, sotto le quote incluse nel piano Workers Paid.
- La misurazione disponibile al 19 settembre 2026 sui precedenti 31 giorni registra circa 1,446 miliardi di righe lette e 566 mila scritte nelle query principali: rispettivamente circa il 5,8% e l'1,1% delle quote mensili incluse Paid. Le protezioni no-op introdotte successivamente evitano di ripetere le verifiche D1 globali quando l'impronta dei dati non cambia.
- L'API dei profili avversario usa ora prioritariamente l'ID ufficiale Tennis Europe già presente nei tabelloni e ricorre al nome normalizzato soltanto se l'ID non produce risultati. Due indici D1 dedicati rendono indicizzate sia la ricerca delle partite per giocatore sia quella del ranking per profilo.
- Asset aggiornati a `v3.css?v=2026092311` e `v3.js?v=2026092311`; nessuna modifica alle sigle live dell'acceptance list.

### Correzione audit completo Tennis Europe

- L'identificativo numerico esposto nei tabelloni Tennis Europe è locale al singolo tabellone: l'audit lo verifica ora nel perimetro `torneo + evento`, evitando collisioni false tra giocatori di tornei diversi e continuando a bloccare conflitti reali nello stesso tabellone.
- La verifica di nome, date, superficie e indoor/outdoor usa in ordine il catalogo corrente, il catalogo storico e il torneo conservato negli archivi OOP; i tornei usciti dalla finestra del calendario corrente non vengono più erroneamente considerati privi di metadati.
- Le regole restano restrittive: un dato realmente mancante dopo tutte e tre le fonti mantiene il run rosso. Nessuna modifica alle sigle live dell'acceptance list.

### Identità corretta nelle pagine avversario Tennis Europe

- Gli ID numerici dei partecipanti provenienti dai tabelloni non vengono più usati per ricostruire lo storico globale: sono locali al tabellone e possono essere riutilizzati per persone diverse.
- Tornei e partite della pagina avversario vengono selezionati tramite il nome normalizzato esatto indicizzato in D1. Anche ranking corrente e ranking storico ignorano gli ID numerici locali; un ID viene considerato profilo soltanto quando ha una forma non locale stabile.
- Il controllo automatico impedisce il ripristino della ricerca globale tramite `source_player_id`. Nessuna modifica alle sigle live dell'acceptance list.

### Nomi invertiti nelle pagine avversario

- Le forme ufficiali `Nome Cognome` e `Cognome Nome` vengono interrogate entrambe con lookup esatti indicizzati e ricondotte alla stessa chiave canonica; il caso verificato è `Paolo Loi` / `Loi Paolo`.
- La stessa equivalenza viene applicata al ranking corrente, alla selezione del giocatore dentro la partita e ai ranking storici degli altri partecipanti, senza riutilizzare gli ID numerici locali dei tabelloni.
- Le cache persistenti dei profili avversario passano alla versione 2 e gli asset a `v3.js?v=2026092312`, così i profili incompleti salvati in precedenza non vengono riproposti. Nessuna modifica alle sigle live dell'acceptance list.
- Il punteggio è orientato rispetto al giocatore della pagina, non rispetto alla squadra vincitrice: nel caso verificato Paolo Loi–Alessandro Di Giorgio viene mostrato correttamente `4-6 3-6`, non `6-4 6-3`.

### Unificazione profili nel cerca giocatori

- Il cerca raggruppa le forme `Nome Cognome` / `Cognome Nome` e presenta un solo risultato quando FITP e Tennis Europe identificano senza ambiguità la stessa persona.
- Il risultato conserva e mostra entrambe le fonti (`FITP · Tennis Europe`); un eventuale profilo Court Watch mantiene la precedenza di apertura.
- Omonimi, duplicati nello stesso circuito o nazionalità incompatibili non vengono uniti automaticamente. Asset aggiornato a `v3.js?v=2026092313`; nessuna modifica alle sigle live dell'acceptance list.

### Profilo avversario predisposto per FITP e ITF

- La pagina avversario diventa un contenitore universale: mantiene partite e ranking Tennis Europe già disponibili e aggiunge i tornei FITP/ITF nei quali la persona risulta iscritta negli archivi ufficiali correnti.
- Un torneo privo di tabellone viene indicato esclusivamente come `Iscritto`; non vengono inventati avversari, punteggi, turni o presenze effettive. Le partite FITP e lo storico ITF completo entreranno nello stesso gruppo torneo quando i rispettivi motori saranno implementati.
- Il nuovo indice D1 compatto raggruppa le iscrizioni per identità ufficiale e circuito, viene ricostruito dagli snapshot permanenti R2 e usa un hash semantico per evitare riscritture quando i dati non cambiano. Gli omonimi non vengono uniti se l'identità non è univoca.
- La pagina continua a mostrare al massimo cinque tornei complessivi, ordinati per data, con sorgente colorata; le iscrizioni non incrementano vittorie, sconfitte o partite. Asset aggiornato a `v3.js?v=2026092401`. Nessuna modifica alle sigle live dell'acceptance list.

### Monitoraggio mensile Cloudflare e correzione del run rosso

- L'Admin espone un riepilogo orario di tutte le componenti Cloudflare misurate: D1 (letture, scritture e spazio), Workers (richieste, errori e durata) e R2 (operazioni, traffico, oggetti e spazio). Il periodo viene calcolato dinamicamente sul ciclo mensile di fatturazione e non è limitato al 15 ottobre.
- Il consumo giornaliero viene confrontato con il budget residuo del ciclo; sono distinte la crescita dovuta a nuovi dati e le riscritture evitabili. Il workflow D1 conserva un solo trigger dall'agenda Tennis Europe, la concorrenza serializzata e i controlli hash/no-op già attivi.
- Il run Cloudflare `36079860907` ha raccolto correttamente tutte le metriche, ma è diventato rosso esclusivamente durante il salvataggio del riepilogo in D1 (`code 7500`, errore interno), mentre un altro flusso D1 era attivo. I dati dell'audit non erano errati né persi.
- Il riepilogo viene ora sovrascritto ogni ora in un unico oggetto R2, `monitoring/cloudflare-usage/current.json`, e l'Admin lo legge dal binding R2 `ARCHIVE`: il monitoraggio produce zero scritture D1, non accumula versioni e aggiunge soltanto una piccola operazione R2 per ora.
- Nell'ultima rilevazione disponibile: D1 `1.978.356.615` righe lette, `31.934.397` scritte e `795.996.160` byte; Workers `32.613` richieste e zero errori; R2 `211.324` operazioni e `753.250.180` byte conservati. La proiezione D1 iniziale include ancora il picco anomalo del 24 settembre precedente alla riduzione dei trigger; le successive rilevazioni orarie devono misurare il nuovo regime.

### Sincronizzazione incrementale dei profili avversari FITP/ITF

- Il confronto dei run `36080745148` e `36081792559` ha isolato la causa dei tempi anomali: la fase profili avversari passava da `9` secondi a `10m 27s` quando cambiava l'impronta e cancellava integralmente la tabella prima di reinserirla.
- La sincronizzazione esporta ora la sola versione corrente delle righe D1 e costruisce un delta esatto: inserisce i nuovi profili, aggiorna soltanto payload realmente differenti ed elimina esclusivamente le chiavi non più presenti.
- La cancellazione generale di FITP/ITF è vietata da un test automatico. Se una sorgente risulta vuota o il delta supera il maggiore tra 500 righe e il 10% dell'archivio, con tetto massimo di 2.000, il run si ferma prima di modificare D1.
- Le righe invariate non producono alcuna scrittura. L'indice e le funzioni dell'app restano invariati; cambia soltanto il metodo di sincronizzazione.
- Il primo run protetto (`36084550903`) ha bloccato correttamente un delta anomalo di `37.815` profili su `51.598` righe remote prima di eseguire scritture. La causa era la selezione del primo snapshot ITF sopra una soglia minima, anche quando uno dei backup conservava una copia più completa.
- Il ripristino confronta ora `current`, `backup-1` e `backup-2` e usa sempre lo snapshot valido con il maggior numero di partecipanti; slot e conteggio scelti vengono riportati nel log. Il limite sul delta rimane attivo.
- Dopo l'interruzione del vecchio reinserimento sono consentiti recuperi anche numerosi di sole righe mancanti; modifiche e cancellazioni massive restano bloccate prima delle scritture.

## Regola obbligatoria per nuove funzioni D1

Dal 26 settembre 2026 ogni nuova funzione che scrive in D1 deve essere
incrementale: INSERT solo per record nuovi, UPDATE solo per dati realmente
cambiati, zero scritture per dati identici e DELETE solo per rimozioni
verificate. Sono vietate riscritture complete nei run ordinari.

I motori esistenti non vengono modificati da questa decisione. La specifica
completa è in `docs/D1_NEW_FEATURE_POLICY.md`.

## Correzioni UI e diagnostica 27 settembre 2026

- Dichiarata risolta l'anomalia indirizzo Darko Sartori per Rodeo Under 14/16.
- Indoor viene mostrato anche quando è già presente nel nome del torneo, incluso Bad Waltersdorf.
- Nelle pagine avversario il compagno appare solo nell'intestazione Doppio con e non viene ripetuto nella singola partita.

## Verifica R2 e allineamento D1 27 settembre 2026

- L'audit R2 identifica le generazioni non referenziate e le dichiara eliminabili solo quando ogni oggetto coincide con una copia referenziata.
- I cicli D1 invariati aggiornano una sola riga tecnica di verifica e non riscrivono giocatori, tornei o match.
- Il timestamp API rappresenta l'ultima verifica positiva della corrispondenza dell'import hash.

## Archivio tabelloni ITF in R2 e D1 — 27 settembre 2026

- Il backfill certificato run `36332685246` ha letto i 17 blocchi storici R2 e i documenti live: 4.352 task unici, 4.313 documenti completi e 39 retry conservati.
- D1 contiene ora 88.077 match ITF e 88.077 risultati ITF, con parità esatta rispetto ai documenti completi acquisiti; zero documenti illeggibili e zero associazioni mancanti.
- T−1 ordinario salva i documenti in R2; lo straordinario inoltra i tornei allo stesso motore. Il workflow `Court Watch ITF acquired draws D1 sync` importa automaticamente ogni nuova acquisizione completa.
- Tornei, match e risultati ITF usano ID canonici stabili. Gli UPSERT aggiornano esclusivamente payload differenti; dati identici producono zero scritture e una sorgente incompleta non cancella dati validi.
- Il rebuild D1 generale esclude l'archivio ITF dalle cancellazioni di riconciliazione, impedendo che una proiezione corrente incompleta elimini lo storico.
- Il futuro motore risultati/OOP ITF deve usare lo stesso importatore canonico. Il controllo CI `Court Watch global D1 incremental policy` e il test `build-itf-draw-d1-seed.test.mjs` bloccano modifiche prive di ID stabili, UPSERT condizionali, protezione delle fonti incomplete o zero-write sui dati invariati.

## Copertura Incapsula ITF — 30 settembre 2026

- Inventario e acquisizione T−1 usano il fallback autorizzato per qualificazioni, knockout e Round Robin quando l'API diretta restituisce Incapsula, HTTP 401/403 o una risposta protetta non JSON.
- Un test automatico verifica esplicitamente i tre casi `Q-KO`, `M-KO` e `M-RR`.
- Lo straordinario ruota l'intera coda prima di riprovare tornei ancora bloccati: due fallimenti non possono più fermare gli altri recuperi.
- La sincronizzazione D1 termina correttamente con zero scritture quando il run non contiene record nuovi o modificati.

### ITF T-1: tre catene concorrenti

L'acquisizione usa una catena ordinaria e due catene straordinarie A/B.
Le corsie straordinarie sono partizionate stabilmente e non si sovrappongono.
I tabelloni `pending_publication` restano irrisolti ma vengono spostati in fondo
al ciclo; `pending_technical` resta distinto. La pubblicazione R2/D1 rimane
serializzata e incrementale.

### Correzione selettore ordinario ITF

Il selettore ordinario include ora anche i tornei attivi classificati
`strict_missing_draws` dalla coda diagnostica. Un run senza artefatti non causa
più un falso fallimento del workflow D1.

## Certificazione binaria dei tabelloni ITF — 1 ottobre 2026

- La diagnostica non usa più `populated=true` come sinonimo di tabellone completo: un tabellone è preso soltanto quando l'artefatto ufficiale completo è archiviato.
- Un Round Robin è preso soltanto quando tutti i gironi dichiarati risultano acquisiti e certificati; un solo girone mancante mantiene nero l'intero tabellone.
- Qualsiasi altro esito resta mancante e ritentabile. La diagnostica espone per ogni tabellone uno dei motivi: mai processato, incompleto, vuoto/non pubblicato, blocco Incapsula, errore tecnico o gironi Round Robin incompleti.
- Le correzioni manuali già confermate rimangono valide e sono marcate internamente come `manual_override`.
- L'audit pubblica `dist/v3/itf_t1_queue_status.json` anche con T−1 sospeso, così l'Admin mostra numeri e motivazioni prodotti dalla stessa fotografia certificata.
- Validazione: test unitari della regola binaria, controllo sintattico Node, verifica workflow e test UI dell'Admin.

## Certificazione ITF riga per riga — 1 ottobre 2026

- Motivo: il precedente audit considerava completo un KO con qualunque risposta popolata (`players > 0`), quindi poteva certificare artefatti parziali come il main draw maschile di Punta Cana.
- Regola definitiva: ogni riga d'ingresso dichiarata deve contenere il giocatore/la coppia richiesta oppure un `BYE` esplicito; una sola riga vuota rende il tabellone incompleto. I turni successivi non ancora disputati non sono righe d'ingresso mancanti.
- Componenti: l'acquisizione ITF conserva il marcatore BYE e distingue nodi KO/RR; l'audit R2 calcola la parità delle righe anche sugli artefatti storici; la diagnostica mostra mai processato, Incapsula, vuoto/non pubblicato, incompleto con conteggio delle righe ed errore tecnico.
- Round Robin: devono essere presenti e completi tutti i gironi dichiarati e l'eventuale fase Knockout collegata.
- Sicurezza: i workflow T-1 ordinario e straordinario restano disabilitati; audit e diagnostica non riattivano acquisizioni concatenate.
- Validazione completata nello stesso commit: controlli sintattici Node, 10 test unitari per KO completo, BYE, riga vuota, 28/32 e RR, verifica UI Admin e confronto puntuale con Punta Cana e Pescara. Punta Cana `B-S-M-KO` risulta correttamente incompleto (2/8, sei righe vuote); Pescara `B-S-M-KO` e `G-S-M-KO` risultano incompleti (28/32, quattro righe non ancora provate come BYE), mentre i due doppi risultano completi (16/16).
- Limite intenzionale: gli artefatti legacy senza prova esplicita dei BYE restano non certificati e dovranno essere riacquisiti; non vengono promossi a completi per inferenza.

## Correzione certificazione righe ITF — 1 ottobre 2026

- Corretto l'errore emerso nell'audit #57: `roundNumber` dell'API ITF non descrive sempre la profondità completa del tabellone e non può essere usato come esponente per ricavare la dimensione. Il KO usa ora il turno con il maggior numero di match e dichiara esattamente due posizioni d'ingresso per match.
- Un tabellone KO è completo soltanto se tutte le posizioni risultano occupate da giocatore/coppia o BYE esplicito; una squadra mancante, parziale o una struttura con più di due squadre per match rimane incompleta.
- Per i Round Robin la dimensione del girone viene ricavata soltanto da un numero triangolare valido di match; tutti i partecipanti/coppie del girone devono essere identificabili. La fase KO collegata continua a essere verificata separatamente.
- Conservate le verifiche manuali: i doppi maschile e femminile di J60 Pescara restano certificati 16/16, oltre alle eccezioni già registrate e ai 13 tornei cancellati senza tabelloni.
- L'audit ora fallisce invece di diventare verde quando i totali non quadrano, quando produce zero acquisiti a fronte di tabelloni dichiarati, quando osserva più righe di quelle possibili o quando regrediscono i casi sentinella Punta Cana/Pescara.
- I workflow T−1 restano sospesi. Prima della riattivazione devono passare i test unitari, i casi campione e un nuovo audit totale coerente.

## Aggiornamento immediato diagnostica T−1 — 1 ottobre 2026

- Individuata la causa dei contatori non aggiornati dopo un'acquisizione: il `review` rigenerava `itf_t1_queue_status.json` usando la fotografia dell'audit R2 scaricata prima del recupero dei tabelloni.
- Il `review` ora riconcilia nello stesso run soltanto gli artefatti T−1 con `status=complete` e parità righe certificata; artefatti incompleti, vuoti, bloccati da Incapsula o con errore tecnico restano mancanti.
- Dopo la riconciliazione viene aggiornato l'audit stretto su R2 e solo successivamente vengono rigenerati i contatori ordinario/straordinario. I cicli successivi non possono quindi ripubblicare la vecchia fotografia.
- Sicurezza: nessun `populated=true` legacy viene promosso automaticamente; sono accettati esclusivamente i documenti prodotti nel run corrente e ricontrollati con `strictDrawStatus`.
- Verifica locale: tre test verdi — riduzione immediata di un tabellone, nessuna riduzione per un artefatto incompleto, uscita del torneo dalla coda soltanto quando tutti i tabelloni sono certificati.

## Preparazione nuovo conteggio ITF su 1.031 tornei — 1 ottobre 2026

- Decisione del proprietario: perimetro corretto di 1.031 tornei, gia senza le sei gare a squadre; i 13 tornei cancellati sono risolti e restano nel totale. Tutti i 235 inventari non verificati devono essere processati, incluse le date future. I conteggi esplorativi precedenti non sono una certificazione finale.
- Operazioni read-only: scaricato e letto l'artefatto `itf-official-draw-parity-audit` del run `36801544149` (artefatto `11136376595`); confrontati inventario, diagnostica pubblicata e catalogo. L'audit conserva 1.031 ID mentre il catalogo letto contiene 1.023 voci, incluse sei gare a squadre: 14 ID dell'audit non sono piu nel catalogo. Nessuno dei 235 non verificati manca dal catalogo. Per evitare variazioni del denominatore, la patch conserva il perimetro e i metadati dell'audit in `itf-audit-baseline-20261001.json`.
- Nuova regola dell'audit: rimosso il controllo di parita delle righe/BYE. Un artefatto non vuoto acquisito con successo viene riconosciuto; gli artefatti respinti soltanto da `draw_rows_incomplete` vengono rivalutati. Una cache `populated=true` senza documento acquisito non costituisce prova sufficiente. Vuoti, blocchi e altri errori non vengono promossi.
- Nei singolari main draw con RR dichiarato, il KO della stessa famiglia maschile/femminile viene escluso dai tabelloni richiesti e registrato tra `excludedEvents`. Qualificazioni, doppi e l'altra categoria restano indipendenti. RR richiede evidenza di acquisizione di tutti i gironi dichiarati; non usa piu controllo BYE o completezza del KO collegato. Gli archivi legacy privi di tale evidenza restano da verificare.
- Modificati matrice, inventario e confronto dell'audit; aggiunti politica di acquisizione, baseline e test. La matrice include tutti i 235 iniziali e, ai successivi avvii manuali, solo quelli ancora non verificati. Ogni conteggio deve rispettare `completi + cancellati + mancanti + non verificabili = 1031` e `risolti = completi + 13`.
- Workflow audit solo manuale: rimossi trigger push e rilanci concatenati. Lo stato di ingresso viene congelato in un artefatto condiviso dai job; esito persistito separatamente in R2 `itf/audits/official-draw-parity/coverage-v3-current.json`. Nessuna pubblicazione delle code Admin/T-1, nessun inserimento o avvio dei motori, nessuna scrittura D1, nessuna cancellazione di archivi. Conservate le vecchie regole dei motori fino al successivo intervento autorizzato.
- Validazione locale: sei test verdi, inclusi qualificazioni con posizioni vuote, RR parziale/completo, esclusione KO per categoria, selezione esatta dei 235, bilanciamento su 1.031 e blocco di archivi illeggibili. Controlli sintattici Node e parsing YAML verdi. Patch verificata su copie esatte dei file upstream.
- Stato di consegna: patch preparata localmente, non applicata o pubblicata da questa sessione. Nessun workflow remoto avviato, nessun polling. Dopo applicazione serve un solo audit manuale completo; `readyForT1` resta falso se esiste anche un solo inventario non verificato. Il verde del workflow da solo non equivale alla prontezza: serve leggere conteggi e `readyForT1`. L'inserimento nei motori T-1 sara una fase successiva alla certificazione e al via del proprietario.

## Esito audit preparatorio ITF 36926476130 — 1 ottobre 2026

- Letto una sola volta il run `36926476130`: completed/success, avviato alle 21:07:10 UTC sulla revisione `a0fb7c81483eb915f335bac1da006a53c5693628`. Scaricato e verificato l'artefatto `11194154548`; fotografia generata alle 21:21:46.918 UTC. Nessun polling, rilancio o modifica dei motori.
- Conteggi verificati: 1.031 ID distinti, 398 tornei completi, 13 cancellati risolti, 385 tornei con almeno un tabellone non certificato come acquisito, 235 inventari non verificabili. Risolti = 398 + 13 = 411; controllo esatto 411 + 385 + 235 = 1.031.
- Tabelloni richiesti dopo le esclusioni: 4.520, dei quali 3.154 acquisiti e 1.366 non certificati. Esclusi 585 singolari main draw KO nelle famiglie RR: 305 maschili e 280 femminili. Il J100 Algiers `J-J100-ALG-2026-001` risulta completo, 6/6 tabelloni, incluse entrambe le qualificazioni.
- I 235 inventari sono stati processati nel run ma tutte le risposte sono `empty_inventory`, senza errore tecnico e con date oltre la finestra D+3. La risposta senza eventi non consente di enumerare i tabelloni richiesti; non viene interpretata come torneo completo, cancellato o elenco noto di tabelloni mancanti. Nessun blocco Incapsula rilevato in questa categoria.
- `readyForT1=false`: il verde certifica l'esecuzione dell'audit, non una partizione completa fra risolti e mancanti per tutti i 1.031. Non riavviare un audit identico soltanto per lo stato verde; definire prima il trattamento degli inventari futuri senza eventi pubblicati. Le code T-1 e il loro stato di audit precedente non sono modificati da questa verifica.
- Esito registrato nella patch di preparazione successiva; i conteggi descrivono la fotografia del run indicato.

## Preparazione code T−1 e richiesta export Compiègne — 1 ottobre 2026

- Decisione successiva del proprietario: un torneo futuro senza inventario/tabellone è normale; la ricerca dei tabelloni inizia esclusivamente da T−1. I 235 inventari sono già stati processati nell'audit; rimangono nel perimetro come attesa pubblicazione, con numero di tabelloni ignoto, e devono essere rivalutati quando diventano eleggibili. Questo supera il precedente blocco globale `readyForT1=false`: la prontezza preparatoria richiede zero inventari ignoti già eleggibili e zero date inutilizzabili, senza pretendere tabelloni dai tornei futuri. Non riscrive l'esito storico dell'audit.
- Verifica read-only: letti AGENTS.md, report, workflow archivi e componenti delle code sulla revisione Git `bc168f36d22796b2b55b8bcbf4cb40e7b5d337c9`. Nessun polling. Ricalcolata una sola volta la partizione dalla fotografia `36926476130` per il giorno 2026-10-01: ordinario 28 tornei / 159 tabelloni; straordinario A 184 / 625; B 173 / 582; futuri in attesa 235 inventari; risolti esclusi 398 completi + 13 cancellati. Totale code mancanti 385 / 1.366, nessun ID/task duplicato, nessun ignoto eleggibile. `readyForT1=true` nel piano preparatorio, non è un'autorizzazione ad avviare i motori.
- Componenti: nuova funzione pura `itf-coverage-queue-plan.mjs`, comando `prepare-itf-coverage-queues.mjs` e adattamento del generatore diagnostico quando riceve esplicitamente un audit con il nuovo criterio. Fine finestra ordinaria = domani UTC, eliminato D+3 per la nuova politica. KO main singles escluso solo nella famiglia RR corrispondente; nessuna cache populated promossa a prova. I task preparati derivano esattamente dai missingEvents dell'audit e conservano torneo/evento e parametri ufficiali. Inventari ignoti futuri non generano task di acquisizione; quando diventano T−1 bloccano la prontezza e vengono segnalati come inventory_required.
- Protezioni: perimetro congelato di 1.031 ID, 13 cancellazioni confermate dalla baseline, controlli individuali eventi/checks/conteggi e controllo dei totali; date mancanti rendono il piano non pronto. A/B usa la partizione stabile dei motori esistenti. Il generatore legacy conserva il percorso precedente quando gli viene passato il vecchio audit; la nuova diagnostica non diventa visibile nell'Admin finché non viene pubblicata dalla successiva integrazione autorizzata.
- Compiègne `J-J30-FRA-2026-003`, ID ITF `1100202957`, 23–28 giugno: audit completo 6/6, sorgente r2_history, escluso dalle 13 cancellazioni senza tabelloni e dalle code. Individuati i task originali nel batch/blocco 06, indici globali 1544–1549. Tentato una sola volta il download dell'artefatto GitHub `9583392118`: HTTP 404, copia non disponibile. L'artefatto del backfill D1 `36332685246` contiene solo il riepilogo di audit (334 byte), non i tabelloni. Pertanto questa sessione non ha ancora letto o consegnato i sei documenti originali: il 6/6 è l'esito dell'audit, non una nuova verifica visiva dei dati.
- Nuovo workflow manuale `courtwatch-itf-coverage-next-step.yml`: legge lo snapshot coverage R2 e soltanto il blocco storico 06, verifica checksum SHA-256 dal manifest, prepara code/diagnostica e restituisce i sei JSON originali con copie gzip identiche, manifest e pagina HTML di consultazione. L'export fallisce se non trova tutti e sei, se uno non è acquisito, se trova duplicati o un ID ITF discordante. Il nome archivio contiene CANCELLED: l'export non certifica che il torneo si sia svolto e consente di controllare cosa è stato effettivamente acquisito.
- Nessuna chiamata di acquisizione ITF, nessun rilancio dell'audit totale, nessun polling, nessuna scrittura R2/D1, nessuna pubblicazione Admin, nessun inserimento o avvio dei motori. L'artefatto GitHub è l'unica scrittura del workflow preparatorio. La patch non modifica i workflow T−1 ordinario/straordinario né la loro sospensione.
- Validazione locale: sei test della partizione (T−1/T−2, inventario futuro che diventa eleggibile, risolti, esclusione RR per famiglia, blocco conteggi/duplicati, date mancanti); test dell'export su fixture sintetiche (6 documenti, identità gzip, HTML con escaping, assenza di un tabellone e ID errato). Piano verificato sulla fotografia reale: 1.031 / 4.520 / 3.154 / 1.366 e partizioni sopra indicate. Controlli sintattici Node, parsing YAML e applicazione patch su copie upstream. L'export reale richiede un unico avvio manuale del nuovo workflow dopo applicazione della patch; nessun workflow remoto è stato avviato dalla sessione.

## Integrazione ordinario/straordinario e diagnostica — 2 ottobre 2026

- Correzione esplicita del proprietario: mantenere la finestra D+3 esistente. Superata la restrizione a T−1 descritta nella preparazione precedente. Date e ingresso automatico delle code usano Europe/Rome, coerentemente con TODAY dei motori.
- Autorizzata la correzione dei motori ordinario e straordinario: quando inventario e parametri sono noti, andare direttamente ai soli tabelloni mancanti. Il vecchio populated=true non basta a saltare un tabellone. Sono valide le acquisizioni documentate dal nuovo audit coverage oppure i documenti nuovi salvati con successo e valutati con la stessa politica: nessun controllo righe/BYE, RR con tutti i gironi dichiarati, KO main singles escluso soltanto nella famiglia RR corrispondente. Conservate le correzioni manuali.
- Letti solo i file necessari su main alla revisione 9d3af274d40e49e6837c8c2944665778fbd4ca80; nessuna lettura o polling di nuovi run, nessun nuovo audit generale. Patch sostitutiva cumulativa: comprende anche export Compiègne e preparazione code della patch precedente, con D+3 corretto e pubblicazione della diagnostica.
- Ordinario e straordinario leggono coverage-v3-current.json come fonte comune. Le code non reintroducono tornei completi/cancellati in base a cache legacy o backlog statici. A/B rimangono disgiunte e ruotano gli incompleti; richiesta esplicita di un torneo già completo non lo forza nuovamente in acquisizione. L'inventario viene riusato dall'audit o dai parametri persistiti validi. GetEventFilters viene chiamato soltanto quando mancano inventario/parametri. I parametri persistiti non certificano l'acquisizione.
- Corretti anche i fallback: il browser riceve il singolo task mancante, non rilegge GetEventFilters e non acquisisce gli altri tabelloni del torneo. La visita alla pagina ufficiale per aprire la sessione resta necessaria. L'acquisizione non respinge più documenti soltanto per posizioni BYE/riga vuota; il RR non richiede il KO collegato.
- Review serializzato: conserva i documenti su R2, aggiorna le prove dello stato, riconcilia il nuovo audit con i documenti del batch e gli inventari appena scoperti, quindi rigenera la diagnostica e le code. Passaggio 5/6 → 6/6 nello stesso run; risposta vuota, errore tecnico o RR con un girone mancante lascia irrisolto il tabellone. Una fonte incompleta non cancella documenti o record acquisiti. Nessuna nuova funzione o riscrittura completa D1 introdotta.
- Verificati tutti i tre workflow esistenti che chiamano il generatore diagnostico: ordinario, straordinario e audit completo read-only. Anche quest’ultimo carica esplicitamente coverage-v3-current.json prima di ricostruire le code; il suo rapporto legacy separato non viene pubblicato come nuova diagnostica.
- La diagnostica Admin mostra il criterio effettivo del JSON, al posto della vecchia frase fissa su BYE; espone anche futuri in attesa e tornei risolti. Il workflow manuale Court Watch ITF prepare queues and export Compiegne ora pubblica il solo itf_t1_queue_status.json su GitHub oltre a produrre l'artefatto dei sei documenti. È serializzato con i review: legge R2 e non scrive in R2/D1, non chiama ITF né avvia acquisizioni. La pubblicazione rende disponibili i contatori alla normale sorgente pubblica dell'Admin.
- Foto originaria audit invariata: 398 completi + 13 cancellati, 385 tornei con 1.366 tabelloni mancanti, 235 inventari ignoti. Ricalcolo al 2 ottobre in Europe/Rome, senza chiamare ITF: ordinario 51 tornei = 28 con 159 mancanti noti + 23 inventari ora entrati automaticamente in D+3; straordinario A 184/625 e B 173/582; 212 inventari ancora futuri. readyForT1=false nel riepilogo indica quei 23 inventari ancora da conoscere, non impedisce al motore corretto di acquisire i mancanti già noti e processare gli inventari eleggibili. Nessun numero di tabelloni viene inventato per gli inventari vuoti.
- Compiègne: rimane incluso l'export verificato del blocco storico 06 con sei JSON, originali gzip, manifest e HTML consultabile; originale GitHub non disponibile (404). Questa sessione non ha ancora accesso ai sei documenti privati R2: il workflow manuale autorizzato li rende scaricabili. Il 6/6 resta l'esito dell'audit già letto, non una nuova verifica visiva dello svolgimento del torneo.
- Sospensione preservata: tolto il trigger push del motore ordinario e introdotto il gate esplicito ITF_T1_COVERAGE_ENABLED=true su entrambi i selettori. La variabile non è stata impostata da questa sessione. Applicare la patch non avvia automaticamente i motori; dopo pubblicazione diagnostica/export, l'avvio richiede abilitare il gate e dispatch ordinario/A/B. I dispatch periodici e le catene esistenti rispettano il medesimo gate.
- Validazione: test della partizione D+3; test export a sei documenti con gzip identici, HTML escaping e blocco per documento mancante/ID discordante; test effettivo dei comandi inventory → queue → merge con 5/6, legacy populated=true su tutti e sei, zero chiamate ITF inventario, un solo task e chiusura dopo il sesto. Test riconciliazione senza decremento per risposte vuote/errori, RR tutti i gironi e KO collegato non richiesto, conteggi diagnostica aggiornati e idempotenza. Controllati Node, YAML, shell workflow e applicazione patch sulle copie originali upstream. Non applicata/pushata da questa sessione; nessun workflow remoto avviato.

## Recupero applicazione ITF con backup — 2 ottobre 2026



- Verificata la lista dei run una sola volta, quindi letti i job e i soli log necessari. Ordinario 36935337115: selezione di otto tornei e inventari/coda riusciti; quattro job di acquisizione completati e altri in corso/in coda al momento della lettura. Non certificato il completamento dell'intero batch senza il review. Selettori straordinari A 36935376594 e B 36935402182 riusciti e dispatch eseguiti.
- Acquisizione straordinaria A 36935408023 fallita: inventory J-J60-NEP-2026-001 e J-J60-RSA-2026-002 interrotti da tournament_source_not_found; nessun JSON prodotto, quindi upload artefatto fallito. La coda ha contato zero inventari e non ha avviato acquisizioni/review. In B 36935437674 lo stesso difetto riguarda J-J30-KEN-2026-002; l'altro inventario riuscito, review in attesa al momento della lettura. Nessun polling successivo per inseguire l'esito.
- Causa verificata: l'URL manca nel catalogo/baseline/stato scelti, mentre i parametri API dei tabelloni sono noti. La precedente patch aveva richiesto anche un URL disponibile per riusare l'inventario. Gli URL autentici sono conservati nei registri di task storici: batch 07 per Nairobi, 14 per Kathmandu e 15 per Durban. Non sono stati inventati slug o interrogati nuovamente gli inventari ITF.
- Correzione: historicalTournamentSource cerca l'URL ufficiale nei registri locali itf-history-draw-batch-NN.json del repository, con verifica dominio e ID nel percorso. Inventory integra URL catalogo/persistiti/audit/baseline e poi il registro storico prima di riusare i parametri. Se l'URL manca realmente in ogni fonte, salva comunque un documento retry con errore tournament_source_not_found, evitando il successivo errore artificiale di upload senza file.
- Regole restano invariate: D+3, soli tabelloni mancanti, completamento del torneo solo quando ogni tabellone richiesto è acquisito; diagnostica ricostruita dai review. Nessun motore fermato/cancellato, nessuna acquisizione remota o scrittura R2/D1 da questa sessione. I log letti mostrano inoltre endpoint/token dell'acquisitore non valorizzati nel job; non è la causa di questo errore prima delle richieste e la configurazione non è stata modificata.
- Validazione: quattro test verdi, inclusa regressione CLI con catalogo/baseline/stato senza URL, recupero da task storico, zero chiamate ITF inventario, un solo task su 5/6, chiusura a 6/6 e JSON retry presente anche quando nessun URL è disponibile. Sintassi Node e applicazione patch controllate sulle copie della revisione 2fd4c5db49401ded1b7ea20bfefbebd0eb4e76b0. Patch da applicare/pushare dall'utente; per riprendere lo straordinario va avviato un nuovo run dal main corretto, non rieseguito il vecchio commit difettoso.

### Verifica acquisizioni effettive e isolamento inventari falliti — 2 ottobre 2026

- Aggiornamento mirato richiesto dall’utente, senza attesa/polling: scaricati gli otto artefatti di acquisizione del batch ordinario 36935337115, decompressi 42 documenti, applicato acquiredDrawStatus a ciascuno. Risultato verificato: 37 acquisiti validi, 5 retry. Ghana 4/4, Istanbul 5/5, Algiers 5/5, Djibouti 4/4; Santiago 5/6, Armenia 5/6, Austria 5/6, Repubblica Dominicana 4/6. Quattro G-D-M-KO bloccati da GetDrawsheet_incapsula_challenge; G-S-Q-KO dominicano senza giocatori. Questi rapporti riguardano i task del batch, non conteggi globali o conferma di pubblicazione: il review ordinario risultava ancora in persistenza al momento della lettura.
- Precisazione sullo straordinario B 36935437674: il log coda contiene 1 torneo e 2 task. Acquire è stato saltato per propagazione del fallimento dell’altro job inventory attraverso il controllo implicito success() di GitHub Actions; il review ha poi fallito con No ITF draw documents found. Non era una coda vuota. Aggiunta condizione esplicita always() + queue riuscita + tasks != 0 al job acquire: i tornei pronti proseguono indipendentemente dagli inventari falliti. La persistenza mantiene il controllo sui documenti mancanti quando erano attese acquisizioni.
- Verificata transizione automatica: endDate < oggi Europe/Rome sposta il torneo incompleto dall’ordinario alla corsia straordinaria A/B; l’inventario già noto e le prove dei cinque acquisiti restano disponibili e il solo sesto è richiesto. Un inventario ignoto è richiesto nel ciclo di selezione; se ancora vuoto resta da ritentare, senza inventare tabelloni.
- Test regressione aggiunto per passaggio ordinario → straordinario il giorno successivo alla fine, conservazione 5/6 e nessuna nuova necessità di inventario. Patch cumulativa di questa correzione: recupero URL storici, JSON retry anche per URL assente, isolamento inventory falliti e report. Nessun workflow remoto avviato o modifica remota effettuata dalla sessione.

### Cause diagnostiche dei tabelloni mancanti — 2 ottobre 2026

- Richiesta utente: distinguere nella diagnostica Incapsula e tabellone senza giocatori. Dati verificati negli artefatti del batch ordinario: quattro blocchi GetDrawsheet_incapsula_challenge, G-D-M-KO di J-J200-CHI-2026-002, J-J30-ARM-2026-006, J-J30-AUT-2026-003 e J-J30-DOM-2026-002. Il quinto mancante è G-S-Q-KO di J-J30-DOM-2026-002: zero giocatori e 24 nodi partita, non un quinto blocco tecnico.
- Il review ordinario 110615783891 è ora completato con successo, verificato su richiesta specifica dell’utente senza polling di attesa. La diagnostica viene pubblicata dal review; prima della sua conclusione mostrava necessariamente l’ultimo stato pubblicato.
- AcquiredDrawStatus introduce draw_without_players solo quando è stato restituito un tabellone con nodi e senza giocatori e non esiste prova di errore tecnico. Incapsula mantiene priorità; il solo contenuto vuoto non viene spacciato per blocco né per acquisizione. Reconcile conserva lastError e lastAttemptAt; Admin mostra etichetta esplicita e codice errore per ogni tabellone mancante.
- Validazione: regressione riconciliazione → diagnostica per Incapsula e tabellone senza giocatori, conteggi per causa e mancanti invariati. Sintassi Worker e applicazione patch controllate. Nessuna acquisizione ITF o scrittura remota da questa sessione; modifiche da applicare dall’utente dopo la patch engine-recovery. La nuova etichetta richiede un review successivo per riclassificare i tentativi salvati e il deploy Worker per la visualizzazione.

- Ritardo UI aggiuntivo individuato: remoteJson riusava ogni dato Admin per 300.000 ms. Il solo itf_t1_queue_status.json ora usa maxAgeMs=0, quindi ogni apertura legge lo stato pubblicato senza attendere cinque minuti; nessun polling o timer di aggiornamento aggiunto. Le altre sorgenti mantengono la cache. Se la sorgente non risponde resta il precedente dato con il suo timestamp, senza dichiararlo aggiornato. Sei test superati, controllo sintassi Worker riuscito.

### Qualificazione singolare vuota risolta e freschezza per torneo — 2 ottobre 2026

- Regola autorizzata dall’utente: solo qualificazioni di singolare B/G. Un documento restituito con nodi partita ma senza giocatori risolve la qualificazione quando il main draw dello stesso sesso è acquisito. Per RR valgono i gironi certificati, senza KO collegato; per KO vale il main KO. Doppi, richieste fallite, Incapsula, main non acquisiti o altro sesso non soddisfano la regola.
- Policy condivisa tra merge e riconciliazione. Le qualificazioni risolte conservano prova/causa, escono dai task richiesti e sono mostrate distintamente nella diagnostica. Non vengono conteggiate come artefatti acquisiti: i conteggi required escludono queste qualificazioni, resolvedEvents conserva l’evento e il motivo. Il merge registra populated=false e resolutionProof, senza creare documenti o giocatori fittizi.
- Punta Cana J-J30-DOM-2026-002: il documento G-S-Q-KO verificato ha zero giocatori e 24 nodi; G-S-M-RR è acquisito. Applicando la policy ai documenti verificati resta soltanto G-D-M-KO bloccato Incapsula. L’effetto remoto richiede la riconciliazione con un documento vuoto comprovato: non si riclassifica arbitrariamente una vecchia etichetta generica vuoto/non pubblicato priva della prova originale.
- Freschezza: reconcile non riscrive i tornei noti senza nuovi documenti/tentativi. Per ogni torneo checkedAt usa lastAttemptAt del documento, non il timestamp della rigenerazione generale. Admin visualizza età e data/ora Europe/Rome per torneo. Rimossa la cache della sola copertura nella precedente patch diagnostica, che resta compatibile e deve precedere questa patch.
- Validazione: KO/RR, main non acquisito, esclusione doppi/Incapsula, freschezza distinta e conservazione timestamp per tornei non controllati; test di pipeline esistenti e controllo sintassi. Nessun polling, acquisizione ITF o scrittura remota durante la preparazione. Operazioni nel report; patch aggiuntiva dopo engine-recovery e diagnostic-reasons.

- Consegna cumulativa ricostruita sui dieci file di main letti in questa sessione, per risolvere applicazione parziale e dipendenze tra patch. Include engine-recovery, diagnostic-reasons e empty-singles-qualifying; sostituisce i tre file patch precedenti. Nessuna modifica remota effettuata.

- Installer idempotente dopo errori di contesto: backup di ogni file prima della scrittura, aggiornamento dei soli nove file interessati e append del report. Nessun reset, eliminazione stash o push automatico.

## Inventari vuoti, freschezza e mapping storico — 2 ottobre 2026

- Su richiesta utente verificato l’artefatto itf-t1-draw-batch 11199786008 del run ordinario 36939068583. Tutti gli otto inventari avevano zero sezioni: J-J100-UZB-2026-003, J-J200-ARG-2026-001, J-J30-AUT-2026-004, J-J30-BAN-2026-002, J-J30-CAN-2026-001, J-J30-DJI-2026-001, J-J30-ESP-2026-011, J-J30-FRA-2026-008. Non erano otto tornei completi: l’assenza di eventi impediva di enumerare i tabelloni. Non introdotti tabelloni fittizi né numero atteso di eventi.
- Causa: inventory considerava complete la risposta API riuscita anche con zero eventi. Il builder non riportava errore e reconcile restituiva la vecchia riga senza registrare il tentativo. Correzione: empty_inventory + retry, inventario vuoto esplicitamente visibile in diagnostica, data reale del controllo trasferita al review. Nessuna promozione a torneo completo; resta eleggibile per un ciclo successivo. Empty inventory è una situazione di pubblicazione da ritentare, non un falso errore tecnico.
- Freschezza: il builder trasferisce inventorySource e inventoryCheckedAt, quindi una lettura dei parametri cached non viene scambiata per una chiamata ufficiale. Il timestamp del controllo resta distinto da quello della generazione diagnostica; senza nuovo documento/inventario non cambia.
- Inclusa correzione persistenza già consegnata: fallback ai metadati della baseline congelata dei 1.031 per tornei storici assenti nel catalogo corrente; il catalogo corrente conserva precedenza. Risolve unmappedDocuments che aveva fermato A dopo quattro acquisizioni valide. B aveva quattro acquisizioni valide ma review cancellato. Nessun invio remoto effettuato dalla sessione.
- Distribuzione come installer idempotente con backup: sostituisce solo nove file interessati e aggiunge questo report senza sovrascrivere annotazioni esistenti; elimina il conflitto di contesto del report che ha impedito la patch historical-mapping. La freschezza del Worker era già nel correttore precedente; per mostrarla resta necessario un deploy Worker riuscito dopo l’ECONNRESET osservato.
- Validazione: undici test complessivi, incluso API vuota simulata → inventory retry → queue zero task/un errore inventario → merge pending non tecnico → reconcile ancora unverifiable → diagnostica con data individuale invariata senza altri tentativi; pipeline KO/RR, qualificazioni singolare e mapping storico idempotente. Nessuna chiamata ITF live, polling, avvio/cancellazione run o scrittura R2/D1 nella preparazione.


## Review ITF in coda senza sostituzione — 2 ottobre 2026

- Verifica puntuale cancellazione A 36940640386: selezione/inventari/coda riusciti; quattro tabelloni RR acquisiti con status complete e zero technical/publication pending (B/G main Kathmandu J-J60-NEP-2026-001, Durban J-J60-RSA-2026-002). Review 110631476563 cancellato prima dell’avvio, nessuno step/log. Non certificata pubblicazione degli artefatti; catena A interrotta. B 36940658602 era nel review; ordinario 36940867684 attivo. Nessun run cancellato o rilanciato dalla sessione.
- Difetto verificato nella configurazione: gruppo condiviso courtwatch-v3-itf-publish senza queue mantieneva al massimo un pending anche con cancel-in-progress=false. Nuovi review concorrenti possono sostituire il precedente pending, coerentemente con A cancellato prima dell’avvio. Non dedotto un errore ITF né l’identità di chi ha eventualmente richiesto una cancellazione manuale.
- Correzione queue=max nel review condiviso, nel workflow ordinario per corsia, nel selettore straordinario per corsia e nel workflow manuale coverage-next-step che usa il gruppo publish. Restano un solo publisher attivo e cancel-in-progress=false; vengono ammessi fino a 100 pending. Fonti primarie: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency . Nessun parallelismo di scrittura R2/D1 introdotto.
- Installer idempotente modifica solo le impostazioni concurrency dei tre workflow, salva backup e aggiunge il report senza sovrascriverlo. Validazione YAML: tutti i gruppi coinvolti hanno queue=max e nessun cancel-in-progress=true; doppia esecuzione idempotente. Applicazione remota da effettuare dall’utente; per recuperare A serve nuovo run da main corretto, poiché rieseguire il vecchio run mantiene la vecchia configurazione.


## Straordinario A/B a otto tornei — 2 ottobre 2026

- Su richiesta utente A e B passano da due a otto tornei per batch, come ordinario. Selettore conserva partizione A/B, esclusione ID già tentati, rotazione e ricerca dei soli mancanti. La matrice ordinaria già supporta otto ID espliciti. max-parallel acquisizioni resta due per corsia; review serializzato nel gruppo publish con la correzione queue=max già consegnata.
- Beneficio atteso: meno avvii/review per lo stesso numero di tornei, non otto download simultanei né garanzia di velocità quattro volte maggiore.
- Spiegazione empty_inventory verificata: Ghana, Grecia e Messico iniziano il 5 ottobre e terminano il 10; alla lettura del 2 ottobre erano in D+3 e GetEventFilters non aveva fornito combinazioni di eventi. La mancata pubblicazione è compatibile con tornei futuri, non dimostrata automaticamente dalla sola lista vuota. Restano da ritentare con freschezza individuale.
- Test CLI: otto selezionati per A, otto per B, nessuna sovrapposizione di corsia, batch seguente evita gli ID già tentati. Nessun run remoto o chiamata ITF live durante la preparazione. Installer idempotente con backup, report append; nessuna cancellazione dei run in corso.


## Ordinario ITF ogni quindici minuti — 2 ottobre 2026

- Richiesta esplicita utente: avvio ordinario automatico ogni 15 minuti. Aggiunto schedule cron */15 * * * * al workflow courtwatch-v3-itf-t-minus-one.yml; conservato workflow_dispatch. Il cron usa UTC ma la selezione mantiene Europe/Rome e D+3. Gli input assenti sul trigger schedule usano la corsia ordinary; gate ITF_T1_COVERAGE_ENABLED, inventari riusati e soli tabelloni mancanti invariati.
- Concurrency per corsia e review condiviso con queue=max preservati; nessuna acquisizione parallela supplementare o polling aggiunto. I batch già avviati proseguono. GitHub schedule richiede il workflow su default branch main e puo subire ritardi di piattaforma: non e garanzia di esecuzione al secondo.
- Validazione YAML del cron e conservazione input manuali, queue/gate; installer idempotente con backup e append report. Nessun run remoto avviato o scrittura R2/D1 nella preparazione.


## Coda condivisa dei tre motori ITF automatici — 2 ottobre 2026

- Su richiesta utente verificato B 36942239488, head 8e240d3be7dccf791b6f58f043b98d4f5512b48f: otto tornei, quindici tabelloni RR con status complete, zero retry. Review 110636759477 pending dalle 23:44:51 UTC, cancellato alle 23:45:49 senza step; pubblicazione non completata, catena B interrotta. T-1 contieneva gia queue=max, quindi la cancellazione non era risolta dalla precedente correzione limitata.
- Ricerca repository e lettura completa dei workflow identificano tre motori automatici con lo stesso gruppo courtwatch-v3-itf-publish ma queue predefinita single: courtwatch-v3-itf-live.yml, courtwatch-v3-itf-known-fast.yml, courtwatch-v3-itf-safety-120d.yml. Un nuovo publisher single puo sostituire i pending del gruppo, inclusi review A/B. La cancellazione osservata e coerente con questa configurazione mista; non attribuita una cancellazione manuale a un utente senza prova.
- Correzione estesa ai tre motori automatici: queue=max con cancel-in-progress=false, stesso gruppo seriale. Nessun aumento della concorrenza di scrittura R2/D1; scope acquisition, trigger e criteri restano invariati. Il precedente intervento aveva omesso questi publisher: limite esplicitamente corretto. I due workflow manuali R2 recovery/rebuild identificati dalla ricerca non vengono modificati o lanciati; se utilizzati mentre i motori sono attivi, il loro gruppo legacy resta un possibile conflitto da correggere prima dell’avvio.
- Installer conserva backup e report append, validazione YAML delle tre review e idempotenza. Nessun run remoto avviato/cancellato, polling o modifica R2/D1 nella sessione. Nuovo B su main dopo il push; A 36942188718 e 36942258369 hanno completato il review con successo nella verifica puntuale.

## Verifica documentale dei 398 tornei originariamente completi — 2 ottobre 2026

Richiesta: verificare la completezza dei 398 tornei, separandoli dai 13 cancellati. Coorte congelata dall'artefatto del run 36926476130: 398 tornei, 2306 tabelloni richiesti. Nuovo workflow manuale separato, sola lettura R2, nessuna chiamata ITF, nessuna pubblicazione e nessuna modifica alle code A/B/ordinario. Controlla presenza dei documenti, stato/errori, giocatori e partite, ID partite duplicati, struttura squadre e certificazione gruppi RR. Considera la versione più recente conservando il numero di varianti. Mantiene le esclusioni concordate: nessuna parità righe/BYE, nessun KO main singolare collegato a RR. Il report distingue anomalie da documenti strutturalmente validi ma non confermati integralmente; non restituisce false certificazioni. Non conserva la risposta ufficiale originale: un successivo confronto indipendente ITF resta necessario per provare la completezza integrale. Un documento assente dall'archivio non prova assenza in ogni altro deposito. I blocchi storici vengono letti tutti, ma sono analizzati solo i documenti della coorte. Validazione locale: sintassi Node, coorte esatta e fixture con documento valido, duplicato e mancante. Workflow remoto da eseguire dopo push.


## Punta Cana 001: qualificazione femminile risolta — 2 ottobre 2026

- Istruzione esplicita utente: considerare risolto J-J30-DOM-2026-001 / G-S-Q-KO e rimuoverlo dallo straordinario. Risoluzione empty_singles_qualification applicata solo a questo evento e solo con tutti i main femminili richiesti acquisiti; nessuna acquisizione inventata. Gli altri casi vuoti restano soggetti alla regola esistente.
- Nuovo modulo itf-user-resolved-qualifications.mjs applicato alla generazione delle code e alla riconciliazione: un audit R2 precedente non rimette il torneo nella coda; la successiva riconciliazione persiste la risoluzione. Richiesti, checks, eventi mancanti, eventi risolti/esclusi e riepilogo ricalcolati in modo coerente. Finestra D+3 Europe/Rome, deduplicazione e workflow di pubblicazione invariati.
- Validazione: tre test Node sul caso autorizzato, main non acquisito, ID differente, idempotenza, code sull’intera coorte 1031 e riconciliazione senza nuove richieste. Acquired invariato; Q esclusa dai richiesti.
- Limite: installer preparato localmente; contatori online da rigenerare dopo push mediante workflow extraordinary lane a, remaining=0. Nessun push/deploy remoto dichiarato eseguito.


## Verifica puntuale ITF D1 in sola lettura — 3 ottobre 2026

- Richiesta utente: verificare i tabelloni acquisiti dal 18/12/2025 fino a oggi e la presenza effettiva in D1. I totali globali non certificano gli ID né i contenuti. Nuovo workflow manuale courtwatch-itf-d1-exact-verification.yml; accesso D1 solo tramite SELECT paginati, R2 solo lettura. Nessuna importazione, creazione database, modifica code o richiesta ITF.
- Selezione degli artefatti popolati con prova di acquisizione nella coorte corrente, esclusione dei futuri e delle risoluzioni senza artefatto; ricerca documenti mancanti. Il seed importer esistente costruisce le righe attese localmente; SQLite locale interpreta esattamente il SQL del generatore. Confronto per ID, relazione torneo/partita, data e payload JSON di ogni partita e risultato, con rapporto per tabellone. Le righe extra non compensano le mancanti.
- Report: dist/v3/audits/itf-d1-exact-verification.json e itf-d1-exact-scope.json come artefatti del run. Il verde certifica soltanto la parità della coorte selezionata, mai la copertura dell’intero catalogo ufficiale dal 18/12/2025. La baseline osservata in preparazione parte dal 24/01/2026; fullPeriodCertified resta false in attesa di verifica indipendente del periodo e del catalogo.
- Validazione: cinque test contro ID diversi con uguali conteggi, contenuti parziali, ordine chiavi JSON, relazione torneo errata e righe extra; integrazione selezione archivio -> seed reale del generatore; controlli sintassi Node/Python e YAML. Verifica remota non ancora eseguita: richiede push e avvio manuale del workflow con le credenziali GitHub esistenti. Nessuna presenza D1 dichiarata verificata nella preparazione.


## Catalogo ITF incrementale e diagnostica corrente — 3 ottobre 2026

- Richiesta utente: eliminare il contatore straordinario residuo di Punta Cana e aggiornare automaticamente diagnostica e code anche per nuovi tornei. La coorte è l’elenco storico dei 1031 ID, conservato come base immutabile di controllo, non più limite alle aggiunte. Cataloghi ufficiali completi aggiungono ID validi con inventario sconosciuto (valori null, nessuna acquisizione inventata), senza cancellare ID o checks esistenti. Le date dei tornei ancora irrisolti si aggiornano dal catalogo; risolti e cancellati conservano le prove. Team GC/team finals/Davis Cup junior/Billie Jean King Cup esclusi. Copertura minima endDate >= 18/12/2025, nessuna garanzia di presenza nel catalogo dei tornei antecedenti al 24/01/2026.
- buildCoverageQueuePlan mantiene unicità, inclusione di tutti gli ID base, registrazione esplicita degli ID aggiunti, parità eventi/prove e 13 cancellazioni confermate. D+3 Europe/Rome e selezione dei soli mancanti preservati. Matrice ordinaria, selettore A/B, diagnostica, preparazione e riconciliazione usano il catalogo corrente; le nuove acquisizioni escono normalmente dalle code.
- Individuato il ritorno a 1 dello straordinario dopo la pubblicazione corretta: snapshot di run antecedenti alla patch ripubblicati in seguito. Publisher ordinario, straordinario e preparatorio rigenerano i contatori dopo l’aggiornamento Git dal codice e audit correnti. Straordinario e refresh condividono il lock courtwatch-v3-itf-publish. Nuovo workflow riutilizzabile/manuale courtwatch-itf-incremental-status.yml, chiamato al termine dei cicli ordinari anche con review saltato e attivato dal catalogo globale completato, persiste audit aggiornato in R2 e pubblica i contatori. Nessun nuovo cron o richiesta ITF nel refresh.
- Validazione: 11 test Node (6 regressioni della pianificazione e 5 nuovi: aggiunte/idempotenza/prove preservate, cataloghi incompleti/team/date invalide, acquisizione nuovo ID, risoluzione Punta Cana da audit vecchio e controlli di integrità base). Controllo sintassi delle sorgenti e YAML dei workflow. Installer con controllo versioni, backup, ripristino su test falliti e append del report.
- Preparazione locale: nessun push/deploy effettuato. Dopo push avviare manualmente Court Watch ITF incremental catalog and diagnostics e verificare contatori e deploy. Run già avviati con codice precedente possono ancora ripubblicare dati vecchi fino al loro termine; i successivi publisher correnti rigenerano i contatori. La parità D1 rimane verifica separata.


## Recupero effettivo ITF dal 18 dicembre 2025, separato dal rolling — 3 ottobre 2026

- Correzione richiesta utente: acquisire tutti i tabelloni pubblicati dal 18/12/2025, non solo diagnosticarli. Workflow manuale courtwatch-itf-history-from-december.yml usa FROM=2025-12-18, HORIZON_DAYS=0 e cinque shard ufficiali con paginazione, valida catalogo e lo conserva separatamente come source_itf_history_tournaments.json. Dopo pubblicazione valida chiama refresh incrementale e avvia entrambe le catene straordinarie bounded (200 batch/corsia) per inventario e acquisizione dei mancanti. Il workflow esistente acquisisce e persiste i documenti in R2; acquired draws D1 sync, già attivato dai T-1 riusciti, importa le righe in D1. Nessuna certificazione di completezza prima di audit finale.
- La ricerca ordinaria conserva cron, FROM rolling 240 giorni e orizzonte futuro esistenti: nessuna ricerca storica completa a ogni ciclo. Recupero storico senza schedule; catalogo storico letto prima del catalogo rolling nei selettori/riconciliazione. Gli ID storici rimangono nell’audit e i relativi metadati sono disponibili all’inventario, anche quando assenti dalla mappa rolling. Nessuna acquisizione inventata, acquisiti già presenti preservati, D+3 Europe/Rome e regole eventi attuali invariati. Pubblicazione storica e audit condividono courtwatch-v3-itf-publish.
- L’installer ripristina anche il workflow catalogo rolling se è stata applicata la precedente proposta con FROM fisso, senza perdere il report precedente. Watchdog ordinario ignora A/B nel controllo di slot/attivi, mantiene anti-duplicazione ordinario e cron 0/15/30/45.
- Validazione locale: YAML e dipendenze catalogo→sync audit→A/B; nessun cron storico; separazione delle finestre; sintassi Node; regressione storico dicembre/gennaio preservato dopo avanzamento rolling; quattro scenari scheduler già verificati. Installer con versioni ammesse, backup e rollback.
- Limiti: nessun push/deploy né acquisizione remota avviati in preparazione. Occorre run storico riuscito, catene A/B, sincronizzazione D1 e audit conclusivo. I 200 batch sono limite di sicurezza; indisponibilità ITF, run falliti o mancato progresso possono richiedere rilancio. Audit 37072709098 ha rilevato anche lacune D1 nello storico già acquisito: il delta dei nuovi batch non ripara da solo tutte le vecchie lacune, per cui serve backfill separato prima della certificazione.


## Rimuovi giocatore con conferma Sì/No — 3 ottobre 2026

- Richiesta: attivare Rimuovi giocatore con il messaggio esatto “Sei davvero sicuro di voler rimuovere [nome] dall’elenco Courtwatch.” e pulsanti Sì/No. Il pulsante sul profilo apre la conferma; il meno nella pagina Giocatori attiva la scelta del giocatore, con azioni Rimuovi. No/Escape annullano. Sì invia una sola richiesta, disabilita i controlli durante il salvataggio, gestisce gli errori senza rimuovere e aggiorna subito elenco, contatori, selezione e cache solo dopo conferma API. Nome escaped e dialog nativo con focus iniziale su No. Azione del profilo avversario non riusa il callback di rimozione.
- API protetta DELETE /app/api/courtwatch-player?playerId=...: autenticazione Access e dispositivo esistenti, verifica link per account, batch atomico di registro rimozione e rimozione del link user_app_players. Nessuna cancellazione di profilo, tornei, risultati, match o analisi negli archivi. Migrazione 0024_user_player_removals registra l’esclusione per account, che continua a valere anche dopo reseeding dei link. Snapshot privato esclude le rimozioni per tutti i dati del giocatore e override manuali; verifica D1 confronta link effettivi più rimozioni intenzionali con archivio.
- Frontend usa appartenenza dello snapshot privato indipendentemente dall’età della generazione; fallback rapido resta autenticato, così i dati pubblici non ripristinano i rimossi. Cache/snapshot con zero giocatori validi; guardia locale protegge da un caricamento iniziato prima della rimozione. Cache bust degli asset v3.js/v3.css in v3.html.
- Validazione: sintassi JS/Worker/verify-d1; test UI del messaggio, No, Sì, errore e doppio click; test API di autenticazione, appartenenza, ID/metodo, scope account e fallimento D1; SQLite con due account, profilo archivio conservato e reseeding che non ripristina la lista. Installer applicato in checkout di prova e diff verificato.
- Nessun push/deploy o rimozione reale durante preparazione. Necessari deploy API verde con migrazione 0024 applicata e pubblicazione frontend verde. Le rimozioni riguardano la lista dell’account, non i motori di acquisizione globale.


## Persistenza tabelloni dal catalogo storico — 3 ottobre 2026

- Causa del fallimento review 37076518863 / 111068862165: persist-itf-t1-draws.mjs consultava soltanto baseline fissa e catalogo rolling; gli otto tornei dicembre/gennaio nuovi erano assenti da entrambi. Tutti i 41 documenti completi su 47 restavano senza mapping canonico, interrompendo proiezione, upload R2 e pubblicazione.
- Correzione: includere source_itf_history_tournaments.json solo se validato con status itf_global_tournament_map_complete; precedenza baseline < storico < catalogo rolling. ID canonici, acquisizione, regole RR, retry tecnici e serializzazione della pubblicazione invariati. Nessuna nuova richiesta ITF per i test.
- Validazione: quattro test Node (mapping storico e conservazione record esistenti/idempotenza, rifiuto catalogo incompleto, precedenza rolling, fallback baseline). Replay locale dei 47 documenti originali: errore originale riprodotto, patch con 41 completi mappati, 6 pending tecnici, 8 tornei e 1192 partite/risultati. Secondo import: zero duplicati o cambiamenti. Installer con preflight hash, checkout tracciato pulito, backup, test e rollback.
- Limiti: preparazione locale, nessun push/deploy o modifica D1 remota. Dopo push su main rilanciare i job falliti del run 37076518863, il cui review esegue checkout main. Confermare review verde, sincronizzazione D1 e audit successivo prima di attestare presenza in D1; i sei documenti tecnici non vengono dichiarati acquisiti.


## Circolo e località Europe, diagnostica sorgenti e dispatch ITF — 3 ottobre 2026

- Verifica diretta della pagina giocatore Virginia Cereghini: una sola scheda Sanxenxo, ma località Sanxenxo (Pontevedra) duplicata nel campo circolo (Círculo Cultural Deportivo Sanxenxo | Sanxenxo (Pontevedra),) e nella città. Correzione generale del rendering Europe: circolo conservato, eliminata località accodata dopo il separatore nel campo circolo; risultato Círculo Cultural Deportivo Sanxenxo · Sanxenxo (Pontevedra), Spain. Stessa funzione per pagina giocatore e luogo torneo/avversario. Non cambia identità tornei, dati D1, incontri o circuito FITP. Sostituisce la prima preparazione locale che interveniva sul raggruppamento ID, non sulla ripetizione osservata.
- Diagnostica: eliminate le sette richieste Actions anonime dal Worker; workflow operativo con token CI esistente pubblica stati compatti e ultimi 50 run, inclusi watchdog e safety ITF. Lettura dei file con fallback raw→Pages, timeout 12 secondi per origine, cache degradata indicata e sorgenti davvero indisponibili identificate singolarmente. Non nasconde errori e non dichiara assenza di fallimenti se lo storico manca. Endpoint admin protetto da autenticazione Basic non disponibile nel browser di verifica: causa HTTP effettiva del banner non osservata; limite dichiarato. Nessun nuovo segreto o permesso.
- ITF: review A 37076518863 tentativo 2 verde, 41 documenti completi e 1192 incontri/risultati nuovi; review B 37076556142 tentativo 2 verde, 41 documenti completi e 1345 incontri/risultati nuovi, 6 retry tecnici per lane. Contatori verificati nei log: A 18 tornei/6 draws noti mancanti/12 inventari, B 23 tornei/6 draws noti mancanti/17 inventari. Ordinario 37154991356 review e continue-ordinary verdi, refresh diagnostico in coda dietro pubblicazione serializzata.
- Prosecuzione A: selector 37155540645 è rimasto bloccato nella curl dispatch dalle 21:51:42Z fino a cancellazione 21:56:34Z, trattenendo gruppo courtwatch-v3-itf-publish. Nessun child extraordinary-a trovato nell’intervallo; job selector 111298063574 rilanciato tramite GitHub. Aggiunti --connect-timeout 10 e --max-time 30 alle dispatch A/B e continuazioni ordinary/extraordinary. Nessun retry automatico del POST per evitare duplicati; serializzazione, D+3 Europe/Rome e acquisizione missing-only invariati.
- Validazione locale: 9 test Node (record reale Sanxenxo, altri circoli Europe, preservazione FITP, fonte CI/fallback/errori/cache/coda fresca), sintassi JS/MJS, parsing YAML delle due definizioni workflow e verifica installer con backup/rollback.
- Limiti: installer locale; nessun push/deploy effettuato. Dopo push attendere Pages, diagnostica operativa e Worker API verdi; verificare pagina autenticata e prosecuzione delle lane. Le definizioni shell di un vecchio rerun non includono i nuovi timeout: valgono per nuovi run dopo push. Nessuna certificazione D1 basata sul solo review verde. Installer v2: corretti gli hash delle due definizioni workflow, la cui copia di preparazione aveva una riga vuota finale aggiuntiva; verificata la base fa8e8781f1.


## Correzione controllo D1 diagnostica — 4 ottobre 2026

- Eliminato il falso positivo sulle letture diagnostiche in index.js:
  il controllo verificava anche SQL preesistente non modificato.
- Ora verifica righe aggiunte e rimosse, aggregando SQL multilinea.
  Conservati requisiti incrementali e test per le mutazioni rilevate.
- Sette scenari di regressione verificati durante la preparazione;
  test planner, controllo e sintassi eseguiti prima del commit.
- Controllo statico euristico: non certifica modifiche indirette.
  Nessuna modifica a dati, interfaccia o acquisizione ITF.
  Deploy da confermare attraverso i nuovi run dopo push.


## Riduzione coda T-1 — 4 ottobre 2026

- A e B pubblicavano gia i contatori nel review, poi attendevano
  un secondo refresh sotto lo stesso blocco di pubblicazione.
- Saltato il refresh dopo review riuscito; mantenuto negli altri casi.
- Checkout e fetch profondita 1 nei job review e refresh.
- Conservati serializzazione, D+3 Europe/Rome, missing-only e duplicati.
- Preparazione verificata: YAML, dipendenze job e 18 test.
- I vecchi run mantengono la vecchia definizione; modifica attiva
  nei nuovi run dopo push. Esito operativo ancora da verificare.


## Ricerca giocatori rimossi — 4 ottobre 2026

- Corretto il ritorno alla Home dalla ricerca di giocatori rimossi.
- Il clic verifica la lista attuale dei seguiti: gli altri risultati
  aprono la pagina avversario con identità e nome.
- Regola generale, valida anche dopo future rimozioni.
- Sei scenari di navigazione e sintassi verificati.
- Verifica nell'app da completare dopo push e Pages verde.


## ITF T-1: pubblicazione JSON sotto il limite GitHub — 5 ottobre 2026

- Causa verificata: run extraordinary-b 37242673360, job review 111554530442, 5 ottobre 01:11 Europe/Rome. I due documenti completi Adana/Guangzhou, 46 nuovi incontri e risultati, audit straordinario zero e generazione R2 erano riusciti. Push rifiutato per dist/v3/universal/results.json da 100,08 MB (GH001); matches.json da 98,61 MB generava un avviso.
- Correzione: helper compact-universal-git-files.mjs riserializza i tre archivi universali senza indentazione conservando ogni record, campo e timestamp. Preflight di tutti i file e limite prudenziale 95 MiB dopo compattazione, nessun taglio di dati; file invalidi/mancanti sono errori. Persistenza ITF lo esegue anche su importazioni ripetute senza nuovi record; publisher T-1 lo esegue prima dello snapshot Git anche senza task di acquisizione. R2 e letture D1/JSON restano compatibili. Recupero artifact ora condivide courtwatch-v3-itf-publish con le pubblicazioni ITF, queue max, senza cancellazioni.
- Componenti: helper e test nuovi, persist-itf-t1-draws.mjs, workflow T-1 e persistence-recovery. Nessuna modifica a D+3 Europe/Rome, soli mancanti, chiavi/deduplica, cron e lane.
- Validazione: 7 test Node passati (equivalenza JSON inclusi UTF-8, timestamp e campi null/zero/false; idempotenza; oversize prima di ogni scrittura; file invalidi; recupero storico, mappe incomplete, precedenze e fallback). Copia reale locale: 41.527 incontri e 41.527 risultati invariati; matches 92.386.053→54.188.072 byte, results 93.766.419→55.568.438 byte. Sintassi JS, YAML e ordine prima snapshot verificati; installer verificato con backup/rollback, applicazione e riapplicazione.
- Limiti: misure su copia locale, non sugli esatti byte del job fallito. Nessun push/deploy remoto eseguito. Compattazione risolve l'ingombro di formattazione; il controllo interrompe la pubblicazione qualora in futuro il contenuto compatto raggiunga 95 MiB e richieda migrazione di storage. Dopo push avviare un nuovo persistence-recovery da main con run_ids=37242673360 per riproiettare i documenti salvati senza riacquisire ITF, attendere push e deploy app-api verdi prima di dichiarare distribuito.


## Antananarivo: identità edizione e inventari ignoti — 5 ottobre 2026

- Richiesta: verificare e sistemare J30 Antananarivo e la corrispondenza fra spia mancanti e torneo. Controllo diretto delle pagine ITF: Leg 1 J-J30-MAD-2026-002 (29 settembre–4 ottobre) mostra tabelloni e risultati; Leg 2 J-J30-MAD-2026-003 (6–10 ottobre) mostra l’avviso di tabelloni non ancora pubblicati. La riga ordinary inventory_empty riguarda Leg 2, non Leg 1. Questa osservazione vale al momento del controllo, non prova una futura assenza.
- Componenti: cloudflare/app-api/src/index.js. Date e link ufficiale di ciascuna delle due edizioni nella tabella; utilizzo del sourceUrl ufficiale quando presente per gli altri tornei. Totali etichettati come mancanti noti, con conteggio separato delle righe needsInventory o missingDraws null/assente. Inventario vuoto resta sconosciuto e da ritentare; non diventa zero o completo.
- Validazione: sintassi Node; verifica rendering delle due identità, conteggi misti noti/ignoti, valori null/assenti e URL non ufficiali; applicazione installer, idempotenza e git diff --check.
- Limiti: correzione preparata, nessun push/deploy. La mancata pubblicazione della Leg 2 non richiede inventare sei tabelloni dai tipi programmati nel factsheet. Nessuna modifica di acquisizione, D+3 Europe/Rome, scheduler, prevenzione duplicati, serializzazione o dati D1. Dopo push attendere deploy Worker verde e verificare /admin/diagnostica.


## 2026-10-05 — ITF: documenti completi in D1 e sync automatico

Priorità utente: tutti i tabelloni ITF già acquisiti devono risiedere in D1; ogni nuova acquisizione deve essere importata automaticamente. I tabelloni ancora mancanti in ordinario sono esclusi dal perimetro certificabile. Nessuna nuova richiesta a ITF e nessuna implementazione del futuro motore OOP/risultati.

- Migrazione 0025: manifest e chunk dei documenti JSON integrali, versioni immutabili indicizzate per competizione/evento/SHA-256, vista dell'ultima versione completa. Conservati giocatori, incontri, gironi e campi originali; chunk Unicode limitati per rispettare la dimensione SQL.
- Builder: acquisizione valida secondo la policy esistente più prova concreta di giocatori/incontri; RR con tutti i gironi. Dedup competizione/evento, selezione dell'ultimo documento completo (un retry successivo non lo sostituisce). UPSERT incrementali senza DELETE; replay identico senza riscritture; proiezioni incontri/risultati con controllo timestamp per non retrocedere dopo recovery.
- Backfill: archivio storico R2 corrente più tutti i documenti live R2; verifica SHA-256/byte/conteggio dei blocchi prima dell'estrazione. Nessun denominatore 4291/17 hardcoded. Gate esplicito se un tabellone dell'archivio certificato non ha contenuto valido. Parte al push di questa modifica o dopo una nuova archiviazione storica riuscita.
- Sync automatico: workflow_run T−1 e recovery, anche se fallisce una fase successiva alla conservazione degli artefatti. Include upload retry. Errori di download e artefatti scaduti non sono trattati come assenza di dati. Recovery conserva un artefatto dedicato per l'ingestione D1. Migrazioni applicate prima dell'import; scritture serializzate nel gruppo courtwatch-d1-writes con queue:max.
- Verifica remota: lettura integrale per chiave/versione, ricostruzione, confronto SHA-256, byte, chunk, giocatori e incontri. Audit separato content-verification; zero documenti completi è no-op e NON prova di copertura.

Validazione locale: cinque test Node verdi (Unicode/documenti grandi, esclusioni e RR, corruzione/chunk mancanti, SQLite replay/vista ultima versione, builder/import SQL end-to-end); sintassi Node/Python e parsing YAML verificati. Installer con controlli preventivi dei file originali, backup, report aggiornato e test locali; nessun commit/push automatico.

Limiti: patch preparata e verificata localmente, NON distribuita. Certificazione D1 solo dopo push, backfill verde e audit remoto verified_acquired_documents con expectedDocuments=verifiedDocuments e missingOrCorrupt vuoto. Questo certifica i documenti acquisiti, non tutti i tabelloni ufficiali ancora non acquisiti, non gli esiti finali aggiornati e non tutte le pagine frontend. D+3 Europe/Rome, missing-only e selettori T−1 restano invariati. Versioni precedenti conservate senza garbage collection. Add-player rimandato.


## 2026-10-05 — Correzione coda D1
Allineati deploy API e agenda Europe a queue:max nella coda condivisa courtwatch-d1-writes, mantenendo scritture serializzate e cancel-in-progress:false. Il backfill ITF riparte al push di questa correzione. Run precedente cancellato prima di qualsiasi job; importazione e certificazione remota ancora da completare.


## 2026-10-05 — ITF D1: sblocco archivio con prova insufficiente
Il backfill 37246642326/job 111566024284 ha verificato i 4291 documenti R2 e preparato 5335 documenti acquisiti, poi si è fermato prima di migrazione/import per J-J30-FIN-2026-004|G-S-Q-KO: prova del contenuto acquisito insufficiente. La causa non era la coda o un errore di scrittura D1.
Correzione: conservare integralmente anche i documenti provenienti dall'archivio R2 verificato che non superano la policy di acquisizione, nella nuova tabella separata itf_draw_unverified_documents (migrazione 0026). Non vengono dichiarati completi, né proiettati come partecipazione/incontri/risultati. I tentativi incompleti ordinari restano esclusi. Un documento completo mantiene precedenza rispetto a un documento archivio non verificato; errori di JSON/identità restano bloccanti. Chunk condivisi immutabili, nessun DELETE, nessuna ricostruzione di tabelle esistenti, replay senza riscrittura degli stessi dati.
Verifica remota su entrambe le classi per chiave/versione/stato, hash e byte integrali; audit archivedUnverified esplicito e stato verified_saved_documents_with_unverified_acquisition quando presenti. Presenza in D1 e completezza dell'acquisizione sono distinte: il verde certifica solo la presenza/integrità dei documenti attesi, non la partecipazione nel documento senza prova. Trigger automatici T-1/recovery invariati; il push della patch avvia il backfill.
Validazione locale: 7 test Node/SQLite verdi, inclusi documento vuoto archivio senza promozione, builder archivio con un documento completo e uno non verificato, hash/corruzione/Unicode, replay e selezione di versioni. Sintassi Node e YAML verificate. Limite: caso riprodotto con fixture sintetica; nessun nuovo import D1 remoto o deploy dichiarato prima del run verde.

Richiesta aggiuntiva utente: G-S-Q-KO deve essere recuperato, non solamente conservato. Aggiunti recovery mirato Hanko con parametri ufficiali del baseline (tournamentId 1100202439), singola richiesta di tabellone G-S-Q-KO e verifica obbligatoria di contenuto popolato. Nessuna inventoriazione o riacquisizione degli altri tabelloni del torneo. Workflow dedicato al push/manuale, persistenza R2 e riconciliazione coverage sotto lock di pubblicazione condiviso; D1 sync ascolta la sua conclusione e verifica il nuovo documento. Risposta vuota/tecnica lascia recovery rosso. Due test mirati ulteriori: 9 test locali complessivi verdi. Il recupero ufficiale non è ancora eseguito e il successo non è dichiarato prima del run verde.


## 2026-10-05 — Hanko prima del trasferimento D1, intervento autonomo autorizzato
Utente autorizza eccezionalmente correzioni e pubblicazione autonome fino a recupero e import D1. Recovery 37275394299: risposta 24 incontri/0 giocatori, validazione fallita; nessun recupero dichiarato. Backfill 37275394277 era partito in parallelo con la precedente configurazione. Aggiunta diagnosi mirata con stop di quel backfill se ancora attivo, rilettura dei parametri ufficiali solo Hanko, risposta JSON originale del solo G-S-Q-KO via client diretto e browser indipendente; artefatti diagnostici separati e non importati come tabelloni acquisiti. Backfill ora senza trigger push, con avvio dopo recovery riuscito e gate R2 obbligatorio di documento Hanko popolato prima di qualsiasi import dell'archivio. Nessuna promozione di risposte vuote o dati inventati. Validazione sintassi Node e YAML verde. Diagnosi ufficiale, recupero e certificazione remota ancora in corso; scritture eventualmente già eseguite dal precedente run non sono cancellate né rollbackate.


## 2026-10-05 — Esito diagnosi ufficiale Hanko e sospensione backfill
Commit 22fa5b6eff815490738bfda85a39129d2bdf89fd pubblicato autonomamente su autorizzazione utente. Diagnosi 37276386805/job 111654219540 verde: parametri ufficiali riletti e coincidenti (tournamentId 1100202439, tourType N, weekNumber 0, G-S-Q-KO); sia client diretto sia browser Chrome ufficiale restituiscono 24 incontri, 96 slot giocatore null, 0 identificativi, 0 nomi in qualsiasi oggetto della risposta. Artefatto 11329938899 contiene le risposte raw, report e fresh-events. Quindi nessun campo anagrafico è perso dal parser. Ricerca alternativa su pagina ITF e federazione finlandese non ha individuato un PDF di qualificazioni popolato; questo non prova che le qualificazioni non siano state disputate. Nessuna dichiarazione di recupero o di partecipazione per quel documento.
Backfill 37275394277 cancellato dal controllo autorizzato. Aveva già importato file SQL fino a 0107.sql prima della cancellazione, quindi D1 è parzialmente popolato; verifica integrale finale non eseguita e copertura non certificata. Nessun DELETE/rollback. Gate nuovo impedisce successivi backfill prima di un documento Hanko popolato presente in R2. Recupero attualmente bloccato dalla mancanza di dati ufficiali: occorre risposta ufficiale popolata/PDF della stessa qualificazione oppure un'evidenza distinta che autorizzi la risoluzione come qualificazione vuota/non disputata secondo le regole del progetto. Non vengono reiterate richieste identiche a una risposta storica vuota né fabbricati giocatori. Stato lavoro incompleto: archivio D1 sospeso in attesa di tale prova.


## ITF D1: qualificazione vuota Hanko risolta — 2026-10-05

Su conferma esplicita dell’utente, J-J30-FIN-2026-004 / G-S-Q-KO è una qualificazione senza giocatori, risolta. I controlli indipendenti della fonte hanno mostrato 24 righe di match vuote e nessun giocatore. Il documento integrale resta conservato con SHA-256 e stato resolved_empty_qualification nella tabella di archivio non popolato, senza certificare partecipanti o proiettare match/risultati fittizi. La risoluzione è limitata a questa chiave; errori tecnici restano non risolti.

Componenti: modulo documenti D1, builder, verifica contenuto, test e backfill. Rimosso il blocco che richiedeva giocatori nella qualificazione; il push del workflow avvia il backfill. Serializzazione courtwatch-d1-writes/queue:max mantenuta. Documenti immutabili e importazione idempotente; nessuna cancellazione dei dati esistenti. Le proiezioni incrementali già esistenti continuano ad applicare le protezioni temporali. Sincronizzazione automatica futura invariata, attivata al completamento dei workflow T-1 e persistence recovery.

Validazione locale: 8 test Node passati, inclusi Unicode, SHA-256, righe corrotte, replay SQLite senza nuove scritture, protezione versioni più recenti, archivio non verificato e qualificazione Hanko risolta senza proiezioni. Limite: l’importazione remota va certificata solo dopo backfill verde e audit expectedDocuments=verifiedDocuments, missingOrCorrupt=[] e archiveMissing=[]. Restano esclusi i tabelloni ordinari ancora da acquisire; fullPeriodCertified resta false.

## Aggiungi giocatore e + operativi — 2026-10-06

Motivo: + non aveva un handler, il pulsante avversario non salvava la selezione e il caricamento eliminava profili assenti dai JSON statici. Entrambi i controlli nella pagina Giocatori aprono la ricerca; la selezione e il pulsante Aggiungi giocatore nella pagina Avversario salvano la scelta tramite POST autenticato e aprono player/<id> dopo conferma server.

Componenti: v3.js/v3.html (asset 2026100601), Worker app-api, nuovo helper courtwatch-player-additions.mjs, migrazione 0027_user_player_additions.sql, verificatore UI e test inclusi in npm run check. La lista personale è separata dalle proiezioni rigenerate e viene letta dal private app-snapshot. L’identità viene risolta dal source_key ufficiale, riutilizzando il giocatore configurato solo per identificatore di circuito esatto; il fallback per avversari con ID locale richiede un nome esatto e univoco. Omonimi ambigui richiedono selezione del profilo in +. Nessun nuovo profilo viene promosso prima della conferma D1.

D1_WRITE_POLICY: incremental. buildIncrementalSyncPlan controlla la variazione puntuale; selezione identica = zero scritture, re-aggiunta dopo rimozione modifica solo il collegamento e il tombstone. Nessuna riscrittura degli archivi ITF o dei tabelloni. Scelte personali isolate per utente e preservate nei rebuild app_players. Lo snapshot mostra le iscrizioni già indicizzate del circuito selezionato, senza limitarle agli ultimi cinque tornei. La generazione dello storico completo delle partite per profili nuovi e il motore risultati ITF OOP restano lavori successivi.

Validazione: 11 test passati su SQLite reale e flusso UI Node VM (aggiunta, replay, rimozione/re-aggiunta, ricostruzione proiezioni, identità mancanti/ambigue, riutilizzo ID ufficiale, isolamento utente, autenticazione/origine, doppio clic, errore POST e permanenza dopo reload con JSON statico più recente). Verificatore UI preesistente verde; controllo globale D1 sulle mutazioni verde; controlli sintattici e git diff --check passati. Installer verificato su copia Git dei sorgenti correnti. Non è una verifica visuale del browser o una certificazione di produzione.

Distribuzione: push e deploy verde necessari. Il workflow generale Court Watch Cloudflare D1 and app API applica la migrazione nella coda serializzata courtwatch-d1-writes; il Worker hotfix può distribuire il codice prima della migrazione. In quel breve intervallo il nuovo POST restituisce 503 senza modificare dati; la lettura esistente resta disponibile. Operatività confermata solo dopo migrazione e deploy verdi e verifica autenticata nell’app.

## ITF: riconciliazione mirata 10 qualificazioni + 4 doppi — 2026-10-06

Motivo: i 62 pendingTasks del backfill sono chiavi con tentativi senza documento completo, non errori dell’import D1. Coda successiva: 44 tabelloni ordinari ancora da acquisire; i quattro doppi Lautoka/Albany non più mancanti richiedono prova D1 individuale. Le dieci qualificazioni sono Istanbul, Algiers, Punta Cana leg 1/2, Surabaya, Antananarivo leg 1, Vilamoura, Bursa, Phan Thiet e Leon. Assenza dalla coda non prova da sola risoluzione o acquisizione.

Componenti nuovi: prepare-itf-14-repair.mjs, download-itf-14-repair.py, test mirati e workflow courtwatch-itf-14-d1-repair.yml. Si leggono soltanto i prefissi R2 dei 14 task e dei main dello stesso sesso necessari come prova, con SHA-256 del file compresso; nessuna scansione completa di R2, nessuna richiesta ITF o modifica alla coda. Qualificazione risolta soltanto con risposta realmente senza giocatori, senza errore tecnico, e artefatti main completi; per RR tutti i gruppi dichiarati devono risultare acquisiti. Un override manuale non sostituisce il documento popolato. I documenti vuoti originali sono conservati nella tabella non popolata, con hash integrale e risoluzione separata nell’audit; nessuna proiezione di partecipanti/match/risultati fittizi.

Riutilizzati builder, import incrementale e verifica completa D1 esistenti; lock courtwatch-d1-writes con queue:max. Nessun DELETE, nessuna riscrittura di righe identiche, protezione delle versioni recenti invariata. Il workflow certifica tutti i 14 soltanto se ogni target ha prova e ogni documento selezionato è riletto correttamente da D1; eventuali documenti legittimi possono essere importati anche se altri target restano pending, ma il controllo conclusivo resta rosso. Se un documento completo non è presente in R2 o manca prova main, occorre recuperare quel documento: non viene dichiarato risolto automaticamente.

Validazione locale: 14 test verdi, inclusi SQLite/replay esistenti, qualificazioni vuote, sesso, RR incompleto, errori tecnici, precedenza del completo rispetto al retry e pipeline prepare/build/finalize con hash intatto e rifiuto di certificazione parziale. Sintassi Node/Python/YAML verificata; installer applicato due volte e git diff --check sui soli file coinvolti. Limite: preparazione locale; nessuna esecuzione remota di questo workflow certificata prima di push e verde. Il push del workflow avvia un solo intervento; nessuna schedulazione aggiunta. Il vecchio audit globale non è riscritto retroattivamente.

## ITF 14: compatibilità macOS e rimozione pulsante testuale — 2026-10-06

Causa riprodotta: os.tmpdir su macOS restituisce un percorso attraverso collegamento simbolico; il builder confrontava il root archivio logico con il cwd fisico. La fixture perdeva così il documento vuoto e row.sha256 falliva. Test corretto con fs.realpath della cartella temporanea e process.execPath per i subprocessi. Non si salta alcuna verifica. Riproduzione prima rossa con lo stesso TypeError; dopo correzione 14/14 test verdi con TMPDIR simbolico.

Su richiesta utente, rimosso il pulsante testuale Aggiungi giocatore dalla pagina Giocatori e relativo handler; il + resta funzionante. Asset v3.js aggiornato a 2026100602. I controlli nella pagina Avversario restano disponibili. Quattro test UI preesistenti verdi e sintassi JS verificata. Installer v2 verificato anche con TMPDIR simbolico, applicazione ripetuta e aggiornamento da v1. Push/deploy e audit D1 remoto restano necessari; nessuna certificazione anticipata dei 14.

## ITF 14 installer v3: conservazione UI locale — 2026-10-06

Rimosso il guard completo sul frontend: si modifica esclusivamente il pulsante addPlayerLabel, relativo handler e versione asset, preservando il resto del contenuto locale. + mantenuto. Verificato con differenze locali di HTML/JS e TMPDIR simbolico, 18 test verdi e replay senza ulteriori cambiamenti. Nessun push/deploy anticipato.
