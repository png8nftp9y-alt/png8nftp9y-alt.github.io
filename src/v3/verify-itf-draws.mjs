import {NOW,TODAY,readJson,writeJson,tournamentEvents,drawsheet,playerFromApi,norm,aliases} from './itf-common.mjs';

const file='dist/v3/source_itf_entries.json',doc=await readJson(file,{entries:[]}),players=(await readJson('players.json',{players:[]})).players||[],map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]}),byId=new Map((map.tournaments||[]).map(t=>[t.competitionId,t])),targetDoc=await readJson('history/itf_draw_target_db.json',{targets:{}}),targets={...(targetDoc.targets||{})},entries=[],audit=[];
let confirmed=0,removed=0,inconclusive=0;
function shiftedStart(start){const time=Date.parse(start||'');return Number.isFinite(time)?new Date(time-2*864e5).toISOString().slice(0,10):''}
function days(start){return start?Math.floor((Date.parse(TODAY)-Date.parse(start))/864e5):-999}
function names(json){const out=[];for(const group of[...(json.koGroups||[]),...(json.rrGroups||[])])for(const round of group.rounds||group.matchesByRound||[])for(const m of round.matches||[])for(const team of m.teams||[])for(const p of team.players||[]){const x=playerFromApi(p);if(x.name)out.push(x.name)}return out}

for(const e of doc.entries||[]){
  const controlStartDate=shiftedStart(e.startDate),d=days(controlStartDate),key=`${e.playerId}|${e.competitionId}`;
  if(d<-1){entries.push(e);audit.push({playerId:e.playerId,competitionId:e.competitionId,controlStartDate,daysFromControlStart:d,decision:'kept_pre_tournament_acceptance'});continue}
  const t=byId.get(e.competitionId)||e;
  let allNames=[],failures=[],sections=[];
  try{
    const combos=(await tournamentEvents(t)).filter(c=>c.matchTypeCode==='S');
    for(const c of combos){const phase=[c.playerTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');try{const ns=names(await drawsheet(c));allNames.push(...ns);sections.push({phase,players:ns.length,populated:ns.length>0})}catch(err){failures.push({phase,error:err.message});sections.push({phase,players:0,populated:false,error:err.message})}}
    if(!combos.length)failures.push({error:'no_official_singles_draw_sections_yet'});
  }catch(err){failures.push({error:err.message})}
  const p=players.find(p=>p.id===e.playerId),hit=p&&allNames.some(n=>aliases(p).some(a=>norm(n)===a));
  const anyEmpty=sections.some(s=>!s.populated)||failures.length>0;
  const finalSections=sections.filter(s=>/-M-/.test(`-${s.phase}-`));
  const reliableFinal=finalSections.some(s=>s.populated);
  if(hit){
    const drawEntry={...e,preDrawCalendarListLabel:e.preDrawCalendarListLabel||e.calendarListLabel,acceptanceCode:'',acceptancePosition:null,calendarListLabel:'',entryStatus:'draw_confirmed',calendarState:'draw_confirmed',drawConfirmedAt:NOW,lastDrawCheck:NOW};
    entries.push(drawEntry);confirmed++;if(targets[key])targets[key]={...targets[key],drawDecision:'confirmed',drawEntry,lastDrawCheckedAt:NOW};
    audit.push({playerId:e.playerId,competitionId:e.competitionId,controlStartDate,daysFromControlStart:d,decision:'kept_draw_confirmed_in_any_official_singles_draw_or_group',players:allNames.length,sections,failures});
  }else if(reliableFinal&&!anyEmpty){
    removed++;if(targets[key])targets[key]={...targets[key],drawDecision:'removed',lastDrawCheckedAt:NOW};
    audit.push({playerId:e.playerId,competitionId:e.competitionId,controlStartDate,daysFromControlStart:d,decision:'removed_absent_from_reliable_relevant_singles_draws',players:allNames.length,sections});
  }else{
    const pending={...e,calendarState:'draw_check_pending_or_empty',lastDrawCheck:NOW,drawVerificationInconclusive:true};entries.push(pending);inconclusive++;if(targets[key])targets[key]={...targets[key],drawDecision:'pending',lastDrawCheckedAt:NOW};
    audit.push({playerId:e.playerId,competitionId:e.competitionId,controlStartDate,daysFromControlStart:d,decision:'kept_draw_unpublished_empty_or_inconclusive',players:allNames.length,sections,failures});
  }
}
await writeJson(file,{...doc,generatedAt:NOW,entriesFound:entries.length,entries,drawRules:{appliedAt:NOW,today:TODAY,mode:'live_t_minus_1',rule:'Same as Tennis Europe: acceptance is shown with MD/Q/A; from T-1 a player found in any populated singles draw or group remains without label. Absence removes only after a populated final phase and no relevant section is empty, missing or unreadable.'}});
await writeJson('history/itf_draw_target_db.json',{...targetDoc,version:2,generatedAt:NOW,targetCount:Object.keys(targets).length,targets});
await writeJson('dist/v3/source_itf_draw_audit.json',{version:2,generatedAt:NOW,today:TODAY,summary:{mode:'live_t_minus_1_same_as_tennis_europe',originalEntries:(doc.entries||[]).length,entriesFound:entries.length,confirmedInDraw:confirmed,removedByReliableDrawAbsence:removed,inconclusiveKept:inconclusive},audit});
console.log(JSON.stringify({confirmed,removed,inconclusive,entries:entries.length},null,2));
