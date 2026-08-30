import fs from 'node:fs/promises';
import path from 'node:path';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [historical,live,registry]=await Promise.all([read('../../dist/v3/tennis_europe_oop_historical.json'),read('../../dist/v3/tennis_europe_oop_live.json'),read('../../players.json')]);
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const isoDate=value=>{const v=String(value||'');return /^\d{8}$/.test(v)?`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`:v};
const esc=value=>`'${String(value??'').replaceAll("'","''")}'`,payload=value=>esc(JSON.stringify(value));
const monitored=(registry.players||[]).filter(p=>(p.circuits||[]).some(c=>normalize(c)==='tennis europe'));
const ownersByName=new Map();for(const p of monitored){const key=normalize(p.name);if(!ownersByName.has(key))ownersByName.set(key,[]);ownersByName.get(key).push(p)}
const tournamentMap=new Map((historical.tournaments||[]).map(t=>[t.competitionId,t]));for(const t of live.tournaments||[])tournamentMap.set(t.competitionId,t);
const matchMap=new Map((historical.matches||[]).map(m=>[m.id,m]));for(const m of live.matches||[])matchMap.set(m.id,m);
const sourceIdentities=new Map();for(const match of matchMap.values())for(const player of match.players||[]){const key=normalize(player.name),identity=(player.nationality||'')+'|'+key;if(!sourceIdentities.has(key))sourceIdentities.set(key,new Set());sourceIdentities.get(key).add(identity)}
const ambiguous=[],candidates=new Map();for(const [key,owners] of ownersByName)if(owners.length>1)ambiguous.push({type:'courtwatch_name_collision',key});
for(const match of matchMap.values())for(const player of match.players||[]){const key=normalize(player.name),owners=ownersByName.get(key)||[];if(!owners.length)continue;if((sourceIdentities.get(key)?.size||0)>1){ambiguous.push({type:'source_identity_collision',key});continue}for(const owner of owners){
 const tournament=tournamentMap.get(match.competitionId)||{},playerId=String(player.id||'');
 const teamIndex=(match.teams||[]).findIndex(team=>(team||[]).map(String).includes(playerId));
 if(teamIndex<0)throw new Error('Player team missing for '+owner.id+' in '+match.id);
 const teamIds=new Set((match.teams[teamIndex]||[]).map(String));
 const partner=(match.players||[]).filter(x=>teamIds.has(String(x.id))&&String(x.id)!==playerId).map(x=>x.name).join(' / ');
 const opponents=(match.players||[]).filter(x=>!teamIds.has(String(x.id))).map(x=>x.name);
 if(!opponents.length)throw new Error('Opponent missing for '+owner.id+' in '+match.id);
 const completed=match.status==='completed',winnerTeam=Number.isInteger(match.winnerTeamIndex)?match.winnerTeamIndex:null;
 const row={id:'te-app:'+owner.id+'|'+match.id,playerId:owner.id,playerName:owner.name,sourcePlayerName:player.name,sourceNationality:player.nationality||'',matchId:match.id,competitionId:match.competitionId,tournamentName:tournament.tournamentName||tournament.name||'',location:tournament.location||'',date:isoDate(match.date),time:match.time||'',court:match.court||'',event:match.event||'',draw:match.event||'',round:match.round||'',status:match.status,score:match.score||'',result:completed?(match.score||''):'' ,winnerPlayerIds:match.winnerPlayerIds||[],winnerTeamIndex:winnerTeam,advances:completed&&winnerTeam!==null?winnerTeam===teamIndex:null,teamIndex,matchType:(match.teams||[]).some(team=>(team||[]).length>1)?'doubles':'singles',partner,opponent:opponents.join(' / '),opponentOptions:opponents,sourceUrl:match.sourceUrl,circuit:'tennis-europe',linkMethod:'exact_normalized_full_name'};
 candidates.set(owner.id+'|'+match.id,row)
}}
if(ambiguous.length)throw new Error('Ambiguous Court Watch Europe candidates: '+JSON.stringify(ambiguous));
const rows=[...candidates.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.playerId.localeCompare(b.playerId)||a.matchId.localeCompare(b.matchId));
const sql=['PRAGMA foreign_keys=ON;','DELETE FROM app_match_candidates;'];for(const r of rows)sql.push(`INSERT INTO app_match_candidates(courtwatch_id,match_id,competition_id,match_date,status,payload) VALUES(${esc(r.playerId)},${esc(r.matchId)},${esc(r.competitionId)},${esc(r.date)},${esc(r.status)},${payload(r)});`);
await fs.writeFile(path.join('seed-tennis-europe-oop','04-app-match-candidates.sql'),sql.join('\n')+'\n');
const appSql=['PRAGMA foreign_keys=ON;',`DELETE FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe';`];
for(const r of rows)appSql.push(`INSERT INTO app_matches(player_id,competition_id,match_date,payload) VALUES(${esc(r.playerId)},${esc(r.competitionId)},${esc(r.date)},${payload(r)});`);
await fs.writeFile(path.join('seed-tennis-europe-oop','05-app-matches.sql'),appSql.join('\n')+'\n');
const uniqueMatches=new Set(rows.map(x=>x.matchId)).size,completed=rows.filter(x=>x.status==='completed').length,scheduled=rows.filter(x=>x.status==='scheduled').length;
const missingAgendaFields=rows.filter(x=>!x.id||!x.playerId||!x.matchId||!x.date||!x.tournamentName||!x.opponent||!x.round||x.status==='completed'&&!x.result);
const result={status:missingAgendaFields.length?'red':'green',counts:{monitoredEuropePlayers:monitored.length,uniqueMatches,playerMatchOccurrences:rows.length,completed,scheduled,ambiguous:0,missingAgendaFields:missingAgendaFields.length},publishedToAgenda:true};
await fs.writeFile('seed-tennis-europe-oop/app-match-candidates-manifest.json',JSON.stringify(result,null,2)+'\n');
if(uniqueMatches!==147||rows.length!==149||missingAgendaFields.length)throw new Error(`App match parity failed: uniqueMatches=${uniqueMatches}, occurrences=${rows.length}, missingAgendaFields=${missingAgendaFields.length}`);
console.log(JSON.stringify(result));
