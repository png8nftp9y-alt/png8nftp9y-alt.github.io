import fs from 'node:fs/promises';
const VERSION='cw-v3-agenda-first';
const NOW=new Date().toISOString();
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function outcome(m){if(m.advances===true)return 'win';if(m.advances===false)return 'loss';const r=String(m.result||'').trim();if(!r)return 'pending';return 'completed'}
function resultColor(o){return o==='loss'?'red':o==='win'?'green':'neutral'}
const agendaDoc=await readJson('dist/v3/agenda.json',{agenda:[]});
const matchesDoc=await readJson('dist/v3/matches.json',{matches:[]});
const opponentsDoc=await readJson('dist/v3/opponents.json',{opponents:[]});
const agenda=agendaDoc.agenda||[];
const matches=matchesDoc.matches||[];
const byMatch=new Map(matches.map(m=>[m.id,m]));
const results=[];
const opponentMap=new Map((opponentsDoc.opponents||[]).map(o=>[`${o.playerId||''}|${o.opponentName||o.name||''}|${o.tournamentName||''}`,o]));
const generatedOpponents=[];
for(const a of agenda){const m=byMatch.get(a.matchId)||{};const o=outcome({...m,...a});const opponentName=a.opponent||m.opponent||'';const base={playerId:a.playerId,playerName:a.playerName,opponentName,tournamentName:a.tournamentName,circuit:a.circuit};let opp=opponentMap.get(`${a.playerId}|${opponentName}|${a.tournamentName}`);if(!opp&&opponentName){opp={...base,ranking:m.opponentRanking||m.ranking||'',club:a.circuit==='fitp'?(m.opponentClub||m.club||''):'',nationality:a.circuit!=='fitp'?(m.opponentNationality||m.nationality||''):'',source:m.opponentSource||m.source||'',status:(m.opponentClub||m.opponentRanking||m.opponentNationality)?'partial_from_match':'pending_official_profile_lookup'};generatedOpponents.push(opp)}
results.push({id:['result',a.matchId||a.id].join('__'),matchId:a.matchId||'',agendaId:a.id,playerId:a.playerId,playerName:a.playerName,circuit:a.circuit,date:a.date,time:a.time||'',tournamentName:a.tournamentName,matchType:a.matchType,opponent:opponentName,partner:a.partner||'',score:a.result||m.result||'',outcome:o,color:resultColor(o),source:m.resultSource||a.source||'',engine:'v3-results',lastV3ResultSync:NOW})}
const mergedOpp=[...(opponentsDoc.opponents||[]),...generatedOpponents];
const checks={agenda:agenda.length,results:results.length,completed:results.filter(r=>r.score).length,losses:results.filter(r=>r.outcome==='loss').length,opponents:mergedOpp.length,opponentsWithClub:mergedOpp.filter(o=>o.club).length,opponentsWithNationality:mergedOpp.filter(o=>o.nationality).length};
const sync={version:VERSION,generatedAt:NOW,status:'results_engine_built_from_v3_agenda',checks,engines:{entries:{status:'built'},ordersOfPlay:{status:'built'},results:{status:'built',file:'src/v3/results-engine.mjs',method:'v3 agenda -> results/opponents; loss color red'}}};
await writeJson('dist/v3/results.json',{version:VERSION,generatedAt:NOW,results});
await writeJson('dist/v3/opponents.json',{version:VERSION,generatedAt:NOW,opponents:mergedOpp});
await writeJson('dist/v3/results_log.json',sync);
const oldSync=await readJson('dist/v3/sync_status.json',{});
await writeJson('dist/v3/sync_status.json',{...oldSync,...sync,checks:{...(oldSync.checks||{}),...sync.checks},engines:{...(oldSync.engines||{}),...sync.engines}});
console.log(JSON.stringify(sync,null,2));
