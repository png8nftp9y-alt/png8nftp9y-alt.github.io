import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const cfg=JSON.parse(await fs.readFile('players.json','utf8'));
const names=new Map((cfg.players||[]).map(p=>[p.id,p.name]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
for(const listName of ['players','tournaments','matches','entryStatuses','findings'])for(const x of data[listName]||[]){const n=names.get(x.id||x.playerId);if(n){if(x.id)x.name=n;if(x.playerId)x.playerName=n}}
function circuit(x){const s=String(x.sourceId||'').toLowerCase();return s.includes('tennis')?'te':s.includes('itf')?'itf':'fitp'}
function tournamentIdentity(t){if(t.competitionId)return String(t.competitionId).toUpperCase();if(t.itfTournamentKey)return String(t.itfTournamentKey).toUpperCase();if(t.teTournamentId)return String(t.teTournamentId).toUpperCase();return norm(t.name)+'|'+(t.startDate||'')+'|'+norm(t.location)}
function scoreT(x){return(x.competitionId||x.itfTournamentKey||x.teTournamentId?20:0)+(x.location?4:0)+(x.entryStatus?4:0)+(x.entryPosition?3:0)+(x.draws?.length||0)+(x.lastSeen?1:0)}
const tg=new Map();for(const t of data.tournaments||[]){const k=[t.playerId,circuit(t),tournamentIdentity(t)].join('|');const a=tg.get(k)||[];a.push(t);tg.set(k,a)}
data.tournaments=[];for(const a of tg.values()){a.sort((x,y)=>scoreT(y)-scoreT(x));const keep={...a[0]};for(const x of a.slice(1))for(const[k,v]of Object.entries(x))if((keep[k]===null||keep[k]===undefined||keep[k]==='')&&v!==null&&v!==undefined&&v!=='')keep[k]=v;data.tournaments.push(keep)}
const matches=data.matches||[];const mg=new Map();
function quality(x){return(x.result?30:0)+(x.officialMatchId?20:0)+(x.time?8:0)+(x.court?5:0)+(x.opponent&&!/^Q\d+$/i.test(x.opponent)?4:0)+(x.opponentClub?3:0)+(x.opponentRanking?2:0)}
for(const m of matches){const k=m.officialMatchId?[m.playerId,m.officialMatchId,m.competitionId||'',m.sourceId||''].join('|'):[m.playerId,m.date,m.time||'',m.court||'',m.eventType||'singles',m.competitionId||norm(m.tournamentName),norm(m.opponent||'')].join('|');const old=mg.get(k);if(!old||quality(m)>quality(old))mg.set(k,m)}
data.matches=[...mg.values()].sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`));
data.generatedAt=new Date().toISOString();data.finalization={lastRun:data.generatedAt,tournamentDuplicatesRemoved:[...tg.values()].reduce((n,a)=>n+Math.max(0,a.length-1),0),matchDuplicatesRemoved:matches.length-mg.size,matches:data.matches.length,tournaments:data.tournaments.length};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data.finalization,null,2));
