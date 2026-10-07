import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const SOURCE_RUN=37696656152;
export const USER_EXCLUDED_DRAWS=[
 'J-J200-TUR-2026-002|G-S-Q-KO',
 'J-J30-ALG-2026-004|G-S-Q-KO'
];
const sameSet=(a,b)=>{const set=new Set(b);return a.length===b.length&&new Set(a).size===a.length&&set.size===b.length&&a.every(x=>set.has(x))};
export function prepareResume(previous,selection){
 const excluded=new Set(USER_EXCLUDED_DRAWS);
 if(previous.expectedResolved!==863||previous.completeTournaments!==850||previous.cancelledNoDraws!==13||previous.tournaments?.length!==863||new Set(previous.tournaments.map(x=>x.competitionId)).size!==863)throw Error('Unexpected original resolved scope');
 if(!Array.isArray(previous.wanted)||previous.wanted.length!==4894||!sameSet(previous.wanted.map(x=>x.drawKey),[...new Set(previous.wanted.map(x=>x.drawKey))]))throw Error('Unexpected original draw cohort');
 const missing=previous.missingR2?.map(x=>x.drawKey)||[];
 if(!sameSet(missing,USER_EXCLUDED_DRAWS))throw Error('Original missing R2 draws differ from the two user exclusions');
 for(const row of previous.wanted)if(row.drawKey!==row.competitionId+'|'+row.event||!previous.tournaments.some(t=>t.competitionId===row.competitionId))throw Error('Invalid original draw identity');
 const wanted=previous.wanted.filter(x=>!excluded.has(x.drawKey)),documents=selection.documents;
 if(!Array.isArray(documents)||!sameSet(documents.map(x=>x.drawKey),wanted.map(x=>x.drawKey)))throw Error('Saved selection is missing, extra or duplicated');
 for(const d of documents){
  if(d.acquisitionState!=='complete'||d.drawKey!==d.competitionId+'|'+d.event||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.bytes)||d.bytes<=0||!Number.isSafeInteger(d.chunkCount)||d.chunkCount<=0||!Number.isSafeInteger(d.playerCount)||d.playerCount<0||!Number.isSafeInteger(d.matchCount)||d.matchCount<=0||!Number.isFinite(Date.parse(d.observedAt)))throw Error('Invalid saved source document: '+d.drawKey);
 }
 const userExcludedDraws=USER_EXCLUDED_DRAWS.map(drawKey=>({drawKey,resolution:'user_confirmed_resolved_not_required_in_d1',confirmedAt:'2026-10-08T01:24:03+02:00',detail:'Esclusione esplicita utente: qualificazioni risolte, non richieste in D1. Nessuna certificazione di partecipanti per questi due tabelloni.'}));
 return {scope:{...previous,wanted,missingR2:[],userExcludedDraws,resumedFromRun:SOURCE_RUN,resumedAt:new Date().toISOString(),fullPeriodCertified:false},selection:{...selection,scope:'Frozen 863 resolved tournaments; 4892 source documents; two user-confirmed qualifications excluded from D1 parity',documents}};
}
async function main(){
 const folder=process.argv[2];if(!folder)throw Error('Provide downloaded original audit artifact directory');
 const matches=new Map();
 async function walk(root){for(const item of await fs.readdir(root,{withFileTypes:true})){const p=path.join(root,item.name);if(item.isDirectory())await walk(p);else if(['itf-resolved-parity-scope.json','itf-draw-d1-sync.json'].includes(item.name)){if(matches.has(item.name))throw Error('Duplicate artifact file');matches.set(item.name,p)}}}
 await walk(folder);
 if(matches.size!==2)throw Error('Original audit files missing');
 const result=prepareResume(JSON.parse(await fs.readFile(matches.get('itf-resolved-parity-scope.json'),'utf8')),JSON.parse(await fs.readFile(matches.get('itf-draw-d1-sync.json'),'utf8')));
 await fs.mkdir('dist/v3/audits',{recursive:true});
 await fs.writeFile('dist/v3/audits/itf-resolved-parity-scope.json',JSON.stringify(result.scope,null,2)+'\n');
 await fs.writeFile('dist/v3/audits/itf-draw-d1-sync.json',JSON.stringify(result.selection,null,2)+'\n');
 console.log(JSON.stringify({sourceRun:SOURCE_RUN,resolvedTournaments:863,expectedDocuments:result.selection.documents.length,userExcludedDraws:USER_EXCLUDED_DRAWS,r2DownloadsRepeated:0}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
