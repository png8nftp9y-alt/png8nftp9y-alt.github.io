import fs from 'node:fs/promises';
import path from 'node:path';
import {UNIVERSAL_VERSION,compact,ensureIsoDate,normalizeCircuit,sourceRef,stableId,uniqueById} from './universal-data-model.mjs';
const NOW=new Date().toISOString(),OUT=process.env.COURTWATCH_UNIVERSAL_OUT||'dist/v3/universal';
const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}};
const writeJson=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n')};
const [playersDoc,formerDoc,entriesDoc,agendaDoc,resultsDoc]=await Promise.all([
 readJson('players.json',{players:[]}),readJson('former-players.json',{players:[]}),
 readJson('dist/v3/tournament_entries.json',{tournamentEntries:[]}),
 readJson('dist/v3/agenda.json',{agenda:[]}),readJson('dist/v3/results.json',{results:[]})
]);
const formerIds=new Set((formerDoc.players||[]).map(p=>p.id)),playerSourceById=new Map();
for(const p of playersDoc.players||[])playerSourceById.set(p.id||p.name,p);
for(const p of formerDoc.players||[]){const key=p.id||p.name,old=playerSourceById.get(key)||{};playerSourceById.set(key,{...old,...p,aliases:[...new Set([...(old.aliases||[]),...(p.aliases||[])])]})}
const players=uniqueById([...playerSourceById.values()].map(p=>compact({
 id:stableId('player','courtwatch',p.id||p.name),courtwatchId:p.id||'',displayName:p.name||'',
 aliases:[...new Set([p.name,...(p.aliases||[])].filter(Boolean))],club:p.club||'',active:!formerIds.has(p.id),
 identifiers:{fitpMembershipCard:p.membershipCard||'',tennisEuropePlayerId:p.profileSync?.tennisEurope?.profileId||'',itfWorldTennisId:p.profileSync?.itf?.worldTennisId||p.worldTennisId||''},
 circuits:[...new Set((p.circuits||[]).map(v=>{try{return normalizeCircuit(v)}catch{return String(v||'').toLowerCase()}}))],
 provenance:[sourceRef('manual',p.id||p.name,'',NOW)]
})),'player');
const playerByCourtWatchId=new Map(players.map(p=>[p.courtwatchId,p])),tournamentMap=new Map(),entries=[];
for(const row of entriesDoc.tournamentEntries||[]){
 const circuit=normalizeCircuit(row.circuit),sourceId=String(row.competitionId||row.tournamentName||''),tournamentId=stableId('tournament',circuit,sourceId);
 const tournament=compact({id:tournamentId,circuit,sourceTournamentId:sourceId,name:row.tournamentName||'',location:row.location||'',startDate:ensureIsoDate(row.startDate,'tournament.startDate'),endDate:ensureIsoDate(row.endDate,'tournament.endDate'),officialStartDate:ensureIsoDate(row.officialStartDate||row.startDate,'tournament.officialStartDate'),status:row.status||'known',source:sourceRef(circuit,sourceId,row.sourceUrl,row.lastSeen||entriesDoc.generatedAt)});
 const old=tournamentMap.get(tournamentId);if(!old)tournamentMap.set(tournamentId,tournament);else for(const field of ['circuit','sourceTournamentId','name','startDate','endDate'])if(old[field]&&tournament[field]&&old[field]!==tournament[field])throw new Error('Tournament conflict '+tournamentId+' field '+field);
 const player=playerByCourtWatchId.get(row.playerId);if(!player)throw new Error('Unknown Court Watch player in entry: '+row.playerId);
 entries.push(compact({id:stableId('entry',tournamentId,player.id,row.acceptanceEvent||'singles'),tournamentId,playerId:player.id,circuit,eventSourceId:row.acceptanceEvent||'',state:row.calendarState||row.entryStatus||row.status||'detected',acceptance:{code:row.acceptanceCode||'',position:Number.isFinite(Number(row.acceptancePosition))?Number(row.acceptancePosition):null,label:row.calendarListLabel||'',published:Boolean(row.acceptanceListPublished)},firstObservedAt:row.firstSeenAt||'',lastObservedAt:row.lastSeen||entriesDoc.generatedAt||'',source:sourceRef(circuit,sourceId,row.sourceUrl,row.lastSeen||entriesDoc.generatedAt)}));
}
const schedules=[];
for(const row of agendaDoc.agenda||[]){const player=playerByCourtWatchId.get(row.playerId);if(!player)continue;const circuit=normalizeCircuit(row.circuit),sourceId=String(row.competitionId||row.tournamentName||''),tournamentId=stableId('tournament',circuit,sourceId);if(!tournamentMap.has(tournamentId))continue;schedules.push(compact({id:stableId('schedule',circuit,row.id||[sourceId,row.playerId,row.date,row.time,row.court].join('|')),tournamentId,playerIds:[player.id],matchId:row.matchId||'',circuit,localDate:ensureIsoDate(row.date,'schedule.localDate'),localTime:row.time||'',court:row.court||'',status:row.status||'unknown',opponentText:row.opponent||'',partnerText:row.partner||'',source:sourceRef(circuit,sourceId,row.sourceUrl||'',agendaDoc.generatedAt)}))}
const results=[];
for(const row of resultsDoc.results||[]){const player=playerByCourtWatchId.get(row.playerId);if(!player)continue;const circuit=normalizeCircuit(row.circuit),sourceId=String(row.competitionId||row.tournamentName||''),tournamentId=stableId('tournament',circuit,sourceId);if(!tournamentMap.has(tournamentId))continue;results.push(compact({id:stableId('result',circuit,row.id||[sourceId,row.playerId,row.date,row.score].join('|')),tournamentId,playerIds:[player.id],matchId:row.matchId||'',circuit,playedDate:ensureIsoDate(row.date,'result.playedDate'),score:row.score||'',outcome:row.outcome||'unknown',opponentText:row.opponent||'',partnerText:row.partner||'',status:row.score?'complete':'pending',source:sourceRef(circuit,sourceId,row.sourceUrl||'',row.lastV3ResultSync||resultsDoc.generatedAt)}))}
const documents={players,tournaments:uniqueById([...tournamentMap.values()],'tournament'),entries:uniqueById(entries,'entry'),matches:[],schedules:uniqueById(schedules,'schedule'),results:uniqueById(results,'result')};
const coverage={version:UNIVERSAL_VERSION,generatedAt:NOW,mode:'shadow_current_courtwatch_projection',historicalCoverageFrom:'2025-12-18',completeForUniversalArchive:false,blockers:['fitp_full_draw_result_oop_archive_not_certified','tennis_europe_full_draw_result_oop_archive_not_built','itf_live_full_draw_result_oop_archive_not_certified','universal_match_records_not_available'],notes:'Normalizes the current Court Watch projection and does not claim universal historical completeness.'};
const manifest={version:UNIVERSAL_VERSION,generatedAt:NOW,status:'universal_shadow_generated',publicAppChanged:false,circuits:['fitp','tennis-europe','itf'],counts:Object.fromEntries(Object.entries(documents).map(([k,v])=>[k,v.length])),sources:{entriesGeneratedAt:entriesDoc.generatedAt||null,agendaGeneratedAt:agendaDoc.generatedAt||null,resultsGeneratedAt:resultsDoc.generatedAt||null}};
await Promise.all([...Object.entries(documents).map(([name,rows])=>writeJson(OUT+'/'+name+'.json',{version:UNIVERSAL_VERSION,generatedAt:NOW,[name]:rows})),writeJson(OUT+'/coverage.json',coverage),writeJson(OUT+'/manifest.json',manifest)]);
console.log(JSON.stringify(manifest,null,2));
