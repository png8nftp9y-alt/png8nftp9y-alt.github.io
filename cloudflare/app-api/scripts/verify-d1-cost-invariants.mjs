import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const root='../..';
const general=read(`${root}/.github/workflows/courtwatch-cloudflare-app-api.yml`);
const europe=read(`${root}/.github/workflows/courtwatch-tennis-europe-agenda.yml`);
const crud=read(`${root}/.github/workflows/courtwatch-authenticated-crud-smoke.yml`);
const universal=read('scripts/generate-seed.mjs');
const teOop=read('scripts/generate-tennis-europe-oop-seed.mjs');
const teCandidates=read('scripts/generate-tennis-europe-app-candidates.mjs');
const worker=read('src/index.js');
const opponentEntries=read('scripts/generate-opponent-entry-seed.mjs');

const failures=[];
const requireText=(document,text,label)=>{if(!document.includes(text))failures.push(label)};
const forbidText=(document,text,label)=>{if(document.includes(text))failures.push(label)};

requireText(general,'D1_IMPORT_SKIPPED unchanged=$LOCAL_IMPORT_HASH rows_written=0','import generale senza barriera no-op');
requireText(general,"if: steps.import.outputs.changed == 'true'",'verifica generale non subordinata a un import cambiato');
requireText(general,"if: github.event_name != 'workflow_run'",'migrazioni generali rieseguibili sui cicli periodici');
requireText(europe,'TE_D1_IMPORT_SKIPPED unchanged=$LOCAL_IMPORT_HASH rows_written=0','import Tennis Europe senza barriera no-op');
requireText(europe,"if: steps.import.outputs.changed == 'true'",'verifica Tennis Europe non subordinata a un import cambiato');
requireText(europe,"json_extract(counts_json, '$.teImportHash')",'impronta Tennis Europe non confrontata con D1');
requireText(europe,"if: github.event_name != 'workflow_run'",'migrazioni Tennis Europe rieseguibili sui cicli periodici');
forbidText(crud,"workflow_run:",'test CRUD nuovamente collegato a ogni deploy');
requireText(universal,'counts.importHash=crypto.createHash','impronta universale assente');
requireText(universal,'volatileHashKeys','timestamp tecnici inclusi nuovamente nell’impronta universale');
forbidText(opponentEntries,"DELETE FROM opponent_entry_profiles WHERE circuit IN ('fitp','itf')",'profili avversari cancellati integralmente');
requireText(opponentEntries,'delta>maxDelta','delta profili avversari senza limite di sicurezza');
requireText(opponentEntries,'previous.payload===payload','profili avversari invariati non confrontati');
forbidText(teOop,'INSERT OR REPLACE INTO tournaments','tornei Tennis Europe riscritti senza confronto');
forbidText(teOop,'INSERT OR REPLACE INTO tennis_europe_players','identità Tennis Europe riscritte senza confronto');
forbidText(teCandidates,'INSERT OR REPLACE INTO app_match_candidates','candidati Tennis Europe riscritti senza confronto');
requireText(worker,'Date.now()-lastSeen<10*60*1000','throttling del registro dispositivi assente');

if(failures.length){
  console.error(JSON.stringify({policy:'d1-cost-invariants',status:'red',failures},null,2));
  process.exit(1);
}
console.log(JSON.stringify({policy:'d1-cost-invariants',status:'green',checks:17}));
