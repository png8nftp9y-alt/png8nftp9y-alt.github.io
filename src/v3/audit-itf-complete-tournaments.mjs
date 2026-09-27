import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=process.argv[2]||'/tmp/itf-complete-audit';
const catalog=JSON.parse(await fs.readFile('dist/v3/source_itf_tournaments.json','utf8'));
const state=JSON.parse(await fs.readFile('history/itf_draw_target_db.json','utf8'));
const queueStatus=JSON.parse(await fs.readFile('dist/v3/itf_t1_queue_status.json','utf8'));
const acceptance=JSON.parse(await fs.readFile('dist/v3/source_itf_entries.json','utf8'));
const participantCache=JSON.parse(gunzipSync(await fs.readFile('history/itf_participant_cache.json.gz')));
const files=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.json.gz'))files.push(full)}}
await walk(root);
const archive=new Map(),invalid=[];
for(const file of files){try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));const id=String(doc.competitionId||'').toUpperCase();if(!id)continue;const row=archive.get(id)||{tasks:0,complete:0,retry:0};row.tasks++;if(doc.status==='complete')row.complete++;else row.retry++;archive.set(id,row)}catch{invalid.push(file)}}
const archiveComplete=new Set([...archive].filter(([,row])=>row.tasks>0&&row.tasks===row.complete).map(([id])=>id));
const liveComplete=new Set(Object.values(state.tournaments||{}).filter(row=>row?.decision==='complete').map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const pending=new Set(Object.values(state.tournaments||{}).filter(row=>row?.decision==='pending').map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const complete=new Set([...archiveComplete,...liveComplete]);
const ids=new Set((catalog.tournaments||[]).map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const today=new Date().toISOString().slice(0,10);
const catalogById=new Map((catalog.tournaments||[]).map(row=>[String(row.competitionId||'').toUpperCase(),row]).filter(([id])=>id));
const classifications={future_not_due:[],active_not_certified:[],concluded_no_archive:[],concluded_archive_incomplete:[],state_not_complete:[]};
for(const id of ids){
 if(complete.has(id)||pending.has(id))continue;
 const tournament=catalogById.get(id)||{},previous=state.tournaments?.[id]||{},archived=archive.get(id),startDate=String(tournament.startDate||''),endDate=String(tournament.endDate||'');
 let reason;
 if(startDate&&startDate>today)reason='future_not_due';
 else if(endDate&&endDate>=today)reason='active_not_certified';
 else if(archived&&archived.tasks!==archived.complete)reason='concluded_archive_incomplete';
 else if(!archived)reason='concluded_no_archive';
 else reason='state_not_complete';
 classifications[reason].push({competitionId:id,tournamentName:tournament.tournamentName||tournament.name||'',startDate:startDate||null,endDate:endDate||null,stateDecision:previous.decision||null,archiveTasks:archived?.tasks||0,archiveCompleteTasks:archived?.complete||0});
}
for(const rows of Object.values(classifications))rows.sort((a,b)=>String(a.endDate||'').localeCompare(String(b.endDate||''))||a.competitionId.localeCompare(b.competitionId));
const recoverable=[...classifications.concluded_no_archive,...classifications.concluded_archive_incomplete,...classifications.state_not_complete];
const recoveryBatches=[];for(let index=0;index<recoverable.length;index+=2)recoveryBatches.push({batch:recoveryBatches.length+1,competitionIds:recoverable.slice(index,index+2).map(row=>row.competitionId)});
const participantsByTournament=new Map();
for(const row of participantCache.participants||[]){const id=String(row.competitionId||'').toUpperCase();if(id&&ids.has(id))participantsByTournament.set(id,(participantsByTournament.get(id)||0)+1)}
const entryListTournaments=[...ids].sort().map(id=>{const tournament=catalogById.get(id)||{},participantCount=participantsByTournament.get(id)||0;return{competitionId:id,tournamentName:tournament.tournamentName||tournament.name||'',startDate:tournament.startDate||null,endDate:tournament.endDate||null,participantCount,status:participantCount?'stored_snapshot_present_not_completeness_certified':'no_stored_snapshot',completenessCertified:false}});
const entryListCounts={catalogTournaments:ids.size,withStoredParticipantSnapshot:entryListTournaments.filter(row=>row.participantCount>0).length,withoutStoredParticipantSnapshot:entryListTournaments.filter(row=>!row.participantCount).length,storedParticipants:[...participantsByTournament.values()].reduce((a,b)=>a+b,0),currentScanTournamentsChecked:Number(acceptance.tournamentsChecked||0),currentScanParticipantsFound:Number(acceptance.participantsFound||0),fullyCertifiedCompleteEntryLists:0,certificationLimitation:'The cache records participants but not an expected official row total or per-tournament successful-empty scan evidence; full entry-list completeness cannot be certified from current data.'};
const report={version:3,generatedAt:new Date().toISOString(),coverageFrom:'2025-12-18',today,catalogTournaments:ids.size,drawQueues:{ordinary:queueStatus.ordinary||{total:0,missingDraws:0,tournaments:[]},extraordinary:queueStatus.extraordinary||{total:0,missingDraws:0,tournaments:[]},distinctQueuedTournaments:new Set([...(queueStatus.ordinary?.tournaments||[]).map(row=>row.competitionId),...(queueStatus.extraordinary?.tournaments||[]).map(row=>row.competitionId)]).size},entryLists:{counts:entryListCounts,tournaments:entryListTournaments},archiveTaskFiles:files.length,archiveTournamentIds:archive.size,archiveCompleteTournaments:archiveComplete.size,liveCompleteTournaments:liveComplete.size,completeTournamentUnion:[...complete].filter(id=>ids.has(id)).length,pendingTournaments:[...pending].filter(id=>ids.has(id)).length,notCertifiedTournaments:[...ids].filter(id=>!complete.has(id)&&!pending.has(id)).length,classificationCounts:Object.fromEntries(Object.entries(classifications).map(([key,rows])=>[key,rows.length])),recoverableConcludedTournaments:recoverable.length,recoveryBatchCount:recoveryBatches.length,classifications,recoveryBatches,archiveIdsOutsideCatalog:[...archiveComplete].filter(id=>!ids.has(id)).sort(),invalidFiles:invalid.length};
await fs.mkdir('dist/v3/audits',{recursive:true});
await fs.writeFile('dist/v3/audits/itf-complete-tournaments.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_COMPLETE_TOURNAMENT_AUDIT='+JSON.stringify(report));
if(invalid.length)process.exitCode=2;
