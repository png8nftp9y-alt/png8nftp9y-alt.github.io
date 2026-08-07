import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const COVERAGE_FROM='2025-12-18';
const VERSION='cw-v3-agenda-first';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function circuitOf(t){const s=String(t.sourceId||t.source||t.sourceName||t.circuit||'').toLowerCase();if(s.includes('tennis-europe')||s.includes('tennis europe')||s==='te')return 'tennis-europe';if(s.includes('itf'))return 'itf';return 'fitp'}
function validForCoverage(t){const e=t.endDate||t.date||'';return !e||e>=COVERAGE_FROM}
function sourceQuality(t){if(t.competitionId||t.teTournamentId||t.itfTournamentKey)return 'official_id';if(/^https?:\/\//i.test(t.url||''))return 'official_or_public_url';return 'dataset_pending_id'}
function entryStatus(t){if(t.entryStatus)return t.entryStatus;if(t.status==='finished')return 'completed';if(t.status==='active')return 'active';if(t.status==='upcoming')return 'registered';return 'detected'}
function makeTournament(t){const c=circuitOf(t);return {...t,circuit:c,circuitColor:c==='fitp'?'blue':c==='tennis-europe'?'orange':'green',entrySourceQuality:sourceQuality(t),lastV3EntrySync:NOW}}
function makeEntry(t){const c=circuitOf(t);const key=t.competitionId||t.teTournamentId||t.itfTournamentKey||t.key||t.id||t.name;return {id:['entry',c,t.playerId,slug(key)].filter(Boolean).join('__'),playerId:t.playerId||'',playerName:t.playerName||'',circuit:c,tournamentId:t.id||t.key||'',competitionId:t.competitionId||t.teTournamentId||t.itfTournamentKey||'',tournamentName:t.name||'',location:t.location||'',startDate:t.startDate||'',endDate:t.endDate||'',draws:t.draws||[],status:entryStatus(t),sourceQuality:sourceQuality(t),sourceUrl:t.url||'',lastSeen:t.lastSeen||t.generatedAt||NOW,engine:'v3-entries'}}
const playersDoc=await readJson('players.json',{players:[]});
const data=await readJson('data.json',{tournaments:[]});
const legacyTournaments=(data.tournaments||[]).filter(t=>t.playerId&&validForCoverage(t));
const playerIds=new Set((playersDoc.players||[]).map(p=>p.id));
const scoped=legacyTournaments.filter(t=>playerIds.has(t.playerId));
const tournaments=scoped.map(makeTournament);
const tournamentEntries=tournaments.map(makeEntry);
const byCircuit=tournamentEntries.reduce((a,e)=>{a[e.circuit]=(a[e.circuit]||0)+1;return a},{});
const warnings=[];
for(const e of tournamentEntries){if(e.circuit==='fitp'&&!e.competitionId)warnings.push(`FITP senza P.U.C. id: ${e.playerName} · ${e.tournamentName}`);if((e.circuit==='tennis-europe'||e.circuit==='itf')&&!e.sourceUrl)warnings.push(`${e.circuit} senza URL ufficiale: ${e.playerName} · ${e.tournamentName}`)}
const syncStatus={version:VERSION,generatedAt:NOW,status:'entries_engine_built_from_existing_official_sources',coverageFrom:COVERAGE_FROM,checks:{players:(playersDoc.players||[]).length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,byCircuit,warnings:warnings.length},engines:{entries:{status:'built',file:'src/v3/entries-engine.mjs',method:'separate v3 entries from current official-source dataset; no v1 UI/data dependency'},ordersOfPlay:{status:'pending'},results:{status:'pending'}},warnings:warnings.slice(0,200)};
await writeJson('dist/v3/players.json',{version:VERSION,generatedAt:NOW,players:playersDoc.players||[]});
await writeJson('dist/v3/tournament_entries.json',{version:VERSION,generatedAt:NOW,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:VERSION,generatedAt:NOW,tournaments});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/entries_log.json',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
