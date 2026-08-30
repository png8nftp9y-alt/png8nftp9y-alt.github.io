# Court Watch — report continuo

Ultimo aggiornamento: 30 agosto 2026, 18:36 UTC

## Stato certificato

- Motore Tennis Europe OOP e risultati: **verde**.
- Archivio storico R2: **verde**, 453 tornei conclusi elaborati.
- Snapshot live R2: **verde**, aggiornamento autonomo ogni 15 minuti.
- Import relazionale D1: **verde**.
- Deploy Worker e parità applicativa: **verdi**.
- Agenda pubblica: proiezione OOP non ancora attivata; resta invariata fino alla certificazione dei collegamenti Court Watch.

## Tennis Europe OOP e risultati in D1

| Voce | Conteggio certificato |
|---|---:|
| Tornei OOP unificati | 474 |
| Match storici | 47.048 |
| Match nello snapshot live acquisito | 1.075 |
| Match unificati e deduplicati | 48.123 |
| Risultati completati | 47.813 |
| Match programmati | 310 |
| Partecipazioni giocatore-match | 117.028 |
| Identità nominali Europe | 10.695 |
| Match con vincitore irrisolto | 0 |
| Conflitti di merge | 0 |

Lo storico e il live vengono uniti per ID del match. Il record live sostituisce la versione storica dello stesso incontro, evitando duplicati.

## Struttura D1

I dati Europe sono consultabili tramite tabelle relazionali:

- `tournaments`: torneo e identificativo TennisTournamentSoftware;
- `matches`: incontro, evento, turno e payload ufficiale;
- `schedules`: giorno, ora e campo dell’OOP;
- `results`: punteggio e vincitore;
- `match_participants`: giocatori, squadra e stato vincitore;
- `tennis_europe_players`: indice delle identità Europe osservate.

## Incidente import D1 del 30 agosto

Il primo import ha fallito con `SQLITE_TOOBIG` nello step `00-foundation.sql`. Il payload del torneo live conteneva anche l’intero array dei match, creando una singola istruzione oltre il limite SQLite.

Correzione applicata:

- eliminata la duplicazione dei match nel payload torneo;
- separati reset, tornei e identità;
- identità suddivise in blocchi da 500;
- match suddivisi in 64 shard;
- import complessivo suddiviso in 88 file;
- conteggi e contenuti invariati.

Run fallito documentato: [33327987374](https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/33327987374).

Run finale certificato: [33328166143](https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/runs/33328166143).

## D1 complessivo dopo l’import

| Tabella/indice | Conteggio |
|---|---:|
| Tornei complessivi | 670 |
| Calendari/OOP complessivi | 48.175 |
| Match | 48.123 |
| Risultati | 47.813 |
| Profili osservati complessivi | 87.473 |
| Profili osservati FITP | 74.740 |
| Profili osservati Tennis Europe | 12.235 |
| Profili osservati ITF | 498 |

## Anomalia aperta: indice osservati ITF

Nel run D1 verde l’indice ITF è stato ripristinato da `backup-1`, non da `current`, e contiene soltanto 498 profili. FITP e Tennis Europe provengono invece da `current`.

Questa anomalia non riguarda né riduce i 48.123 match OOP Europe appena certificati. Deve però essere corretta prima di considerare nuovamente completo l’indice universale dei giocatori osservati.

## Prossimo passo

1. ripristinare e ricertificare l’indice osservati ITF `current`;
2. verificare il collegamento esatto dei match Europe ai giocatori Court Watch;
3. confrontare la proiezione con il file Excel di audit;
4. solo dopo la parità, attivare OOP e risultati nell’agenda del giorno corretto.
