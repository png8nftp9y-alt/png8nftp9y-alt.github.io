# Virginia Cereghini — percorso FITP senza numero atteso

Obiettivo: trovare tutti i tornei FITP di Virginia Cereghini dal 18/12/2025 senza sapere in anticipo quanti devono essere.

Principio: non usare un numero target. Il processo termina solo quando piu fonti indipendenti convergono e nessuna nuova fonte aggiunge tornei nuovi.

## Identita giocatrice

- Nome canonico: Virginia Cereghini
- Tessera FITP: 3987201066
- Alias forti:
  - VIRGINIA CEREGHINI
  - CEREGHINI VIRGINIA
- Alias deboli solo per ricerca, mai per conferma finale:
  - CEREGHINI
  - VIRGINIA

## Fonti da interrogare

### 1. P.U.C. competizioni

Ricerca ampia per finestre settimanali dal 18/12/2025.

Termini:
- vuoto
- CEREGHINI
- VIRGINIA CEREGHINI
- CEREGHINI VIRGINIA
- JUNIOR NEXT GEN
- SUPER NEXT GEN
- CAMPIONATI ITALIANI
- QUALIFICAZIONE
- KINDER
- TENNIS TROPHY
- RODEO
- UNDER 13
- UNDER 14
- U13
- U14
- FEMMINILE

Per ogni competizione candidata:
- caricare dettaglio competizione
- confermare Virginia solo se compare tessera 3987201066 o nome completo normalizzato
- estrarre tabelloni dove compare

### 2. Tabelloni e risultati FITP

Non basta l'iscrizione. Per ogni competizione candidata e per ogni competizione gia presente in `data.matches`:
- scaricare tutte le sezioni/tabelloni
- cercare Virginia come giocatrice in match singolo o doppio
- se compare in almeno un match, creare/validare il torneo anche se non risultava dalle iscrizioni

### 3. Pagine pubbliche FITP/news

Cercare pagine ufficiali FITP che contengono Virginia e termini torneo/circuito.

Query web/API:
- `site:fitp.it "Virginia Cereghini" "2026" "Junior Next Gen"`
- `site:fitp.it "Cereghini" "2026" "FITP"`
- `site:fitp.it "Virginia Cereghini" "Doppio Under 14"`
- `site:fitp.it "Virginia Cereghini" "Campionati Italiani"`
- `site:fitp.it "Virginia Cereghini" "Tennis Trophy"`

Le news non bastano da sole per confermare una riga definitiva: servono come fonte di candidate tournament discovery. Dopo aver trovato nome/data/sede, bisogna cercare la competizione P.U.C. corrispondente o un tabellone/risultato ufficiale.

### 4. Profilo pubblico giocatrice

Usare il profilo pubblico FITP/aggregato come seed di candidate, non come verita finale. Se un profilo elenca tornei, ogni torneo va poi riconciliato con P.U.C. o tabellone.

## Strategia di convergenza

Si mantiene un set `candidates` con stato:

- `seeded`: trovato da ricerca/lista/news/profilo
- `validated_entry`: Virginia presente nel dettaglio iscritti P.U.C.
- `validated_match`: Virginia presente in un tabellone/risultato FITP
- `validated_public_official`: Virginia presente in pagina ufficiale FITP con torneo identificabile
- `rejected`: omonimia, altro circuito non FITP, data fuori copertura, non verificabile

Un torneo entra nell'app se ha almeno:
- `validated_entry`, oppure
- `validated_match`, oppure
- `validated_public_official` + competizione P.U.C. risolta per nome/data/sede.

Il processo non usa un numero atteso. Si ferma quando:

1. tutte le candidate sono validate o rejected;
2. una seconda passata sulle stesse fonti non aggiunge nuove candidate;
3. i tornei finali sono stabili per due run consecutive;
4. il report mostra chiaramente candidate scartate e motivi.

## Output richiesti

Scrivere sempre:

- `virginia-fitp-candidates.json`
- `virginia-fitp-final.json`
- `virginia-fitp-discovery-log.json`

`virginia-fitp-final.json` deve contenere:

```json
{
  "player": "Virginia Cereghini",
  "coverageFrom": "2025-12-18",
  "expectedCountUsed": false,
  "status": "complete|needs_review",
  "finalCount": 0,
  "tournaments": [],
  "rejected": [],
  "openCandidates": []
}
```

## Regola importante

Se il risultato finale e diverso da quello che ci si aspettava manualmente, non forzare il numero. Bisogna mostrare:
- cosa e stato trovato;
- da quale fonte;
- cosa e rimasto candidato ma non validato;
- perche e stato scartato.

Solo cosi il codice puo arrivare a 8 senza sapere che 8 e il numero corretto.
