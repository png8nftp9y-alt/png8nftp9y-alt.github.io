import fs from 'node:fs/promises';

const VERSION='cw-v3-agenda-first';
const COVERAGE_FROM='2025-12-18';
const NOW=new Date().toISOString();
const STABLE_FITP_REF=process.env.STABLE_FITP_REF||'main';
const TENNIS_EUROPE_REF=process.env.TENNIS_EUROPE_REF||'main';
const ITF_REF=process.env.ITF_REF||'main';
const RAW='https://raw.githubusercontent.com/png8nftp9y-alt/png8nftp9y-alt.github.io';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function fetchJson(ref,path){const url=`${RAW}/${ref}/${path}`;const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`fetch failed ${r.status} ${url}`);return r.json()}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function validDate(end){return !end||String(end)>=COVERAGE_FROM}
function externalTournamentInFitp(row){
 const name=norm(row.tournamentName||row.name);
 return String(row.circuit||'fitp').toLowerCase()==='fitp'&&/(^| )ITF( |$)|TENNIS EUROPE|TENNIS EUROPE JUNIOR TOUR/.test(name)
}
function cleanTeName(row){let s=String(row.searchTournamentName||row.tournamentName||'').trim();s=s.replace(/^Tennis Europe\s*-\s*/i,'').replace(/\s*-\s*Events\s*$/i,'').trim();return s||row.tournamentName||''}
function cleanTeLabel(row){const code=String(row.acceptanceCode||'').toUpperCase();const pos=Number(row.acceptancePosition||0);if(['MD','Q','A'].includes(code)&&pos>0)return `${code}-${pos}`;return String(row.calendarListLabel||'').replace(/^MD-0$/,'').trim()}
function cleanLocation(row){let loc=String(row.location||'').trim();const id=String(row.competitionId||'').toUpperCase();const name=String(row.searchTournamentName||row.tournamentName||'');if(id==='154CA6B7-2173-4DFE-ADA9-0E2CEF2DE8E4'||/Ljubicic Academy Open/i.test(name)||/^(inj|losinj|lošinj)(?:,|\s|$)/i.test(loc))loc='Veli Lošinj, Croatia';return loc}
function entry(row){const c=row.circuit;const calendarListLabel=c==='tennis-europe'?cleanTeLabel(row):(row.calendarListLabel||'');return {id:['entry',c,row.playerId,slug(row.competitionId||row.tournamentName)].join('__'),playerId:row.playerId||'',playerName:row.playerName||'',circuit:c,competitionId:row.competitionId||row.teProfileId||'',tournamentName:c==='tennis-europe'?cleanTeName(row):(row.tournamentName||''),location:c==='tennis-europe'?cleanLocation(row):(row.location||''),venueName:row.venueName||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.status||'detected',sourceQuality:row.sourceUrl?'official_source':'source_pending',sourceUrl:row.sourceUrl||'',lastSeen:row.lastSeen||NOW,engine:'v3-entries-from-isolated-engine-merge',acceptanceList:row.acceptanceList||'',acceptanceCode:row.acceptanceCode||'',acceptancePosition:row.acceptancePosition||null,calendarListLabel,acceptanceListUrl:row.acceptanceListUrl||'',acceptanceLastUpdated:row.acceptanceLastUpdated||'',acceptanceListPublished:row.acceptanceListPublished||false,entryStatus:row.entryStatus||''}}
function toTournament(e){return {id:['tour',e.circuit,e.playerId,slug(e.competitionId||e.tournamentName)].join('__'),playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,circuitColor:e.circuit==='fitp'?'blue':e.circuit==='tennis-europe'?'orange':'green',competitionId:e.competitionId,name:e.tournamentName,location:e.location,startDate:e.startDate,endDate:e.endDate,status:e.status,draws:e.draws,sourceUrl:e.sourceUrl,entrySourceQuality:e.sourceQuality,lastV3EntrySync:NOW,acceptanceList:e.acceptanceList,acceptanceCode:e.acceptanceCode,acceptancePosition:e.acceptancePosition,calendarListLabel:e.calendarListLabel,acceptanceListUrl:e.acceptanceListUrl,acceptanceLastUpdated:e.acceptanceLastUpdated,acceptanceListPublished:e.acceptanceListPublished,entryStatus:e.entryStatus}}
function light(status,label,detail,critical=false){return {status,label,detail,critical}}
function worst(items){if(items.some(x=>x.status==='red'&&x.critical))return 'red';if(items.some(x=>x.status==='red'))return 'yellow';if(items.some(x=>x.status==='yellow'))return 'yellow';return 'green'}

const playersDoc=await readJson('players.json',{players:[]});
const fitp=await fetchJson(STABLE_FITP_REF,'dist/v3/source_fitp_entries.json');
const fitpTournaments=await fetchJson(STABLE_FITP_REF,'dist/v3/source_fitp_tournaments.json').catch(()=>({}));
const te=await fetchJson(TENNIS_EUROPE_REF,'dist/v3/source_tennis_europe_entries.json');
const teTournaments=await fetchJson(TENNIS_EUROPE_REF,'dist/v3/source_tennis_europe_tournaments.json').catch(()=>({}));
const itf=await fetchJson(ITF_REF,'dist/v3/source_itf_entries.json');
const stableAgenda=await fetchJson(STABLE_FITP_REF,'dist/v3/agenda.json').catch(()=>({agenda:[]}));
const stableMatches=await fetchJson(STABLE_FITP_REF,'dist/v3/matches.json').catch(()=>({matches:[]}));
const stableResults=await fetchJson(STABLE_FITP_REF,'dist/v3/results.json').catch(()=>({results:[]}));
const stableOpponents=await fetchJson(STABLE_FITP_REF,'dist/v3/opponents.json').catch(()=>({opponents:[]}));

