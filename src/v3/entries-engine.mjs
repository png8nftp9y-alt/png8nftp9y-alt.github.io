import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const COVERAGE_FROM='2025-12-18';
const VERSION='cw-v3-agenda-first';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function validDate(end){return !end||String(end)>=COVERAGE_FROM}
function externalTournamentInFitp(row){
 const name=norm(row.tournamentName||row.name);
 return String(row.circuit||'fitp').toLowerCase()==='fitp'&&/(^| )ITF( |$)|TENNIS EUROPE|TENNIS EUROPE JUNIOR TOUR/.test(name)
}
function addDaysIso(value,days){
 const iso=String(value||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
 const date=new Date(`${iso}T00:00:00.000Z`);
 if(!Number.isFinite(date.getTime()))return '';
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}
function entry(row){const c=row.circuit;return {id:['entry',c,row.playerId,slug(row.competitionId||row.tournamentName)].join('__'),playerId:row.playerId||'',playerName:row.playerName||'',circuit:c,competitionId:row.competitionId||row.teProfileId||'',tournamentName:row.tournamentName||'',location:row.location||'',venueName:row.venueName||'',address:row.address||'',addressSource:row.addressSource||'',addressSearchUrl:row.addressSearchUrl||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.status||'detected',sourceQuality:row.sourceUrl?'official_source':'source_pending',sourceUrl:row.sourceUrl||'',lastSeen:row.lastSeen||NOW,engine:'v3-entries-from-ex-novo-discovery',acceptanceList:row.acceptanceList||'',acceptanceCode:row.acceptanceCode||'',acceptancePosition:row.acceptancePosition||null,calendarListLabel:row.calendarListLabel||'',acceptanceListUrl:row.acceptanceListUrl||'',acceptanceLastUpdated:row.acceptanceLastUpdated||'',acceptanceListPublished:row.acceptanceListPublished||false,entryStatus:row.entryStatus||''}}
function toTournament(e){const officialStartDate=e.officialStartDate||e.startDate;const mapStartDate=e.circuit==='itf'?addDaysIso(officialStartDate,-2):e.startDate;return {id:['tour',e.circuit,e.playerId,slug(e.competitionId||e.tournamentName)].join('__'),playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,circuitColor:e.circuit==='fitp'?'blue':e.circuit==='tennis-europe'?'orange':'green',competitionId:e.competitionId,name:e.tournamentName,location:e.location,venueName:e.venueName||'',address:e.address||'',addressSource:e.addressSource||'',addressSearchUrl:e.addressSearchUrl||'',startDate:mapStartDate||e.startDate,officialStartDate,endDate:e.endDate,status:e.status,draws:e.draws,sourceUrl:e.sourceUrl,entrySourceQuality:e.sourceQuality,lastV3EntrySync:NOW,acceptanceList:e.acceptanceList,acceptanceCode:e.acceptanceCode,acceptancePosition:e.acceptancePosition,calendarListLabel:e.calendarListLabel,acceptanceListUrl:e.acceptanceListUrl,acceptanceLastUpdated:e.acceptanceLastUpdated,acceptanceListPublished:e.acceptanceListPublished,entryStatus:e.entryStatus}}
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
const activePlayers=playersDoc.players||[],activePlayerIds=new Set(activePlayers.map(player=>player.id));
const fitp=await readJson('dist/v3/source_fitp_entries.json',{entries:[]});
const fitpTournaments=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const te=await readJson('dist/v3/source_tennis_europe_entries.json',{entries:[]});
const teHistory=await readJson('dist/v3/source_tennis_europe_history_entries.json',{entries:[]});
const teTournaments=await readJson('dist/v3/source_tennis_europe_tournaments_sharded.json',{tournaments:[]});
const itf=await readJson('dist/v3/source_itf_entries.json',{entries:[]});
const itfTournaments=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const itfHistory=await readJson('history/itf_historical_player_tournaments.json',{entries:[]});
const agendaDoc=await readJson('dist/v3/agenda.json',{agenda:[]});
const resultsDoc=await readJson('dist/v3/results.json',{results:[]});
const opponentsDoc=await readJson('dist/v3/opponents.json',{opponents:[]});
const teSystem=await readJson('dist/v3/tennis_europe_system_diagnostics.json',{status:'missing',checks:{},errors:[{type:'missing_te_system_diagnostics'}]});
const fitpTournamentById=new Map((fitpTournaments.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const fitpVenueRegistry=await readJson('src/v3/fitp-verified-venue-addresses.json',{venues:[]});
const fitpVenueByCompetition=new Map(),fitpVenueByClub=new Map();
for(const venue of fitpVenueRegistry.venues||[]){for(const id of venue.competitionIds||[])fitpVenueByCompetition.set(String(id).toUpperCase(),venue);for(const alias of venue.aliases||[])fitpVenueByClub.set(norm(alias),venue)}
const fitpSummerCenter=row=>/CENTRO ESTIVO FITP/i.test(String(row.tournamentName||row.name||''));
function verifiedFitpVenue(row,official={}){const id=String(row.competitionId||'').toUpperCase(),club=row.venueName||official.club||row.club||'';return fitpVenueByCompetition.get(id)||fitpVenueByClub.get(norm(club))||null}
const teTournamentById=new Map((teTournaments.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const itfTournamentById=new Map((itfTournaments.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const verifiedItfVenues=new Map([['J-J30-ITA-2026-002','Crea International Country Club'],['J-J30-SRB-2026-002','Teniska Akademija Živković'],['J-J30-HUN-2026-002','Szentesi Tenisz Klub'],['J-J30-FRA-2026-003','Tennis Club de Compiègne Pompadour']]);
const teEntries=[...(te.entries||[]),...(teHistory.entries||[])].map(r=>{const official=teTournamentById.get(String(r.competitionId||'').toUpperCase())||{};return entry({...r,circuit:'tennis-europe',venueName:r.venueName||official.venueName||'',address:r.address||official.address||''})}).filter(e=>e.playerId&&e.startDate&&validDate(e.endDate));
const fitpEntries=(fitp.entries||[]).map(r=>{const official=fitpTournamentById.get(String(r.competitionId||'').toUpperCase())||{},verified=verifiedFitpVenue(r,official),address=r.address||official.address||verified?.address||'',addressSource=r.address||official.address?'official_puc':verified?'verified_web_fallback':fitpSummerCenter(r)?'fitp_summer_center_exempt':'google_search_required';return entry({...r,circuit:'fitp',location:verified?.location||r.location,venueName:verified?.venueName||r.venueName||official.club||'',address,addressSource,addressSearchUrl:addressSource==='google_search_required'?'https://www.google.com/search?q='+encodeURIComponent(`${r.venueName||official.club||r.tournamentName||''} indirizzo circolo tennis`):''})}).filter(e=>e.playerId&&validDate(e.endDate)&&!externalTournamentInFitp(e));
const fitpExternalExcluded=(fitp.entries||[]).length-fitpEntries.length;
const itfEntries=[...(itfHistory.entries||[]),...(itf.entries||[])].map(r=>{const id=String(r.competitionId||'').toUpperCase(),official=itfTournamentById.get(id)||{};return entry({...r,circuit:'itf',tournamentName:r.tournamentName||official.tournamentName,location:official.location||r.location,venueName:r.venueName||official.venueName||official.clubName||verifiedItfVenues.get(id)||'',address:r.address||official.address||''})});
const entries=[...fitpEntries,...teEntries,...itfEntries].map(e=>e.circuit?e:entry(e)).filter(e=>e.playerId&&activePlayerIds.has(e.playerId)&&validDate(e.endDate));
const acceptancePriority=e=>({MD:0,Q:1,A:2}[e.acceptanceCode]??3),acceptancePosition=e=>Number.isFinite(Number(e.acceptancePosition))?Number(e.acceptancePosition):Number.MAX_SAFE_INTEGER;
const best=new Map();for(const e of entries){const k=[e.playerId,e.circuit,e.competitionId||e.tournamentName].join('|'),old=best.get(k);if(!old||acceptancePriority(e)<acceptancePriority(old)||(acceptancePriority(e)===acceptancePriority(old)&&acceptancePosition(e)<acceptancePosition(old)))best.set(k,e)}
const tournamentEntries=[...best.values()].sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.competitionId||a.tournamentName).localeCompare(String(b.competitionId||b.tournamentName))||acceptancePriority(a)-acceptancePriority(b)||acceptancePosition(a)-acceptancePosition(b)||String(a.playerName).localeCompare(String(b.playerName)));
const tournaments=tournamentEntries.map(toTournament);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const itfMapEntries=tournamentEntries.filter(e=>e.circuit==='itf'),itfCurrentAcceptance=Number.isFinite(Number(itf.currentAcceptanceEntries))?Number(itf.currentAcceptanceEntries):(itf.entries||[]).filter(e=>!e.historicalBackfill&&e.acceptanceListPublished).length,itfHistoricalEntries=itfMapEntries.filter(e=>e.historicalBackfill||/histor|draw_confirmed/i.test(String(e.entryStatus||''))).length,itfWithdrawals=(itf.withdrawals||[]).length;
const warnings=[];for(const e of tournamentEntries){if(e.circuit==='fitp'&&!e.competitionId)warnings.push('FITP senza P.U.C. id: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='fitp'&&!e.address&&!fitpSummerCenter(e))warnings.push('FITP indirizzo da cercare su Google e verificare: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='tennis-europe'&&!e.sourceUrl)warnings.push('TE senza URL ufficiale: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='itf'&&!e.sourceUrl)warnings.push(e.circuit+' senza URL ufficiale: '+e.playerName+' · '+e.tournamentName)}
const fitpCardOnly=(fitp.byMatchMethod&&Object.keys(fitp.byMatchMethod).length===1&&fitp.byMatchMethod.membership_card===fitp.entriesFound);
const mapAge=ageHours(fitpTournaments.generatedAt);
const teAcceptance=(te.entries||[]).filter(e=>e.entryStatus==='confirmed_on_acceptance_list').length;
const fitpTournamentStatus=fitpTournamentLight(fitpTournaments);
const diagnosticsItems=[
 light(fitpTournamentStatus,'FITP tornei',fitpTournamentDetail(fitpTournaments,mapAge),true),
 light((fitp.entriesFound||0)>=282&&fitpCardOnly&&!(fitp.errors||[]).length?'green':'yellow','FITP iscrizioni',`${fitp.entriesFound||0} entry · tessera ${fitp.byMatchMethod?.membership_card||0}/${fitp.entriesFound||0} · rescue ${fitp.verifiedCompetitionEntryRescues||0}`,true),
 light(teSystem.status==='green'?'green':teSystem.status==='red'?'red':'yellow','Tennis Europe',`${(te.entries||[]).filter(e=>e.circuit==='tennis-europe').length} presenze · T−1 ${teSystem.checks?.confirmed||0}/${teSystem.checks?.rejected||0} · mappa ${teSystem.checks?.mapTournaments||0} · DB ${teSystem.checks?.participantSnapshots||0} liste/${teSystem.checks?.participantIds||0} ID · continuità ${teSystem.checks?.continuityCycles||0}`,true),
 light(String(itf.status||'').startsWith('itf_acceptance_complete')?'green':'yellow','ITF',`${itfMapEntries.length} presenze in mappa · acceptance correnti ${itfCurrentAcceptance} · storico ${itfHistoricalEntries} · withdrawn ${itfWithdrawals} · stato ${itf.status||'n/d'}`,false),
 light(warnings.length?'yellow':'green','Calendario',`${tournamentEntries.length} tornei visibili · FITP ${byCircuit.fitp||0} · TE ${byCircuit['tennis-europe']||0} · ITF ${byCircuit.itf||0}`,true),
 light((agendaDoc.agenda||[]).length>0?'green':'red','Agenda/OOP',`${(agendaDoc.agenda||[]).length} voci · motore ${((agendaDoc.agenda||[]).length?'attivo':'pending')}`,false),
 light((resultsDoc.results||[]).length>0?'green':'red','Risultati',`${(resultsDoc.results||[]).length} risultati · motore ${((resultsDoc.results||[]).length?'attivo':'pending')}`,false),
 light((opponentsDoc.opponents||[]).length&&!(opponentsDoc.opponents||[]).filter(o=>o.dataStatus!=='ok').length?'green':'yellow','Avversari',`${(opponentsDoc.opponents||[]).length} record · da completare ${(opponentsDoc.opponents||[]).filter(o=>o.dataStatus!=='ok').length}`,false),
 light('green','App/UI',`file v3 generati · ultimo merge ${new Date(NOW).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}`,true)
];
const diagnostics={version:VERSION,generatedAt:NOW,overall:worst(diagnosticsItems),legend:{green:'ok',yellow:'attenzione/parziale',red:'errore o motore incompleto'},items:diagnosticsItems,raw:{fitp:{entriesFound:fitp.entriesFound,externalCircuitEntriesExcludedFromCalendar:fitpExternalExcluded,byPlayer:fitp.byPlayer,byMatchMethod:fitp.byMatchMethod,homonymRejected:fitp.homonymRejected,verifiedCompetitionEntryRescues:fitp.verifiedCompetitionEntryRescues,playerDrivenCandidateTournaments:fitp.playerDrivenCandidateTournaments,playerDrivenCandidateRescues:fitp.playerDrivenCandidateRescues,playerDrivenCandidatesConfirmed:fitp.playerDrivenCandidatesConfirmed},calendar:{tournamentEntries:tournamentEntries.length,byCircuit,warnings:warnings.length},te:{status:te.status,profileSeeds:te.profileSeeds,entriesVisible:teEntries.length,acceptanceConfirmed:teAcceptance,byPlayer:te.byPlayer,byAcceptance:te.byAcceptance,system:teSystem},itf:{status:itf.status,mapEntries:itfMapEntries.length,currentAcceptanceEntries:itfCurrentAcceptance,historicalEntries:itfHistoricalEntries,withdrawals:itfWithdrawals,sourceEntries:(itf.entries||[]).length,archiveEntries:(itfHistory.entries||[]).length}}};
const syncStatus={version:VERSION,generatedAt:NOW,status:'entries_engine_merged_ex_novo_discoveries_with_validated_te_acceptance_lists',coverageFrom:COVERAGE_FROM,checks:{players:activePlayers.length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length,tennisEuropeVisible:teEntries.length,tennisEuropeAcceptanceConfirmed:teAcceptance,diagnostics:diagnostics.overall},engines:{discoverFitp:{status:fitp.status||'missing'},discoverTennisEurope:{status:te.status||'missing',calendarMerge:'enabled_for_dated_official_acceptance_list_entries'},discoverItf:{status:itf.status||'missing'},entries:{status:'built',file:'src/v3/entries-engine.mjs',method:'merge FITP + validated dated TE acceptance list/profile entries + ITF; no v1/v2/data.json'},ordersOfPlay:{status:(agendaDoc.agenda||[]).length?'active':'pending'},results:{status:(resultsDoc.results||[]).length?'active':'pending'}},warnings:warnings.slice(0,200)};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:activePlayers});
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/entries_fitp.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='fitp')});
await writeJson('dist/v3/entries_tennis_europe.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='tennis-europe')});
await writeJson('dist/v3/entries_itf.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='itf')});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/diagnostics.json',diagnostics);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
