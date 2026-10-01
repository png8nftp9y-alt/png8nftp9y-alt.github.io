import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {NOW,readJson,writeJson,norm,aliases} from './itf-common.mjs';
import {isKnownUnusedDraw} from './itf-known-unused-draws.mjs';
import {AUDIT_CRITERION,acquiredDrawStatus,emptySinglesQualificationResolutions} from './itf-audit-acquisition-policy.mjs';
import {derivedDrawResolution} from './itf-draw-resolution-rules.mjs';

const inventory=await readJson('dist/v3/itf_t1_section_inventory.json',null);
if(!inventory?.competitionId)throw new Error('ITF T-1 inventory missing');
const coverage=inventory.criterion===AUDIT_CRITERION;
const id=inventory.competitionId,tournament=inventory.tournament||{};
const taskRoot=process.env.ITF_T1_TASK_ROOT||'draw-tasks',docs=[];
async function walk(dir){let items=[];try{items=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const item of items){const full=path.join(dir,item.name);if(item.isDirectory())await walk(full);else if(item.name.endsWith('.json.gz'))docs.push(JSON.parse(gunzipSync(await fs.readFile(full))))}}
await walk(taskRoot);

const sourceFile='dist/v3/source_itf_entries.json',targetFile='history/itf_draw_target_db.json';
const source=await readJson(sourceFile,{entries:[]}),targetDoc=await readJson(targetFile,{targets:{},tournaments:{}}),former=new Set(((await readJson('former-players.json',{players:[]})).players||[]).map(p=>p.id));
const watched=((await readJson('players.json',{players:[]})).players||[]).filter(p=>!former.has(p.id)&&(p.circuits||[]).some(c=>norm(c)==='ITF'));
const targets={...(targetDoc.targets||{})},tournaments={...(targetDoc.tournaments||{})},entries=new Map((source.entries||[]).map(e=>[e.playerId+'|'+e.competitionId,e]));
const previous=tournaments[id]||{},eventCache={...(previous.eventCache||{})};for(const [event,value] of Object.entries(eventCache))if(value?.resolution==='unused_alternative_structure')delete eventCache[event];const tournamentDocs=docs.filter(d=>d.competitionId===id),byEvent=new Map(tournamentDocs.map(d=>[d.event,d]));
let newSectionsCached=0;
for(const section of inventory.sections||[]){const doc=byEvent.get(section.event);if(doc&&(coverage?acquiredDrawStatus({competitionId:id,event:section.event,structure:section.event.split('-').at(-1),artifact:doc}).complete:doc.status==='complete')){
 eventCache[section.event]={family:section.event.split('-').slice(0,3).join('-'),populated:true,terminalAlternative:false,players:doc.players||[],storedAt:NOW,...(coverage?{acquisitionProof:{criterion:AUDIT_CRITERION,complete:true,taskId:doc.taskId,storedAt:NOW}}:{})};newSectionsCached++;
}}
const eventInventory=(inventory.sections||[]).map(section=>({event:section.event,family:section.event.split('-').slice(0,3).join('-'),combo:section.combo}));
const certifiedSections=new Set((inventory.sections||[]).filter(s=>s.acquired&&s.proofCriterion===AUDIT_CRITERION).map(s=>s.event));
const isAcquired=event=>coverage?(certifiedSections.has(event)||(eventCache[event]?.acquisitionProof?.criterion===AUDIT_CRITERION&&eventCache[event].acquisitionProof.complete===true)):Boolean(eventCache[event]?.populated);
const qualificationResolutions=coverage?emptySinglesQualificationResolutions(eventInventory.map(s=>({...s.combo,event:s.event,family:s.family,structure:s.event.split('-').at(-1)})),eventInventory.map(s=>({event:s.event,acquired:isAcquired(s.event)})),tournamentDocs):[];
for(const resolution of qualificationResolutions)eventCache[resolution.event]={family:resolution.event.split('-').slice(0,3).join('-'),populated:false,players:[],resolution:resolution.resolution,resolutionProof:{criterion:AUDIT_CRITERION,complete:true,mainEvents:resolution.mainEvents,storedAt:NOW}};
const isAlternative=event=>coverage?Boolean(eventCache[event]?.resolution==='empty_singles_qualification'&&eventCache[event]?.resolutionProof?.criterion===AUDIT_CRITERION&&eventCache[event].resolutionProof.complete):Boolean(eventCache[event]?.terminalAlternative);
const declaredEventNames=eventInventory.map(x=>x.event),populatedEventNames=Object.entries(eventCache).filter(([,value])=>value?.populated).map(([event])=>event);
let newPolicyResolutions=0;
for(const section of eventInventory)if(!coverage&&!eventCache[section.event]?.populated&&!eventCache[section.event]?.terminalAlternative){const resolution=derivedDrawResolution(section.event,{declaredEvents:declaredEventNames,populatedEvents:populatedEventNames});if(resolution){eventCache[section.event]={family:section.family,populated:false,terminalAlternative:true,players:[],observedAt:NOW,storedAt:NOW,resolution};newPolicyResolutions++}}
let newDeclaredButUnused=0;
for(const section of eventInventory)if(!coverage&&isKnownUnusedDraw(id,section.event)&&!eventCache[section.event]?.populated){
 eventCache[section.event]={family:section.family,populated:false,terminalAlternative:true,players:[],observedAt:NOW,storedAt:NOW,resolution:'declared_but_unused'};
 newDeclaredButUnused++;
}
const populatedFamilies=new Set(eventInventory.filter(section=>isAcquired(section.event)).map(section=>section.family));
const newTerminalAlternatives=0;
const families=new Map();
for(const section of eventInventory){
 const doc=byEvent.get(section.event),cached=eventCache[section.event],family=families.get(section.family)||{populated:false,events:[]};
 const terminalAlternative=isAlternative(section.event),declaredButUnused=!coverage&&cached?.resolution==='declared_but_unused',populated=isAcquired(section.event);
 const artifactMissing=!populated&&!terminalAlternative&&!doc;
 family.populated||=populated;
 family.events.push({
  event:section.event,
  players:(cached?.players||[]).length,
  error:declaredButUnused?'declared_but_unused':terminalAlternative?(cached?.resolution==='empty_singles_qualification'?'empty_singles_qualification':'unused_alternative_structure'):artifactMissing?'draw_artifact_missing':(doc?.status==='retry'?(doc.error||'draw_retry_required'):(!populated?'draw_not_acquired':null)),
  failureType:declaredButUnused?'declared_but_unused':terminalAlternative?(cached?.resolution==='empty_singles_qualification'?'empty_singles_qualification':'unused_alternative_structure'):artifactMissing?'technical_error':(doc?.failureType||(!populated?'not_published_or_incomplete':null)),
  resolved:populated||terminalAlternative
 });
 families.set(section.family,family);
}
const acquiredSections=eventInventory.filter(section=>isAcquired(section.event)).length;
const declaredButUnusedSections=eventInventory.filter(section=>!coverage&&eventCache[section.event]?.resolution==='declared_but_unused').length;
const unusedAlternativeSections=eventInventory.filter(section=>isAlternative(section.event)&&eventCache[section.event]?.resolution!=='declared_but_unused').length;
const resolvedSections=acquiredSections+unusedAlternativeSections+declaredButUnusedSections;
const missingSections=Math.max(0,eventInventory.length-resolvedSections),complete=eventInventory.length>0&&missingSections===0,cancelledName=/\bcancel(?:led|ed)\b/i.test(String(tournament.tournamentName||inventory.tournamentName||'')),cancelledNoDraws=!coverage&&!inventory.inventoryError&&eventInventory.length===0&&cancelledName,decision=complete?'complete':cancelledNoDraws?'cancelled_no_draws':'pending';
const found=new Map();
for(const section of eventInventory)for(const raw of eventCache[section.event]?.players||[])for(const player of watched)if(aliases(player).some(alias=>norm(raw.name)===alias))found.set(player.id,{player,raw});
for(const {player,raw} of found.values()){
 const key=player.id+'|'+id,old=entries.get(key)||targets[key]?.acceptanceEntry||{},drawEntry={...old,playerId:player.id,playerName:player.name,worldTennisId:String(raw.id||old.worldTennisId||''),circuit:'itf',competitionId:id,tournamentName:tournament.tournamentName||inventory.tournamentName,location:tournament.location||old.location||'',startDate:tournament.startDate,endDate:tournament.endDate,category:tournament.category||old.category||'',sourceUrl:tournament.sourceUrl||old.sourceUrl||'',preDrawCalendarListLabel:old.preDrawCalendarListLabel||old.calendarListLabel||'',acceptanceCode:'',acceptancePosition:null,calendarListLabel:'',entryStatus:'draw_confirmed',calendarState:'draw_confirmed',drawConfirmedAt:NOW,lastSeen:NOW};entries.set(key,drawEntry);targets[key]={...(targets[key]||{}),acceptanceEntry:targets[key]?.acceptanceEntry||null,drawDecision:'confirmed',drawEntry,lastDrawCheckedAt:NOW};
}
let removed=0;
if(complete)for(const [key,entry] of [...entries])if(entry.competitionId===id&&!found.has(entry.playerId)&&entry.calendarState!=='draw_confirmed'&&!entry.historicalBackfill){entries.delete(key);targets[key]={...(targets[key]||{}),...entry,drawDecision:'removed',removalReason:'draw_absent_verified',removedAt:NOW,lastDrawCheckedAt:NOW};removed++}
const retryDocs=tournamentDocs.filter(doc=>doc.status!=='complete'&&!isAlternative(doc.event)),technicalDocs=retryDocs.filter(doc=>doc.failureType==='technical_error'),publicationDocs=retryDocs.filter(doc=>doc.failureType!=='technical_error'),missingArtifactSections=eventInventory.filter(section=>!isAcquired(section.event)&&!isAlternative(section.event)&&!byEvent.has(section.event)),inventoryTechnical=Boolean(inventory.inventoryError),technicalErrorSections=technicalDocs.length+missingArtifactSections.length+Number(inventoryTechnical),eventFailure=[inventory.inventoryError,...technicalDocs.map(doc=>doc.error||'technical_error'),...missingArtifactSections.map(section=>section.event+':draw_artifact_missing')].filter(Boolean).join(' | ')||null;
tournaments[id]={...previous,competitionId:id,tournamentName:tournament.tournamentName||inventory.tournamentName||previous.tournamentName||'',startDate:tournament.startDate||previous.startDate||'',endDate:tournament.endDate||previous.endDate||'',decision,checkedAt:NOW,playersFound:found.size,declaredSections:eventInventory.length,acquiredSections,unusedAlternativeSections,resolvedSections,missingSections,eventInventory,families:[...families].map(([family,value])=>({family,...value})),eventFailure,eventCache};
const visible=[...entries.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.playerName).localeCompare(String(b.playerName))),values=Object.values(tournaments),globalPending=values.filter(item=>item?.decision==='pending'),technical=item=>Boolean(item?.eventFailure)||(item?.families||[]).some(f=>(f.events||[]).some(e=>e.failureType==='technical_error'));
const globalPendingTechnical=globalPending.filter(technical),globalPendingPublication=globalPending.filter(item=>!technical(item)),certificationStatus=globalPendingTechnical.length?'itf_t_minus_one_technical_pending':globalPendingPublication.length?'itf_t_minus_one_publication_pending':'itf_t_minus_one_complete';
await writeJson(sourceFile,{...source,version:8,generatedAt:NOW,status:'itf_acceptance_complete_state_machine',entriesFound:visible.length,entries:visible});
await writeJson(targetFile,{...targetDoc,version:6,generatedAt:NOW,status:'itf_live_state_database_complete',targetCount:Object.keys(targets).length,targets,tournaments});
await writeJson('dist/v3/source_itf_draw_audit.json',{version:16,generatedAt:NOW,status:certificationStatus,summary:{mode:'live_t_minus_1_historical_acquisition',tournamentsChecked:1,completeTournaments:complete?1:0,cancelledNoDrawsTournaments:cancelledNoDraws?1:0,pendingTournaments:decision==='pending'?1:0,declaredSections:eventInventory.length,requestedSections:tournamentDocs.length,acquiredSections,unusedAlternativeSections,declaredButUnusedSections,resolvedSections,missingSections,newSectionsCached,newTerminalAlternatives,newDeclaredButUnused,newPolicyResolutions,retrySections:retryDocs.length,technicalErrorSections,missingArtifactSections:missingArtifactSections.length,notPublishedOrIncompleteSections:publicationDocs.length,confirmedInDraw:found.size,removedByReliableDrawAbsence:removed,globalCompleteTournaments:values.filter(item=>item?.decision==='complete').length,globalCancelledNoDraws:values.filter(item=>item?.decision==='cancelled_no_draws').length,globalPendingTotal:globalPending.length,globalPendingTechnical:globalPendingTechnical.length,globalPendingPublication:globalPendingPublication.length,technicalPendingCompetitionIds:globalPendingTechnical.map(item=>item.competitionId),publicationPendingCompetitionIds:globalPendingPublication.map(item=>item.competitionId)},audit:[{competitionId:id,tournamentName:tournament.tournamentName||inventory.tournamentName,decision,playersFound:[...found.keys()],declaredSections:eventInventory.length,acquiredSections,unusedAlternativeSections,declaredButUnusedSections,resolvedSections,missingSections,sections:eventInventory.map(section=>({event:section.event,family:section.family,acquired:isAcquired(section.event),resolved:isAcquired(section.event)||isAlternative(section.event),status:isAcquired(section.event)?'acquired':isAlternative(section.event)&&eventCache[section.event]?.resolution==='empty_singles_qualification'?'empty_singles_qualification':eventCache[section.event]?.resolution==='declared_but_unused'?'declared_but_unused':eventCache[section.event]?.terminalAlternative?(cached?.resolution==='empty_singles_qualification'?'empty_singles_qualification':'unused_alternative_structure'):'pending'})),families:[...families].map(([family,value])=>({family,...value})),eventFailure}]});
console.log(JSON.stringify({competitionId:id,declaredSections:eventInventory.length,requestedSections:tournamentDocs.length,acquiredSections,unusedAlternativeSections,resolvedSections,missingSections,retrySections:retryDocs.length,technicalErrorSections,missingArtifactSections:missingArtifactSections.length,notPublishedOrIncompleteSections:publicationDocs.length,decision,globalPendingTechnical:globalPendingTechnical.length,globalPendingPublication:globalPendingPublication.length},null,2));
if(String(process.env.ITF_FAIL_ON_TECHNICAL||'')==='1'&&technicalErrorSections)process.exitCode=2;
