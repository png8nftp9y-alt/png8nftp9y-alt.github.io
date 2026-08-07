import fs from 'node:fs/promises';
const VERSION='cw-v3-agenda-first';
const NOW=new Date().toISOString();
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
const agendaDoc=await readJson('dist/v3/agenda.json',{agenda:[]});
const agenda=agendaDoc.agenda||[];
const results=agenda.map(a=>({id:['result',a.id].join('__'),matchId:a.matchId||'',agendaId:a.id,playerId:a.playerId,playerName:a.playerName,circuit:a.circuit,date:a.date,time:a.time||'',tournamentName:a.tournamentName,matchType:a.matchType,opponent:a.opponent||'',partner:a.partner||'',score:a.result||'',outcome:a.result?'completed':'pending',color:'neutral',source:a.circuit==='fitp'?'FITP P.U.C. official draw/result page':a.circuit==='tennis-europe'?'Tennis Europe official draw/result page':'ITF official draw/result page',engine:'v3-results-ex-novo',lastV3ResultSync:NOW}));
const opponents=agenda.filter(a=>a.opponent).map(a=>({playerId:a.playerId,playerName:a.playerName,opponentName:a.opponent,tournamentName:a.tournamentName,circuit:a.circuit,ranking:'',club:'',nationality:'',source:a.circuit==='fitp'?'FITP tournament player page':'official international profile/draw',status:'pending_official_profile_lookup'}));
const checks={agenda:agenda.length,results:results.length,completed:results.filter(r=>r.score).length,losses:results.filter(r=>r.outcome==='loss').length,opponents:opponents.length,opponentsWithClub:opponents.filter(o=>o.club).length,opponentsWithNationality:opponents.filter(o=>o.nationality).length};
const sync={version:VERSION,generatedAt:NOW,status:'results_engine_ex_novo_waiting_official_results',checks,engines:{entries:{status:'built'},ordersOfPlay:{status:'built'},results:{status:'built',file:'src/v3/results-engine.mjs',method:'starts only from v3 agenda and official result targets; no data.json and no v2'}}};
await writeJson('dist/v3/results.json',{version:VERSION,generatedAt:NOW,results});
await writeJson('dist/v3/opponents.json',{version:VERSION,generatedAt:NOW,opponents});
await writeJson('dist/v3/results_log.json',sync);
const oldSync=await readJson('dist/v3/sync_status.json',{});
await writeJson('dist/v3/sync_status.json',{...oldSync,...sync,checks:{...(oldSync.checks||{}),...sync.checks},engines:{...(oldSync.engines||{}),...sync.engines}});
console.log(JSON.stringify(sync,null,2));
