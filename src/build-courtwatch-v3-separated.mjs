import fs from 'node:fs/promises';
const now=new Date().toISOString();
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function circuit(x){const s=String(x.sourceId||x.source||x.sourceName||x.circuit||'').toLowerCase(); if(s.includes('tennis-europe')||s.includes('tennis europe')||s==='te')return 'tennis-europe'; if(s.includes('itf'))return 'itf'; return 'fitp'}
function makeId(parts){return parts.map(x=>String(x||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean).join('__')}
const data=await readJson('data.json',{players:[],tournaments:[],matches:[]});
const current=await readJson('players.json',{players:[]});
const former=await readJson('former-players.json',{players:[]});
const players=(current.players||[]).map(p=>({...p,type:'current'}));
const formerPlayers=(former.players||[]).map(p=>({...p,type:'former'}));
const tournaments=(data.tournaments||[]).map(t=>({...t,circuit:circuit(t),circuitColor:circuit(t)==='fitp'?'blue':circuit(t)==='tennis-europe'?'orange':'green'}));
const matches=(data.matches||[]).map(m=>({...m,circuit:circuit(m),circuitColor:circuit(m)==='fitp'?'blue':circuit(m)==='tennis-europe'?'orange':'green'}));
const tournamentEntries=tournaments.map(t=>({id:makeId(['entry',t.playerId,t.circuit,t.competitionId||t.teTournamentId||t.itfTournamentKey||t.name]),playerId:t.playerId||'',playerName:t.playerName||'',tournamentId:t.id||'',circuit:t.circuit,competitionId:t.competitionId||t.teTournamentId||t.itfTournamentKey||'',tournamentName:t.name||'',startDate:t.startDate||'',endDate:t.endDate||'',status:t.entryStatus||t.status||'detected',source:t.url?'official-or-public':'dataset',lastSeen:t.lastSeen||data.generatedAt||now}));
const agenda=(data.matches||[]).filter(m=>m.date).map(m=>({id:makeId(['agenda',m.id,m.date,m.time,m.court]),matchId:m.id||'',playerId:m.playerId||'',playerName:m.playerName||'',circuit:circuit(m),date:m.date||'',time:m.time||'',court:m.court||'',tournamentName:m.tournamentName||'',competitionId:m.competitionId||'',matchType:/doppio|double/i.test(String(m.draw||m.eventType||m.category||m.partner||''))?'doubles':'singles',partner:m.partner||'',opponent:m.opponent||'',status:m.result?'completed':'scheduled',source:m.todayAgendaSource||m.sourceId||m.source||'',sourceFile:m.orderOfPlayFile||'',confidence:m.todayAgendaSource?.includes('manual')?'manual':(m.time?'timed':'derived'),result:m.result||'',advances:m.advances}));
const results=matches.filter(m=>m.result).map(m=>({id:makeId(['result',m.id]),matchId:m.id||'',playerId:m.playerId||'',playerName:m.playerName||'',circuit:m.circuit,date:m.date||'',tournamentName:m.tournamentName||'',round:m.round||'',opponent:m.opponent||'',result:m.result||'',advances:m.advances,status:m.advances===false?'loss':m.advances===true?'win':'completed',source:m.resultSource||m.sourceId||m.source||'',lastChecked:m.resultLastChecked||data.generatedAt||now}));
const opponents=[];
for(const m of matches){if(!m.opponent)continue; for(const name of String(m.opponent).split('/').map(x=>x.trim()).filter(Boolean)){const c=m.circuit;opponents.push({id:makeId(['opp',c,name,m.competitionId,m.playerId]),matchId:m.id||'',playerId:m.playerId||'',playerName:m.playerName||'',circuit:c,tournamentName:m.tournamentName||'',competitionId:m.competitionId||'',opponentName:name,ranking:m.opponentRanking||'',club:c==='fitp'?(m.opponentClub||''):'',nationality:(c==='itf'||c==='tennis-europe')?(m.opponentNationality||''):'',dataStatus:(c==='fitp'&&!m.opponentClub)||((c==='itf'||c==='tennis-europe')&&!m.opponentNationality)?'needs_backfill':'ok',source:c==='fitp'?'fitp-tournament-player-page':'international-profile-or-draw'}})}
const syncStatus={version:'cw-v3-agenda-first',generatedAt:now,checks:{players:players.length,formerPlayers:formerPlayers.length,tournamentEntries:tournamentEntries.length,tournaments:tournaments.length,agenda:agenda.length,matches:matches.length,results:results.length,opponents:opponents.length,opponentsNeedsBackfill:opponents.filter(o=>o.dataStatus!=='ok').length},engines:{entries:'needs v3 refactor per circuit',ordersOfPlay:'needs v3 official-only parser per circuit',results:'needs v3 result-from-agenda checker'},status:'separated_files_built'};
await writeJson('dist/v3/players.json',{version:'cw-v3-agenda-first',generatedAt:now,players});
await writeJson('dist/v3/former-players.json',{version:'cw-v3-agenda-first',generatedAt:now,players:formerPlayers});
await writeJson('dist/v3/tournament_entries.json',{version:'cw-v3-agenda-first',generatedAt:now,tournamentEntries});
await writeJson('dist/v3/tournaments.json',{version:'cw-v3-agenda-first',generatedAt:now,tournaments});
await writeJson('dist/v3/agenda.json',{version:'cw-v3-agenda-first',generatedAt:now,agenda});
await writeJson('dist/v3/matches.json',{version:'cw-v3-agenda-first',generatedAt:now,matches});
await writeJson('dist/v3/results.json',{version:'cw-v3-agenda-first',generatedAt:now,results});
await writeJson('dist/v3/opponents.json',{version:'cw-v3-agenda-first',generatedAt:now,opponents});
await writeJson('dist/v3/sync_status.json',syncStatus);
await writeJson('dist/v3/data.json',{version:'cw-v3-agenda-first',generatedAt:now,players,tournamentEntries,tournaments,agenda,matches,results,opponents,syncStatus});
await writeJson('courtwatch-v3-build.log',syncStatus);
console.log(JSON.stringify(syncStatus,null,2));
