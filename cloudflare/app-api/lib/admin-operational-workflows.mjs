// Presentation only: current production acquisition/publication and operational checks.
// This list never enables, disables or reschedules a workflow.
export const ADMIN_OPERATIONAL_WORKFLOWS=[
 ['courtwatch-v3-fitp-tournaments-sharded.yml','FITP · catalogo provinciale'],
 ['courtwatch-v3-fitp-entries.yml','FITP · iscrizioni e cancellazioni'],
 ['courtwatch-fitp-player-metadata.yml','FITP · circoli e classifiche'],
 ['courtwatch-v3-tennis-europe-sharded.yml','Europe · catalogo tornei'],
 ['courtwatch-v3-tennis-europe-live.yml','Europe · iscrizioni'],
 ['courtwatch-tennis-europe-oop-live.yml','Europe · ordine di gioco e risultati'],
 ['courtwatch-tennis-europe-rankings.yml','Europe · classifiche'],
 ['courtwatch-tennis-europe-agenda.yml','Europe · pubblicazione agenda in D1'],
 ['courtwatch-v3-itf-tournaments-sharded.yml','ITF · catalogo tornei'],
 ['courtwatch-v3-itf-live.yml','ITF · discovery e iscrizioni'],
 ['courtwatch-v3-itf-known-fast.yml','ITF · aggiornamento iscrizioni note'],
 ['courtwatch-v3-itf-safety-120d.yml','ITF · sicurezza iscrizioni 120 giorni'],
 ['courtwatch-v3-itf-t-minus-one.yml','ITF · tabelloni ordinari T−1'],
 ['courtwatch-itf-meta-engine.yml','ITF · metadati'],
 ['courtwatch-all-itf-metadata.yml','ITF · acquisizione metadati tornei futuri'],
 ['courtwatch-v3-oop.yml','App · ordine di gioco'],
 ['courtwatch-v3-results.yml','App · risultati'],
 ['courtwatch-acceptance-player-profiles.yml','Acceptance · profili e ID'],
 ['courtwatch-acquired-player-search.yml','Index · identità e ricerca giocatori'],
 ['courtwatch-cloudflare-app-api.yml','D1 · importazione e pubblicazione app'],
 ['courtwatch-runtime-documents-d1.yml','D1 · documenti necessari all’app'],
 ['courtwatch-cloudflare-app-hotfix.yml','Worker · pubblicazione applicazione'],
 ['courtwatch-cloudflare-watchdog-deploy.yml','Watchdog Cloudflare'],
 ['courtwatch-operational-diagnostics.yml','Diagnostica operativa'],
 ['courtwatch-d1-daily-verification.yml','D1 · verifica giornaliera completa'],
 ['courtwatch-shield.yml','Shield · controlli di funzionamento'],
 ['courtwatch-authenticated-crud-smoke.yml','App · verifica accesso e salvataggi'],
 ['courtwatch-global-d1-policy.yml','D1 · controllo scritture incrementali']
];
export function operationalWorkflowRows(doc){
 const known=new Map([...(doc?.items||[]),...(doc?.workflowStates||[])].map(item=>[item.workflow,item]));
 return ADMIN_OPERATIONAL_WORKFLOWS.map(([workflow,label])=>({...known.get(workflow),workflow,label}));
}
