import fs from 'node:fs/promises';
const VERSION='cw-v3-agenda-first';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function active(e){return !e.endDate||e.endDate>=TODAY||['active','registered','detected'].includes(e.status)}
function mkAgenda(e){return {id:['agenda','pending',e.circuit,e.playerId,e.competitionId||e.tournamentName].join('__').replace(/[^a-zA-Z0-9_-]+/g,'-'),matchId:'',playerId:e.playerId,playerName:e.playerName,circuit:e.circuit,date:e.startDate&&e.startDate<=TODAY&&(!e.endDate||e.endDate>=TODAY)?TODAY:(e.startDate||''),time:'',court:'',tournamentName:e.tournamentName,competitionId:e.competitionId,matchType:'',partner:'',opponent:'',status:'order_of_play_pending',source:e.circuit==='fitp'?'FITP P.U.C. order-of-play endpoint':e.circuit==='tennis-europe'?'Tennis Europe official tournament page':'ITF official tournament page',sourceFile:'',confidence:'pending_official_oop',result:'',engine:'v3-orders-of-play-ex-novo'}}
const entriesDoc=await readJson('dist/v3/tournament_entries.json',{tournamentEntries:[]});
const entries=(entriesDoc.tournamentEntries||[]).filter(active);
const agenda=entries.map(mkAgenda);
const matches=[];
const byCircuit=agenda.reduce((a,x)=>{a[x.circuit]=(a[x.circuit]||0)+1;return a},{});
const sync={version:VERSION,generatedAt:NOW,status:'orders_of_play_engine_ex_novo_waiting_official_daily_oop',checks:{entries:entries.length,matches:matches.length,agenda:agenda.length,byCircuit,timedAgenda:0},engines:{entries:{status:'built'},ordersOfPlay:{status:'built',file:'src/v3/orders-of-play-engine.mjs',method:'starts only from v3 tournament_entries; no data.json and no v2'},results:{status:'pending'}}};
await writeJson('dist/v3/matches.json',{version:VERSION,generatedAt:NOW,matches});
await writeJson('dist/v3/agenda.json',{version:VERSION,generatedAt:NOW,agenda});
await writeJson('dist/v3/orders_of_play.json',{version:VERSION,generatedAt:NOW,ordersOfPlay:agenda});
await writeJson('dist/v3/oop_log.json',sync);
const oldSync=await readJson('dist/v3/sync_status.json',{});
await writeJson('dist/v3/sync_status.json',{...oldSync,...sync,checks:{...(oldSync.checks||{}),...sync.checks},engines:{...(oldSync.engines||{}),...sync.engines}});
console.log(JSON.stringify(sync,null,2));
