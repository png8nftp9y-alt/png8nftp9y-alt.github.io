# Court Watch — backup locale verificato

Questo strumento crea una copia locale indipendente del database Cloudflare D1 e degli archivi persistenti R2 usati dai motori FITP, ITF e Tennis Europe.

## Contenuto

Ogni esecuzione salva:

- export SQL completo di D1 `courtwatch-app`;
- database SQLite locale apribile con DB Browser for SQLite, DBeaver o `sqlite3`;
- prefisso R2 `fitp/cache`;
- prefisso R2 `itf/database`;
- prefisso R2 `itf/history-draws`, inclusi i 17 blocchi certificati dei 4.291 tabelloni;
- prefisso R2 `tennis-europe/cache`;
- prefissi R2 `tennis-europe/oop-history` e `tennis-europe/oop-live`;
- manifest con checksum SHA-256;
- verifica SQLite `PRAGMA integrity_check`.

Il backup termina con errore se uno dei sei prefissi R2 è vuoto o se lo storico ITF contiene meno di 17 blocchi.

Le copie vengono salvate per impostazione predefinita in `.courtwatch-backups/`, che non deve essere pubblicata nel repository.

## Requisiti

- Node.js e npm;
- AWS CLI;
- SQLite 3;
- credenziali Cloudflare per Wrangler;
- credenziali R2 S3.

Autenticare Wrangler una volta:

```bash
npx wrangler login
```

Configurazione guidata consigliata (rileva l'Account ID da Wrangler, crea il profilo AWS locale e prova il bucket in sola lettura):

```bash
bash tools/backup/setup-courtwatch-r2.sh
```

Le credenziali rimangono nel profilo AWS locale; lo script salva in `~/.courtwatch-backup.env` soltanto Account ID, bucket e nome del profilo.

Configurare R2 nella sessione:

```bash
export R2_ACCOUNT_ID="..."
export R2_BUCKET="..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

Non salvare queste credenziali nel repository.

## Esecuzione

Dalla radice del repository:

```bash
bash tools/backup/backup-courtwatch.sh
```

Per salvare su un disco esterno:

```bash
bash tools/backup/backup-courtwatch.sh "/Volumes/Backup/CourtWatch"
```

Se D1 è già stato esportato e certificato, completare soltanto la copia R2 senza richiamare Wrangler:

```bash
COURTWATCH_R2_ONLY=1 bash tools/backup/backup-courtwatch.sh "/percorso/backup"
```

Su Windows è consigliato WSL; indicare un percorso montato, per esempio `/mnt/d/CourtWatch-backup`.

## Pianificazione consigliata

Eseguire una volta alla settimana sul computer o NAS locale. Su macOS/Linux si può usare cron:

```cron
30 3 * * 0 cd /percorso/png8nftp9y-alt.github.io && /usr/bin/env bash tools/backup/backup-courtwatch.sh /percorso/backup >> /percorso/backup.log 2>&1
```

Il computer deve essere acceso e connesso. Per eliminare automaticamente le copie giornaliere più vecchie di 30 giorni, impostare esplicitamente `COURTWATCH_PRUNE=1`. Senza questa variabile non viene eliminato nulla.

Su macOS, dopo la prima copia completa verificata, installare il job settimanale `launchd`:

```bash
bash tools/backup/install-weekly-backup-macos.sh
```

Il job viene controllato ogni domenica alle 04:30 ora locale e anche al caricamento del LaunchAgent dopo login/riavvio. `run-backup-if-due.sh` esegue la copia soltanto se l'ultimo backup riuscito ha almeno sei giorni o non esiste; in caso contrario termina senza scaricare nulla. In questo modo un'esecuzione persa a Mac spento viene recuperata al primo login successivo. I log sono in `~/CourtWatch-backup/logs/`.

## Ripristino

La copia SQLite serve per consultazione e verifica. L'export SQL compresso può essere decompresso e importato in una nuova istanza D1 dopo una verifica manuale. Non eseguire mai il ripristino direttamente sul database operativo senza una copia aggiuntiva e un controllo dei conteggi.

## Sicurezza

La directory di backup può contenere dati completi. Tenerla fuori dal repository pubblico e proteggere il disco con cifratura del sistema operativo. La copia locale è realmente indipendente soltanto se risiede fuori dall'account Cloudflare.
