import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const COVERAGE_FROM='2025-12-18';
const VERSION='cw-v3-agenda-first';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function validDate(end){return !end||String(end)>=COVERAGE_FROM}
function entry(row){const c=row.circuit;return {id:['entry',c,row.playerId,slug(row.competitionId||row.tournamentName)].join('__'),playerId:row.playerId||'',playerName:row.playerName||'',circuit:c,competitionId:row.competitionId||row.teProfileId||'',tournamentName:row.tournamentName||'',location:row.location||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.status||'detected',sourceQuality:row.sourceUrl?'official_source':'source_pending',sourceUrl:row.sourceUrl||'',lastSeen:row.lastSeen||NOW,engine:'v3-entries-from-ex-novo-discovery',acceptanceList:row.acceptanceList||'',acceptanceCode:row.acceptanceCode||'',acceptancePosition:row.acceptancePosition||null,calendarListLabel:row.calendarListLabel||'',acceptanceListUrl:row.acceptanceListUrl||'',acceptanceLastUpdated:row.acceptanceLastUpdated||'',acceptanceListPublished:row.acceptanceListPublished||false,entryStatus:row.entryStatus||''}}
function toTournament(e){return {id:['tour',e.circuit,e.playerId,slug(e.competitionId||e.tournamentName)].join('__'),playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,circuitColor:e.circuit==='fitp'?'blue':e.circuit==='tennis-europe'?'orange':'green',competitionId:e.competitionId,name:e.tournamentName,location:e.location,startDate:e.startDate,endDate:e.endDate,status:e.status,draws:e.draws,sourceUrl:e.sourceUrl,entrySourceQuality:e.sourceQuality,lastV3EntrySync:NOW,acceptanceList:e.acceptanceList,acceptanceCode:e.acceptanceCode,acceptancePosition:e.acceptancePosition,calendarListLabel:e.calendarListLabel,acceptanceListUrl:e.acceptanceListUrl,acceptanceLastUpdated:e.acceptanceLastUpdated,acceptanceListPublished:e.acceptanceListPublished,entryStatus:e.entryStatus}}
function ageHours(iso){const t=Date.parse(iso||'');return Number.isFinite(t)?(Date.now()-t)/36e5:null}
function light(status,label,detail,critical=false){return {status,label,detail,critical}}
function worst(items){if(items.some(x=>x.status==='red'&&x.critical))return 'red';if(items.some(x=>x.status==='red'))return 'yellow';if(items.some(x=>x.status==='yellow'))return 'yellow';return 'green'}
function fitpTournamentLight(fitpTournaments){
 const found=fitpTournaments.tournamentsFound||0;
 const errors=fitpTournaments.errors||[];
 const failed=fitpTournaments.quality?.failedQueries ?? errors.length;
 if(found<5300)return 'red';
 if(failed>25)return 'yellow';
 return 'green';
}
function fitpTournamentDetail(fitpTournaments,mapAge){
 const found=fitpTournaments.tournamentsFound||0;
 const failed=fitpTournaments.quality?.failedQueries ?? (fitpTournaments.errors||[]).length;
 const ageText=mapAge==null?'data n/d':Math.round(mapAge)+'h fa';
 const errorText=failed?` · ${failed} query fallite/non bloccanti`:'';
 return `${found} tornei · ${ageText}${errorText}`;
}
const playersDoc=await readJson('players.json',{players:[]});
const fitp=await readJson('dist/v3/source_fitp_entries.json',{entries:[]});
const fitpHistory=await readJson('dist/v3/history/fitp_tournaments.json',{tournaments:[]});
const fitpTournaments=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const te=await readJson('dist/v3/source_tennis_europe_entries.json',{entries:[]});
const itf=await readJson('dist/v3/source_itf_entries.json',{entries:[]});
const agendaDoc=await readJson('dist/v3/agenda.json',{agenda:[]});
const resultsDoc=await readJson('dist/v3/results.json',{results:[]});
const opponentsDoc=await readJson('dist/v3/opponents.json',{opponents:[]});
const teEntries=(te.entries||[]).map(entry).filter(e=>e.playerId&&e.startDate&&validDate(e.endDate));
const archivedFitpRows=(fitpHistory.tournaments||[]).length?(fitpHistory.tournaments||[]):(fitp.entries||[]);
const fitpEntries=archivedFitpRows.map(e=>e.circuit?e:entry({...e,circuit:'fitp'})).filter(e=>e.playerId);
const itfEntries=(itf.entries||[]).map(e=>e.circuit?e:entry(e)).filter(e=>e.playerId&&validDate(e.endDate));
const entries=[...fitpEntries,...teEntries,...itfEntries];
const seen=new Set();
const tournamentEntries=entries.filter(e=>{const k=[e.playerId,e.circuit,e.competitionId||e.tournamentName].join('|');if(seen.has(k))return false;seen.add(k);return true});
const tournaments=tournamentEntries.map(toTournament);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const warnings=[];for(const e of tournamentEntries){if(e.circuit==='fitp'&&!e.competitionId)warnings.push('FITP senza P.U.C. id: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='tennis-europe'&&!e.sourceUrl)warnings.push('TE senza URL ufficiale: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='itf'&&!e.sourceUrl)warnings.push(e.circuit+' senza URL ufficiale: '+e.playerName+' · '+e.tournamentName)}
const fitpCardOnly=(fitp.byMatchMethod&&Object.keys(fitp.byMatchMethod).length===1&&fitp.byMatchMethod.membership_card===fitp.entriesFound);
const mapAge=ageHours(fitpTournaments.generatedAt);
const teAcceptance=(te.entries||[]).filter(e=>e.entryStatus==='confirmed_on_acceptance_list').length;
const fitpTournamentStatus=fitpTournamentLight(fitpTournaments);
const diagnosticsItems=[
 light(fitpTournamentStatus,'FITP tornei',fitpTournamentDetail(fitpTournaments,mapAge),true),
 light((fitp.entriesFound||0)>=282&&fitpCardOnly&&!(fitp.errors||[]).length?'green':'yellow','FITP iscrizioni',`${fitp.entriesFound||0} entry · tessera ${fitp.byMatchMethod?.membership_card||0}/${fitp.entriesFound||0} · rescue ${fitp.verifiedCompetitionEntryRescues||0}`,true),
 light(teEntries.length>0?'green':'yellow','Tennis Europe',`${teEntries.length} entry TE · acceptance ${teAcceptance} · liste ${te.globalSearch?.acceptanceListsPublished||0}/${te.globalSearch?.acceptanceListsChecked||0}`,false),
 light((itf.entries||[]).length>0?'green':'yellow','ITF',`${(itf.entries||[]).length} entry · stato ${itf.status||'n/d'}`,false),
 light(warnings.length?'yellow':'green','Calendario',`${tournamentEntries.length} tornei visibili · FITP ${byCircuit.fitp||0} · TE ${byCircuit['tennis-europe']||0} · ITF ${byCircuit.itf||0}`,true),
 light((agendaDoc.agenda||[]).length>0?'green':'red','Agenda/OOP',`${(agendaDoc.agenda||[]).length} voci · motore ${((agendaDoc.agenda||[]).length?'attivo':'pending')}`,false),
 light((resultsDoc.results||[]).length>0?'green':'red','Risultati',`${(resultsDoc.results||[]).length} risultati · motore ${((resultsDoc.results||[]).length?'attivo':'pending')}`,false),
 light((opponentsDoc.opponents||[]).length&&!(opponentsDoc.opponents||[]).filter(o=>o.dataStatus!=='ok').length?'green':'yellow','Avversari',`${(opponentsDoc.opponents||[]).length} record · da completare ${(opponentsDoc.opponents||[]).filter(o=>o.dataStatus!=='ok').length}`,false),
 light('green','App/UI',`file v3 generati · ultimo merge ${new Date(NOW).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}`,true)
];
const diagnostics={version:VERSION,generatedAt:NOW,overall:worst(diagnosticsItems),legend:{green:'ok',yellow:'attenzione/parziale',red:'errore o motore incompleto'},items:diagnosticsItems,raw:{fitp:{entriesFound:fitp.entriesFound,byPlayer:fitp.byPlayer,byMatchMethod:fitp.byMatchMethod,homonymRejected:fitp.homonymRejected,verifiedCompetitionEntryRescues:fitp.verifiedCompetitionEntryRescues,playerDrivenCandidateTournaments:fitp.playerDrivenCandidateTournaments,playerDrivenCandidateRescues:fitp.playerDrivenCandidateRescues,playerDrivenCandidatesConfirmed:fitp.playerDrivenCandidatesConfirmed},calendar:{tournamentEntries:tournamentEntries.length,byCircuit,warnings:warnings.length},te:{status:te.status,profileSeeds:te.profileSeeds,entriesVisible:teEntries.length,acceptanceConfirmed:teAcceptance,byPlayer:te.byPlayer,byAcceptance:te.byAcceptance},itf:{status:itf.status,entries:(itf.entries||[]).length}}};
const syncStatus={version:VERSION,generatedAt:NOW,status:'entries_engine_merged_ex_novo_discoveries_with_validated_te_acceptance_lists',coverageFrom:COVERAGE_FROM,checks:{players:(playersDoc.players||[]).length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length,tennisEuropeVisible:teEntries.length,tennisEuropeAcceptanceConfirmed:teAcceptance,diagnostics:diagnostics.overall},engines:{discoverFitp:{status:fitp.status||'missing'},discoverTennisEurope:{status:te.status||'missing',calendarMerge:'enabled_for_dated_official_acceptance_list_entries'},discoverItf:{status:itf.status||'missing'},entries:{status:'built',file:'src/v3/entries-engine.mjs',method:'merge FITP + validated dated TE acceptance list/profile entries + ITF; no v1/v2/data.json'},ordersOfPlay:{status:(agendaDoc.agenda||[]).length?'active':'pending'},results:{status:(resultsDoc.results||[]).length?'active':'pending'}},warnings:warnings.slice(0,200)};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:playersDoc.players||[]});
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/entries_fitp.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='fitp')});
await writeJson('dist/v3/entries_tennis_europe.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='tennis-europe')});
await writeJson('dist/v3/entries_itf.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='itf')});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/diagnostics.json',diagnostics);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
