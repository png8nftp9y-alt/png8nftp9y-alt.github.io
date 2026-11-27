import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {cachedItfDrawEntries} from '../../cloudflare/app-api/lib/itf-cached-draw-entries.mjs';
import {mergeItfDrawPresences} from './itf-draw-presence-registry.mjs';
import {confirmedItfEntry,itfTargetEvidence} from './itf-confirmed-history.mjs';
const output='history/itf-confirmed-draw-presences.json.gz';
let prior={entries:[]};try{prior=JSON.parse(gunzipSync(await fs.readFile(output)));}catch(error){if(error.code!=='ENOENT')throw error;}
const sources=process.argv.slice(2);if(!sources.length)sources.push('history/itf_draw_target_db.json');
let entries=prior.entries||[];
const sourceProofs=new Set(prior.sources||[]);
for(const file of sources){
 const bytes=await fs.readFile(file);
 const doc=JSON.parse(file.endsWith('.gz')?gunzipSync(bytes):bytes);
 const rows=[...cachedItfDrawEntries(doc),...(doc.entries||[]).filter(e=>e.id&&e.tournament)];
 for(const e of [...itfTargetEvidence(doc),...(doc.entries||[])]){
  if(!confirmedItfEntry(e)||!/^800\d{6}$/.test(String(e.worldTennisId||'')))continue;
  rows.push({id:String(e.worldTennisId),name:e.playerName||'',tournament:{...e,name:e.tournamentName||e.name||e.competitionId,drawConfirmed:true,entryStatus:'official_draw',calendarState:'draw_confirmed',historyEvidence:'acquired_itf_draw_presence'}});
 }
 entries=mergeItfDrawPresences(rows,entries);sourceProofs.add(file);
}
const doc={version:1,rule:'Permanent begun ITF draw presence, exact native ID, no acceptance-only evidence.',sources:[...sourceProofs].sort(),entries};
await fs.writeFile(output,gzipSync(JSON.stringify(doc),{level:9}));
console.log(JSON.stringify({status:'confirmed_itf_draw_registry_ready',players:new Set(entries.map(e=>e.id)).size,presences:entries.length,tournaments:new Set(entries.map(e=>e.tournament.competitionId)).size,sourceDocuments:sourceProofs.size}));
