import fs from 'node:fs/promises';

const NOW=new Date().toISOString(), TODAY=NOW.slice(0,10);
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
const key=e=>[e.playerId,e.competitionId,e.event||e.acceptanceEvent||'singles'].join('|');

const [map,acceptance,source,liveAudit,historicalAudit,db,participantDb]=await Promise.all([
  readJson('dist/v3/source_tennis_europe_tournaments_sharded.json',{}),
  readJson('dist/v3/source_tennis_europe_entries_sharded.json',{}),
  readJson('dist/v3/source_tennis_europe_entries.json',{}),
  readJson('dist/v3/source_tennis_europe_draw_audit.json',{}),
  readJson('dist/v3/source_tennis_europe_draw_backfill_audit.json',{}),
  readJson('history/tennis_europe_player_tournament_db.json',{}),
  readJson('history/tennis_europe_participant_database_audit.json',{}),
]);
const errors=[], warnings=[];
const mapRows=map.tournaments||[], acceptanceRows=(acceptance.entries||[]).filter(e=>e.circuit==='tennis-europe'), sourceRows=(source.entries||[]).filter(e=>e.circuit==='tennis-europe');
const historicalRemoved=(historicalAudit.audit||[]).filter(e=>String(e.decision||'').startsWith('removed_'));
const historicalConfirmed=(historicalAudit.audit||[]).filter(e=>String(e.decision||'').includes('confirmed'));
const removedKeys=new Set(historicalRemoved.map(key)), confirmedKeys=new Set(historicalConfirmed.map(key));
const relations=Object.values(db.relations||{}), sourceKeys=new Set(sourceRows.map(key));
if(map.status!=='tennis_europe_sharded_tournament_map_complete'||mapRows.length<100||(map.errors||[]).length)errors.push({type:'map_incomplete',status:map.status,count:mapRows.length,errors:(map.errors||[]).length});
if(map.coverageFrom>TODAY||map.coverageUntil<TODAY)errors.push({type:'map_does_not_cover_today',coverageFrom:map.coverageFrom,coverageUntil:map.coverageUntil,today:TODAY});
if(map.continuity&&map.continuity.status!=='ok')errors.push({type:'map_continuity_blocked',continuity:map.continuity});
if(acceptance.status!=='tennis_europe_acceptance_complete'||(acceptance.shards||[]).length!==16||(acceptance.errors||[]).length)errors.push({type:'acceptance_incomplete',status:acceptance.status,shards:(acceptance.shards||[]).length,errors:(acceptance.errors||[]).length});
if(participantDb.status!=='green'||participantDb.historicalTournamentSnapshots<100||participantDb.participantsRead<1000)errors.push({type:'participant_database_incomplete',status:participantDb.status,snapshots:participantDb.historicalTournamentSnapshots||0,participants:participantDb.participantsRead||0,errors:participantDb.errors||[]});
const removedVisible=[...removedKeys].filter(k=>sourceKeys.has(k));if(removedVisible.length)errors.push({type:'historical_rejections_visible',count:removedVisible.length,keys:removedVisible});
const confirmedWithLabel=sourceRows.filter(e=>confirmedKeys.has(key(e))&&e.calendarListLabel);if(confirmedWithLabel.length)errors.push({type:'confirmed_draws_regressed_to_acceptance_labels',count:confirmedWithLabel.length,keys:confirmedWithLabel.map(key)});
const rejectedRelations=relations.filter(r=>r.permanenceStatus==='rejected_by_complete_singles_draws');
const permanentRelations=relations.filter(r=>r.permanenceStatus==='draw_confirmed_permanent');
const pendingRelations=relations.filter(r=>r.permanenceStatus==='retained_pending_draw_verification');
if(rejectedRelations.length<historicalRemoved.length)errors.push({type:'database_lost_rejections',expectedAtLeast:historicalRemoved.length,actual:rejectedRelations.length});
if(permanentRelations.length<historicalConfirmed.length)errors.push({type:'database_lost_confirmations',expectedAtLeast:historicalConfirmed.length,actual:permanentRelations.length});
if(pendingRelations.length)errors.push({type:'database_pending_historical_relations',count:pendingRelations.length,keys:pendingRelations.map(r=>r.key)});
const oppositeDuplicates=[];for(const r of relations){const ev=String(r.acceptanceEvent||'').toUpperCase();if(!/^(BS|GS)\d{2}$/.test(ev))continue;const opposite=(ev.startsWith('BS')?'GS':'BS')+ev.slice(2);if((db.relations||{})[[r.playerId,r.competitionId,opposite].join('|')])oppositeDuplicates.push(r.key)}
if(oppositeDuplicates.length)errors.push({type:'cross_gender_duplicates',count:oppositeDuplicates.length,keys:[...new Set(oppositeDuplicates)]});
const liveInconclusive=(liveAudit.audit||[]).filter(e=>String(e.decision||'').includes('inconclusive'));
const liveTechnicalInconclusive=liveInconclusive.filter(entry=>[...(entry.qualifying?.tried||[]),...(entry.main?.tried||[])].some(attempt=>attempt?.error||Number(attempt?.status)>=500));
const liveOfficialDrawPending=liveInconclusive.filter(entry=>!liveTechnicalInconclusive.includes(entry));
if(liveTechnicalInconclusive.length)errors.push({type:'live_t_minus_1_technical_inconclusive',count:liveTechnicalInconclusive.length,keys:liveTechnicalInconclusive.map(key)});
const checks={mapTournaments:mapRows.length,mapCoverageFrom:map.coverageFrom||'',mapCoverageUntil:map.coverageUntil||'',continuityCycles:map.continuity?.consecutiveSuccessfulCycles||0,acceptanceEntries:acceptanceRows.length,calendarEntries:sourceRows.length,confirmed:historicalConfirmed.length,rejected:historicalRemoved.length,pending:pendingRelations.length,inconclusive:liveInconclusive.length,officialDrawPending:liveOfficialDrawPending.length,technicalInconclusive:liveTechnicalInconclusive.length,participantSnapshots:participantDb.historicalTournamentSnapshots||0,participantsRead:participantDb.participantsRead||0,participantIds:participantDb.participantIds||0};
if(checks.continuityCycles<2)warnings.push({type:'map_continuity_observation_in_progress',successfulCycles:checks.continuityCycles,requiredCycles:2});
const output={version:1,generatedAt:NOW,status:errors.length?'red':warnings.length?'yellow':'green',checks,warnings,errors};
await writeJson('dist/v3/tennis_europe_system_diagnostics.json',output);
console.log(JSON.stringify(output,null,2));
if(errors.length)process.exit(2);
