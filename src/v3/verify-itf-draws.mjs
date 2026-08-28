import {NOW,TODAY,readJson,writeJson,tournamentEvents,drawsheet,playerFromApi,norm,aliases} from './itf-common.mjs';

const file='dist/v3/source_itf_entries.json';
const doc=await readJson(file,{entries:[]});
const players=(await readJson('players.json',{players:[]})).players||[];
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const byId=new Map((map.tournaments||[]).map(t=>[t.competitionId,t]));
const targetDoc=await readJson('history/itf_draw_target_db.json',{targets:{}});
const targets={...(targetDoc.targets||{})},entries=[],audit=[];
let acceptanceLive=0,confirmed=0,removed=0,inconclusive=0,drawRequests=0;

function addDays(value,days){const time=Date.parse(`${value}T00:00:00Z`);if(!Number.isFinite(time))return'';return new Date(time+days*864e5).toISOString().slice(0,10)}
function officialStart(entry,tournament){return entry.officialStartDate||tournament.officialStartDate||entry.startDate||tournament.startDate||''}
function playerType(entry){const gender=norm(entry.gender);return gender.startsWith('GIRL')||gender==='G'?'G':gender.startsWith('BOY')||gender==='B'?'B':''}
function eventKey(c){return[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-')}
function familyKey(c){return[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode].join('-')}
function names(json){const out=[];for(const group of[...(json.koGroups||[]),...(json.rrGroups||[])])for(const round of group.rounds||group.matchesByRound||[])for(const match of round.matches||[])for(const team of match.teams||[])for(const raw of team.players||[]){const p=playerFromApi(raw);if(p.name)out.push(p.name)}return out}
function relevantClassifications(entry){return entry.acceptanceCode==='MD'?new Set(['M']):new Set(['M','Q'])}

for(const entry of doc.entries||[]){
 const key=`${entry.playerId}|${entry.competitionId}`,target=targets[key]||{},tournament=byId.get(entry.competitionId)||entry,start=officialStart(entry,tournament),tMinusOne=addDays(start,-1);
 if(entry.historicalBackfill||target.drawDecision==='confirmed'||entry.calendarState==='draw_confirmed'){
  const stable=target.drawEntry||entry;entries.push(stable);confirmed++;audit.push({playerId:entry.playerId,competitionId:entry.competitionId,officialStartDate:start,tMinusOne,decision:'kept_previous_draw_confirmation',drawRequested:false});continue
 }
 if(!tMinusOne||TODAY<tMinusOne){
  const live={...entry,calendarState:'acceptance_live',drawCheckEligibleAt:tMinusOne||null};entries.push(live);acceptanceLive++;targets[key]={...target,...entry,acceptanceEntry:target.acceptanceEntry||entry,drawDecision:'awaiting_t_minus_one',drawCheckEligibleAt:tMinusOne||null};audit.push({playerId:entry.playerId,competitionId:entry.competitionId,officialStartDate:start,tMinusOne,decision:'kept_live_acceptance_label_before_t_minus_one',drawRequested:false});continue
 }
 const tracked=players.find(player=>player.id===entry.playerId),gender=playerType(entry),wantedClasses=relevantClassifications(entry);let combos=[],eventFailure=null;
 try{combos=(await tournamentEvents(tournament)).filter(c=>c.matchTypeCode==='S'&&(!gender||c.playerTypeCode===gender)&&wantedClasses.has(c.eventClassificationCode))}catch(error){eventFailure=error.message}
 const outcomes=[];
 for(const combo of combos){drawRequests++;try{const foundNames=names(await drawsheet(combo));outcomes.push({combo,event:eventKey(combo),family:familyKey(combo),names:foundNames,populated:foundNames.length>0})}catch(error){outcomes.push({combo,event:eventKey(combo),family:familyKey(combo),names:[],populated:false,error:error.message})}}
 const hit=Boolean(tracked&&outcomes.some(outcome=>outcome.names.some(name=>aliases(tracked).some(alias=>norm(name)===alias))));
 const families=new Map();for(const outcome of outcomes){const family=families.get(outcome.family)||{events:[],populated:false};family.events.push({event:outcome.event,players:outcome.names.length,error:outcome.error||null});if(outcome.populated)family.populated=true;families.set(outcome.family,family)}
 const familyAudit=[...families].map(([family,value])=>({family,populated:value.populated,events:value.events}));
 const complete=combos.length>0&&!eventFailure&&familyAudit.length>0&&familyAudit.every(family=>family.populated);
 if(hit){
  const drawEntry={...entry,preDrawCalendarListLabel:entry.preDrawCalendarListLabel||entry.calendarListLabel,acceptanceCode:'',acceptancePosition:null,calendarListLabel:'',entryStatus:'draw_confirmed',calendarState:'draw_confirmed',drawConfirmedAt:NOW,lastDrawCheck:NOW,drawCheckEligibleAt:tMinusOne};entries.push(drawEntry);confirmed++;targets[key]={...target,...entry,acceptanceEntry:target.acceptanceEntry||entry,drawDecision:'confirmed',drawEntry,lastDrawCheckedAt:NOW};audit.push({playerId:entry.playerId,competitionId:entry.competitionId,officialStartDate:start,tMinusOne,decision:'confirmed_in_official_singles_draw',drawRequested:true,families:familyAudit,eventFailure});
 }else if(complete){
  removed++;targets[key]={...target,...entry,acceptanceEntry:target.acceptanceEntry||entry,drawDecision:'removed',removalReason:'draw_absent_verified',removedAt:NOW,lastDrawCheckedAt:NOW};audit.push({playerId:entry.playerId,competitionId:entry.competitionId,officialStartDate:start,tMinusOne,decision:'removed_after_complete_reliable_draw_absence',drawRequested:true,families:familyAudit});
 }else{
  const pending={...entry,calendarState:'draw_check_pending',drawCheckEligibleAt:tMinusOne,lastDrawCheck:NOW,drawVerificationInconclusive:true};entries.push(pending);inconclusive++;targets[key]={...target,...entry,acceptanceEntry:target.acceptanceEntry||entry,drawDecision:'pending',drawCheckEligibleAt:tMinusOne,lastDrawCheckedAt:NOW};audit.push({playerId:entry.playerId,competitionId:entry.competitionId,officialStartDate:start,tMinusOne,decision:'kept_label_draw_unpublished_empty_or_inconclusive',drawRequested:true,families:familyAudit,eventFailure:eventFailure||null});
 }
}

await writeJson(file,{...doc,version:7,generatedAt:NOW,status:'itf_acceptance_complete_state_machine',entriesFound:entries.length,entries,stateMachine:{acceptancePublication:'First official acceptance publishes immediately with live MD/Q/A label.',withdrawal:'Every acceptance cycle checks official withdrawn rows and removes them immediately.',drawGate:'No draw request before official tournament start minus one day.',drawDecision:'From T-1: confirm and clear label on hit; keep label while incomplete; remove only after complete reliable absence.'}});
await writeJson('history/itf_draw_target_db.json',{...targetDoc,version:5,generatedAt:NOW,status:'itf_live_state_database_complete',targetCount:Object.keys(targets).length,targets});
await writeJson('dist/v3/source_itf_draw_audit.json',{version:3,generatedAt:NOW,today:TODAY,status:'itf_t_minus_one_state_machine_complete',summary:{mode:'live_t_minus_1_state_machine',originalEntries:(doc.entries||[]).length,entriesFound:entries.length,acceptanceLive,confirmedInDraw:confirmed,removedByReliableDrawAbsence:removed,inconclusiveKept:inconclusive,drawRequests,preTMinusOneDrawRequests:0,withdrawnRemoved:Object.values(targets).filter(target=>target.removalReason==='withdrawn').length},audit});
console.log(JSON.stringify({acceptanceLive,confirmed,removed,inconclusive,drawRequests,preTMinusOneDrawRequests:0,entries:entries.length},null,2));
