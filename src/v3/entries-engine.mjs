import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const COVERAGE_FROM='2025-12-18';
const VERSION='cw-v3-agenda-first';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function validDate(end){return !end||String(end)>=COVERAGE_FROM}
function playerMaps(players){const byId=new Map(),byName=new Map();for(const p of players||[]){byId.set(p.id,p);byName.set(norm(p.name),p);for(const a of p.aliases||[])byName.set(norm(a),p)}return{byId,byName}}
function resolvePlayer(row,maps){return maps.byId.get(row.playerId)||maps.byName.get(norm(row.player||row.playerName||''))||{}}
function sourceCircuitMismatch(name){const n=norm(name);if(/CAMPIONATI ITALIANI|QUALIFICAZIONE AI CAMPIONATI|CAMPIONATI REGIONALI/.test(n))return false;return /^TE\s|\bTENNIS EUROPE\b|\bTEJT\b|\bITF\b|CORETENNIS|\b(PESCARA|CREMA|SASSUOLO|AGNO|KOPER|CORREGGIO|MILANO)\b/.test(n)}
function fitpEntry(row,maps){const p=resolvePlayer(row,maps);return {id:['entry','fitp',p.id,slug(row.competitionId||row.competition||row.name)].join('__'),playerId:p.id||row.playerId||'',playerName:p.name||row.player||row.playerName||'',circuit:'fitp',competitionId:row.competitionId||'',tournamentName:row.competition||row.tournamentName||row.name||'',location:row.location||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.endDate&&row.endDate<NOW.slice(0,10)?'completed':'detected',sourceQuality:row.competitionId?'official_puc_id':'puc_pending_id',sourceUrl:row.competitionId?'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(row.competitionId):'',lastSeen:NOW,engine:'v3-entries-fitp-official-puc'}}
function teEntry(row,maps){const p=resolvePlayer(row,maps);return {id:['entry','tennis-europe',p.id,slug(row.teTournamentId||row.tournamentName||row.name)].join('__'),playerId:p.id||row.playerId||'',playerName:p.name||row.playerName||'',circuit:'tennis-europe',competitionId:row.teTournamentId||row.tournamentKey||'',tournamentName:row.name||row.tournamentName||'Tennis Europe',location:row.location||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.entryStatus||row.status||'detected',sourceQuality:row.url?'official_te_url':'te_pending_url',sourceUrl:row.url||'',lastSeen:NOW,engine:'v3-entries-tennis-europe-official'}}
function itfEntry(row,maps){const p=resolvePlayer(row,maps);return {id:['entry','itf',p.id,slug(row.tournamentKey||row.tournamentName||row.name)].join('__'),playerId:p.id||row.playerId||'',playerName:p.name||row.playerName||'',circuit:'itf',competitionId:row.tournamentKey||row.itfTournamentKey||'',tournamentName:row.tournamentName||row.name||'ITF',location:row.location||'',startDate:row.startDate||'',endDate:row.endDate||'',draws:row.draws||[],status:row.status||'detected',sourceQuality:row.url?'official_itf_url':'itf_pending_url',sourceUrl:row.url||'',lastSeen:NOW,engine:'v3-entries-itf-official'}}
function toTournament(e){return {id:['tour',e.circuit,e.playerId,slug(e.competitionId||e.tournamentName)].join('__'),playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,circuitColor:e.circuit==='fitp'?'blue':e.circuit==='tennis-europe'?'orange':'green',competitionId:e.competitionId,name:e.tournamentName,location:e.location,startDate:e.startDate,endDate:e.endDate,status:e.status,draws:e.draws,sourceUrl:e.sourceUrl,entrySourceQuality:e.sourceQuality,lastV3EntrySync:NOW}}
const playersDoc=await readJson('players.json',{players:[]});
const maps=playerMaps(playersDoc.players||[]);
const fitp=await readJson('puc-entries.json',{found:[]});
const te=await readJson('te-entries.json',{hits:[]});
const itf=await readJson('itf-sync.json',{hits:[]});
const rejected=[];
const fitpRows=(fitp.found||[]).filter(r=>{if(sourceCircuitMismatch(r.competition||r.name||'')){rejected.push({player:r.player||r.playerName,tournamentName:r.competition||r.name,competitionId:r.competitionId,reason:'excluded from FITP v3 because source row is TE/ITF/international'});return false}return true});
const entries=[...fitpRows.map(r=>fitpEntry(r,maps)),...(te.hits||[]).map(r=>teEntry(r,maps)),...(itf.hits||[]).map(r=>itfEntry(r,maps))].filter(e=>e.playerId&&validDate(e.endDate));
const seen=new Set();
const tournamentEntries=entries.filter(e=>{const k=[e.playerId,e.circuit,e.competitionId||e.tournamentName].join('|');if(seen.has(k))return false;seen.add(k);return true});
const tournaments=tournamentEntries.map(toTournament);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const warnings=[];for(const e of tournamentEntries){if(e.circuit==='fitp'&&!e.competitionId)warnings.push('FITP senza P.U.C. id: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='tennis-europe'&&!e.sourceUrl)warnings.push('Tennis Europe senza URL: '+e.playerName+' · '+e.tournamentName);if(e.circuit==='itf'&&!e.sourceUrl)warnings.push('ITF senza URL: '+e.playerName+' · '+e.tournamentName)}
const syncStatus={version:VERSION,generatedAt:NOW,status:'entries_engine_ex_novo_source_files_only',coverageFrom:COVERAGE_FROM,checks:{players:(playersDoc.players||[]).length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length,rejectedCircuitMismatch:rejected.length},engines:{entries:{status:'built',file:'src/v3/entries-engine.mjs',method:'FITP from puc-entries.json, Tennis Europe from te-entries.json, ITF from itf-sync.json; no data.json and no v2'},ordersOfPlay:{status:'pending'},results:{status:'pending'}},warnings:warnings.slice(0,200),rejected};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:playersDoc.players||[]});
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/entries_fitp.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='fitp')});
await writeJson('dist/v3/entries_tennis_europe.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='tennis-europe')});
await writeJson('dist/v3/entries_itf.json',{version:VERSION,generatedAt:NOW,tournamentEntries:tournamentEntries.filter(e=>e.circuit==='itf')});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
