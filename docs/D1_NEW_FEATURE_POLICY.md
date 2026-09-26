# Regola obbligatoria per nuove funzioni D1

Ogni nuova funzione che scrive in D1 deve utilizzare una sincronizzazione incrementale.

## Comportamento obbligatorio

1. Con D1 vuoto, la prima importazione inserisce tutti i dati validi.
2. Dalla seconda importazione:
   - dati identici: zero scritture;
   - dati nuovi: INSERT;
   - dati modificati: UPDATE;
   - dati realmente rimossi: DELETE.
3. Ordine, formattazione e timestamp tecnici non devono produrre false modifiche.
4. Una fonte vuota o incompleta non può cancellare dati D1 validi.
5. Quantità elevate di dati realmente nuovi o modificati devono essere accettate.
6. Solo cancellazioni anomale o massive devono bloccare l'importazione.
7. Una nuova funzione non conforme deve fallire nei controlli prima della pubblicazione.

## Test obbligatori

- prima importazione completa;
- seconda importazione identica con zero scritture;
- applicazione esclusiva delle differenze reali;
- protezione da fonti vuote o incomplete.
