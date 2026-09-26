# Court Watch — Regola obbligatoria per nuove funzioni D1

Questa regola si applica esclusivamente alle nuove funzioni che scrivono in Cloudflare D1.

## Requisiti obbligatori

Ogni nuova funzione deve:

1. inserire soltanto record realmente nuovi;
2. aggiornare soltanto record il cui contenuto è realmente cambiato;
3. produrre zero scritture per record identici;
4. ignorare timestamp tecnici nel confronto dei contenuti;
5. utilizzare identificativi stabili e deterministici;
6. effettuare cancellazioni soltanto per dati realmente rimossi e verificati;
7. impedire cancellazioni e ricostruzioni complete durante i run ordinari;
8. essere idempotente: un retry non deve duplicare né riscrivere dati;
9. calcolare e registrare inserted, updated, deleted e unchanged;
10. passare un controllo preventivo prima dell’esecuzione su D1.

## Funzionamento in caso di errore

Se il controllo rileva una riscrittura completa, un delta anomalo, uno snapshot
vuoto o incompleto, la nuova importazione deve fermarsi prima di scrivere.

L’app continua a utilizzare gli ultimi dati validi già presenti in D1.

## Ambito

Questa regola non modifica i motori FITP, Tennis Europe, ITF e D1 attualmente
in produzione. È obbligatoria per nuove funzioni, incluso il futuro ordine di
gioco ITF e qualsiasi nuova tabella o sorgente D1.