const teEntries=(te.entries||[]).map(r=>entry({...r,circuit:'tennis-europe'})).filter(e=>e.playerId&&e.startDate&&validDate(e.endDate));
const fitpEntries=(fitp.entries||[]).map(e=>e.circuit?e:entry({...e,circuit:'fitp'})).filter(e=>e.playerId&&validDate(e.endDate)&&!externalTournamentInFitp(e));
const fitpExternalExcluded=(fitp.entries||[]).length-fitpEntries.length;
const itfEntries=(itf.entries||[]).map(e=>e.circuit?e:entry({...e,circuit:'itf'})).filter(e=>e.playerId&&validDate(e.endDate));
const entries=[...fitpEntries,...teEntries,...itfEntries];
const seen=new Set();
const tournamentEntries=entries.filter(e=>{const k=[e.playerId,e.circuit,e.competitionId||e.tournamentName].join('|');if(seen.has(k))return false;seen.add(k);return true});
const tournaments=tournamentEntries.map(toTournament);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const teAcceptance=teEntries.filter(e=>e.entryStatus==='confirmed_on_acceptance_list').length;
const warnings=[];

const guardErrors=[];
if((playersDoc.players||[]).length<25)guardErrors.push(`players too low: ${(playersDoc.players||[]).length}`);
if((byCircuit.fitp||0)<300)guardErrors.push(`FITP too low: ${byCircuit.fitp||0}`);
if((byCircuit['tennis-europe']||0)<40)guardErrors.push(`Tennis Europe too low: ${byCircuit['tennis-europe']||0}`);
if((byCircuit.itf||0)<2)guardErrors.push(`ITF too low: ${byCircuit.itf||0}`);
const camillaTe=teEntries.some(e=>e.playerId==='camilla-lingeri');
if(!camillaTe)guardErrors.push('Camilla Lingeri missing from Tennis Europe');
if(guardErrors.length){console.error(JSON.stringify({guardErrors,byCircuit,players:(playersDoc.players||[]).length},null,2));process.exit(2)}

const diagnosticsItems=[
 light('green','FITP tornei',`${fitpTournaments.tournamentsFound||fitp.tournamentsInput||0} tornei sorgente · ref ${STABLE_FITP_REF.slice(0,7)}`,true),
 light('green','FITP iscrizioni',`${byCircuit.fitp||0} entry FITP`,true),
 light('green','Tennis Europe',`${byCircuit['tennis-europe']||0} entry TE · acceptance ${teAcceptance}`,true),
 light('green','ITF',`${byCircuit.itf||0} entry`,false),
 light(warnings.length?'yellow':'green','Calendario',`${tournamentEntries.length} tornei visibili · FITP ${byCircuit.fitp||0} · TE ${byCircuit['tennis-europe']||0} · ITF ${byCircuit.itf||0}`,true),
 light('green','App/UI',`merge isolato ${new Date(NOW).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}`,true)
];
const diagnostics={version:VERSION,generatedAt:NOW,overall:worst(diagnosticsItems),legend:{green:'ok',yellow:'attenzione/parziale',red:'errore o motore incompleto'},items:diagnosticsItems,raw:{fitp:{entriesFound:fitp.entriesFound,externalCircuitEntriesExcludedFromCalendar:fitpExternalExcluded,ref:STABLE_FITP_REF},te:{entriesVisible:teEntries.length,acceptanceConfirmed:teAcceptance,byPlayer:te.byPlayer,byAcceptance:te.byAcceptance,ref:TENNIS_EUROPE_REF},itf:{entries:itfEntries.length,ref:ITF_REF},calendar:{tournamentEntries:tournamentEntries.length,byCircuit,warnings:warnings.length}}};
const syncStatus={version:VERSION,generatedAt:NOW,status:'isolated_engine_merge_guarded_fitp_te_itf',coverageFrom:COVERAGE_FROM,checks:{players:(playersDoc.players||[]).length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length,tennisEuropeVisible:teEntries.length,tennisEuropeAcceptanceConfirmed:teAcceptance,diagnostics:diagnostics.overall},sourceRefs:{fitp:STABLE_FITP_REF,tennisEurope:TENNIS_EUROPE_REF,itf:ITF_REF},warnings};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:playersDoc.players||[]});
await writeJson('dist/v3/source_fitp_entries.json',fitp);
await writeJson('dist/v3/source_fitp_tournaments.json',fitpTournaments);
await writeJson('dist/v3/source_tennis_europe_entries.json',te);
await writeJson('dist/v3/source_tennis_europe_tournaments.json',teTournaments);
await writeJson('dist/v3/source_itf_entries.json',itf);
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/entries_fitp.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='fitp')});
await writeJson('dist/v3/entries_tennis_europe.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='tennis-europe')});
await writeJson('dist/v3/entries_itf.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='itf')});
await writeJson('dist/v3/agenda.json',stableAgenda);
await writeJson('dist/v3/matches.json',stableMatches);
await writeJson('dist/v3/results.json',stableResults);
await writeJson('dist/v3/opponents.json',stableOpponents);
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/diagnostics.json',diagnostics);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
