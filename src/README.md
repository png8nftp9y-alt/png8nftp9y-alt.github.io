# Court Watch rewrite architecture

Obiettivo: rendere il flusso dati chiaro, verificabile e non distruttivo.

## Regola principale
Nessuna fonte scrive direttamente nell'app finale. Ogni sorgente produce dati intermedi; solo il motore di build finale genera i file pubblici.

## Pipeline
1. `players/current.json` e `players/former.json`
2. sorgenti separate in `src/sources/*`
3. match ufficiali normalizzati
4. agenda separata dai match
5. override manuali applicati per ultimi
6. audit bloccante prima della pubblicazione

## File pubblici futuri
- `dist/players.json`
- `dist/former-players.json`
- `dist/tournaments.json`
- `dist/matches.json`
- `dist/agenda.json`
- `dist/status.json`

## Compatibilità
La vecchia app continua a leggere `data.json`. La riscrittura produce prima file paralleli, poi verrà collegata al frontend solo dopo verifica.
