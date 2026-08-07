import fs from 'node:fs/promises';
const VERSION='cw-v3-agenda-first';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const slug=v=>norm(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function activeOrRecent(e){if(!e.endDate)return true;return e.endDate>=TODAY||e.status==='active'||e.status==='registered'}
function matchType(m){return /doppio|double/i.test(String(`${m.draw||''} ${m.eventType||''} ${m.category||''} ${m.partner||''}`))?'doubles':'singles'}
function isOfficialAgendaSource(m){const s=String(m.todayAgendaSource||m.orderOfPlaySource||m.source||m.sourceId||'').toLowerCase();return m.time||s.includes('official')||s.includes('manual-user-confirmed')||s.includes('order')||s.includes('oop')}
const entriesDoc=await readJson('dist/v3/tournament_entries.json',{tournamentEntries:[]});
const legacy=await readJson('data.json',{matches:[]});
const entries=entriesDoc.tournamentEntries||[];
const entryKeys=new Set(entries.map(e=>`${e.playerId}|${e.circuit}|${e.competitionId||e.tournamentName}`));
const monitored=new Set(entries.filter(activeOrRecent).map(e=>`${e.playerId}|${e.circuit}|${e.competitionId||e.tournamentName}`));
const raw=(legacy.matches||[]).filter(m=>m.playerId&&m.date);
const matches=[];
const agenda=[];
const rejected=[];
for(const m of raw){const c=String(m.circuit||m.sourceId||m.source||'').toLowerCase().includes('itf')?'itf':String(m.circuit||m.sourceId||m.source||'').toLowerCase().includes('tennis')?'tennis-europe':'fitp';const key=`${m.playerId}|${c}|${m.competitionId||m.tournamentName}`;if(!entryKeys.has(key)&&!entries.some(e=>e.playerId===m.playerId&&e.circuit===c&&e.tournamentName===m.tournamentName)){rejected.push({playerId:m.playerId,playerName:m.playerName,tournamentName:m.tournamentName,reason:'match without v3 tournament entry'});continue}const vm={...m,circuit:c,matchType:matchType(m),engine:'v3-orders-of-play',lastV3OopSync:NOW};matches.push(vm);if(isOfficialAgendaSource(m)||monitored.has(key)){agenda.push({id:['agenda',m.id||slug(`${m.playerId}-${m.date}-${m.time}-${m.opponent}`)].join('__'),matchId:m.id||'',playerId:m.playerId,playerName:m.playerName,circuit:c,date:m.date,time:m.time||'',court:m.court||'',tournamentName:m.tournamentName||'',competitionId:m.competitionId||'',matchType:matchType(m),partner:m.partner||'',opponent:m.opponent||'',status:m.result?'completed':m.time?'scheduled':'date_known_time_pending',source:m.todayAgendaSource||m.orderOfPlaySource||m.sourceId||'',sourceFile:m.orderOfPlayFile||'',confidence:m.todayAgendaSource?.includes('manual')?'manual':m.time?'timed':'derived_from_match',result:m.result||'',advances:m.advances,engine:'v3-orders-of-play'})}}
const byCircuit=agenda.reduce((a,x)=>{a[x.circuit]=(a[x.circuit]||0)+1;return a},{});
const sync={version:VERSION,generatedAt:NOW,status:'orders_of_play_engine_built_from_v3_entries_and_official_agenda_sources',checks:{entries:entries.length,matches:matches.length,agenda:agenda.length,byCircuit,rejectedWithoutEntry:rejected.length,timedAgenda:agenda.filter(a=>a.time).length},engines:{entries:{status:'built'},ordersOfPlay:{status:'built',file:'src/v3/orders-of-play-engine.mjs',method:'v3 entries -> official/confirmed OOP agenda; no v1/v2 UI dependency'},results:{status:'pending'}},rejected:rejected.slice(0,100)};
await writeJson('dist/v3/matches.json',{version:VERSION,generatedAt:NOW,matches});
await writeJson('dist/v3/agenda.json',{version:VERSION,generatedAt:NOW,agenda});
await writeJson('dist/v3/oop_log.json',sync);
const oldSync=await readJson('dist/v3/sync_status.json',{});
await writeJson('dist/v3/sync_status.json',{...oldSync,...sync,checks:{...(oldSync.checks||{}),...sync.checks},engines:{...(oldSync.engines||{}),...sync.engines}});
console.log(JSON.stringify(sync,null,2));
