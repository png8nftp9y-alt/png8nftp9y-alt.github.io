// D1_READ_ONLY: guarded; public tournament metadata only, no player data.
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {fetchTournamentPresentation,mergeTournamentPresentation} from '../lib/personal-tournament-presentation.mjs';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function auditPlaces(rows,presentation,today){
 const groups={past:[],ongoing:[],future:[]};
 for(const row of rows){
  const t=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const id=String(row.source_tournament_id||t.competitionId||t.sourceTournamentId||'').toUpperCase();
  if(!id)throw Error('ITF tournament identity absent');
  const original={...t,circuit:'itf',competitionId:id},effective=mergeTournamentPresentation(original,presentation.get('itf|'+id)||{});
  const missing=x=>['location','venueName'].filter(k=>!String(x[k]||'').trim()||/da confermare|da pubblicare|^(?:TBC|TBD)$/i.test(x[k]));
  const phase=effective.endDate&&effective.endDate<today?'past':effective.startDate>today?'future':'ongoing';
  groups[phase].push({competitionId:id,name:t.name||t.tournamentName||'',storedMissing:missing(original),effectiveMissing:missing(effective),location:effective.location||'',venueName:effective.venueName||'',hostNationCode:t.hostNationCode||'',startDate:effective.startDate||'',endDate:effective.endDate||''});
 }
 const all=Object.values(groups).flat(),storedIds=new Set(all.map(t=>t.competitionId)),catalogueIds=[...presentation.keys()].filter(k=>k.startsWith('itf|')).map(k=>k.slice(4));
 return {generatedAt:new Date().toISOString(),scope:'All canonical ITF D1 tournaments; same exact-ID presentation merge used by player and opponent APIs',writes:0,total:all.length,catalogueTournaments:catalogueIds.length,catalogueNotStored:catalogueIds.filter(id=>!storedIds.has(id)),
  counts:Object.fromEntries(Object.entries(groups).map(([phase,list])=>[phase,{total:list.length,storedIncomplete:list.filter(t=>t.storedMissing.length).length,effectiveIncomplete:list.filter(t=>t.effectiveMissing.length).length}])),
  effectiveComplete:all.filter(t=>!t.effectiveMissing.length).length,missing:all.filter(t=>t.effectiveMissing.length),restoredByPresentation:all.filter(t=>t.storedMissing.length&&!t.effectiveMissing.length).map(t=>t.competitionId)};
}
async function main(){
 const client=await openReadOnlyD1(),rows=[];let cursor='';
 for(;;){const batch=await client.query("SELECT id,source_tournament_id,payload FROM tournaments WHERE circuit='itf' AND id>? ORDER BY id LIMIT 100",[cursor]);if(!batch.length)break;rows.push(...batch);cursor=batch.at(-1).id;}
 if(!rows.length)throw Error('No ITF rows; cannot certify an empty audit');
 const sources=[];
 const presentation=await fetchTournamentPresentation('itf',async url=>{const rel=new URL(url).pathname.slice(1);if(!rel)throw Error('Unexpected metadata path');const data=JSON.parse(await fs.readFile(rel,'utf8'));sources.push(rel);return {ok:true,json:async()=>data};});
 if(sources.length!==4)throw Error('Incomplete source coverage; audit refused');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'}),report=auditPlaces(rows,presentation,today);
 await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-tournament-places.json',JSON.stringify(report,null,2)+'\n');
 console.log('ITF_PLACES_AUDIT='+JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
