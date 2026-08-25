import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {NOW,readJson,writeJson} from './itf-common.mjs';

const dir='dist/v3/shards/itf',TOTAL=Number(process.env.ITF_ACCEPTANCE_TOTAL||16),entries=[],participants=[],shards=[],errors=[];
for(let i=0;i<TOTAL;i++){
  const d=await readJson(`${dir}/acceptance-${i}.json`,null);
  if(!d){errors.push({type:'missing_acceptance_shard',shard:i});continue}
  shards.push({shard:i,status:d.status,tournamentsChecked:d.tournamentsChecked,participantsFound:d.participantsFound,entriesFound:d.entriesFound,errors:(d.errors||[]).length});
  if(!String(d.status).includes('complete'))errors.push({type:'incomplete_acceptance_shard',shard:i,status:d.status});
  entries.push(...(d.entries||[]));
  try{participants.push(...JSON.parse(gunzipSync(await fs.readFile(`${dir}/participants-${i}.json.gz`))).participants)}catch{errors.push({type:'missing_participant_shard',shard:i})}
}

const current=[...new Map(entries.map(e=>[`${e.playerId}|${e.competitionId}`,e])).values()];
await fs.mkdir('history',{recursive:true});
const oldTargets=await readJson('history/itf_draw_target_db.json',{targets:{}}),targets={...(oldTargets.targets||{})};
for(const e of current){
  const key=`${e.playerId}|${e.competitionId}`,old=targets[key]||{};
  targets[key]={...old,...e,acceptanceEntry:e,drawDecision:'pending',firstSeenInAcceptanceAt:old.firstSeenInAcceptanceAt||e.lastSeen||NOW,lastSeenInAcceptanceAt:e.lastSeen||NOW};
}

// ITF removes the online acceptance list when draws begin. Preserve the last
// official acceptance record so the map follows the same state machine as TE.
const visible=new Map(current.map(e=>[`${e.playerId}|${e.competitionId}`,e]));
for(const [key,target] of Object.entries(targets)){
  if(visible.has(key)||target.drawDecision==='removed')continue;
  if(target.drawDecision==='confirmed'&&target.drawEntry)visible.set(key,target.drawEntry);
  else if(target.acceptanceEntry)visible.set(key,target.acceptanceEntry);
}
const unique=[...visible.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.playerName).localeCompare(String(b.playerName)));
const out={version:3,generatedAt:NOW,status:errors.length?'itf_acceptance_merge_blocked':'itf_acceptance_complete',shards,tournamentsChecked:shards.reduce((a,s)=>a+s.tournamentsChecked,0),participantsFound:participants.length,currentAcceptanceEntries:current.length,entriesFound:unique.length,entries:unique,errors};
await writeJson('dist/v3/source_itf_entries.json',out);
await writeJson('dist/v3/source_itf_acceptance_audit.json',{...out,entries:unique.slice(0,300)});
await writeJson('history/itf_draw_target_db.json',{version:2,generatedAt:NOW,status:'itf_draw_target_database_complete',rule:'Same T-1 decision as Tennis Europe; retain the last official acceptance locally because ITF removes it when draws are published.',targetCount:Object.keys(targets).length,targets});
let old=[];try{old=JSON.parse(gunzipSync(await fs.readFile('history/itf_participant_cache.json.gz'))).participants||[]}catch{}
const permanent=[...new Map([...old,...participants].map(p=>[[p.competitionId,p.worldTennisId||p.name,p.acceptanceCode].join('|'),p])).values()];
await fs.writeFile('history/itf_participant_cache.json.gz',gzipSync(JSON.stringify({version:2,generatedAt:NOW,participants:permanent})));
console.log(JSON.stringify({...out,entries:undefined,drawTargets:Object.keys(targets).length,permanentParticipants:permanent.length},null,2));
if(errors.length)process.exit(2);
