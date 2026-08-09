import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const COVERAGE_FROM='2025-12-18';
const VERSION='cw-v3-agenda-first';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function validDate(end){return !end||String(end)>=COVERAGE_FROM}
function entry(row){const c=row.circuit;return {id:['entry',c,row.playerId,slug(row.competitionId||row.tournamentName)].join('__'),playerId:row.playerId||'',playerName:row.playerName||'',circuit:c,competitionId:row.competitionId||row.teProfileId||'',tournamentName:row.tournamentName||'',location:row.location||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.status||'detected',sourceQuality:row.sourceUrl?'official_source':'source_pending',sourceUrl:row.sourceUrl||'',lastSeen:row.lastSeen||NOW,engine:'v3-entries-from-ex-novo-discovery'}}
function toTournament(e){return {id:['tour',e.circuit,e.playerId,slug(e.competitionId||e.tournamentName)].join('__'),playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,circuitColor:e.circuit==='fitp'?'blue':e.circuit==='tennis-europe'?'orange':'green',competitionId:e.competitionId,name:e.tournamentName,location:e.location,startDate:e.startDate,endDate:e.endDate,status:e.status,draws:e.draws,sourceUrl:e.sourceUrl,entrySourceQuality:e.sourceQuality,lastV3EntrySync:NOW}}
const playersDoc=await readJson('players.json',{players:[]});
const fitp=await readJson('dist/v3/source_fitp_entries.json',{entries:[]});
const te=await readJson('dist/v3/source_tennis_europe_entries.json',{entries:[]});
const itf=await readJson('dist/v3/source_itf_entries.json',{entries:[]});
// Tennis Europe rows are deliberately NOT merged into the visible v3 calendar for now.
// They remain in their source file for the future dedicated TE engine, but the calendar must not show TE seed rows as FITP/active tournaments.
const teEntries=(te.entries||[]).map(entry).filter(e=>e.playerId&&validDate(e.endDate));
const entries=[...(fitp.entries||[]),...(itf.entries||[])].map(entry).filter(e=>e.playerId&&validDate(e.endDate));
const seen=new Set();
const tournamentEntries=entries.filter(e=>{const k=[e.playerId,e.circuit,e.competitionId||e.tournamentName].join('|');if(seen.has(k))return false;seen.add(k);return true});
const tournaments=tournamentEntries.map(toTournament);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const warnings=[];for(const e of tournamentEntries){if(e.circuit==='fitp'&&!e.competitionId)warnings.push('FITP senza P.U.C. id: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='itf'&&!e.sourceUrl)warnings.push(e.circuit+' senza URL ufficiale: '+e.playerName+' · '+e.tournamentName)}
const syncStatus={version:VERSION,generatedAt:NOW,status:'entries_engine_merged_ex_novo_discoveries_te_excluded_from_calendar',coverageFrom:COVERAGE_FROM,checks:{players:(playersDoc.players||[]).length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length,tennisEuropeExcludedFromCalendar:teEntries.length},engines:{discoverFitp:{status:fitp.status||'missing'},discoverTennisEurope:{status:te.status||'missing',calendarMerge:'excluded_until_dedicated_te_engine'},discoverItf:{status:itf.status||'missing'},entries:{status:'built',file:'src/v3/entries-engine.mjs',method:'merge FITP + ITF only; TE source retained but excluded from visible calendar; no v1/v2/data.json'},ordersOfPlay:{status:'pending'},results:{status:'pending'}},warnings:warnings.slice(0,200)};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:playersDoc.players||[]});
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/entries_fitp.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='fitp')});
await writeJson('dist/v3/entries_tennis_europe.json',{version:VERSION,generatedAt:NOW,tournamentEntries:[]});
await writeJson('dist/v3/entries_itf.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='itf')});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
