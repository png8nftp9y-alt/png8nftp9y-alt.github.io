import fs from 'node:fs/promises';
import path from 'node:path';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [historical,live]=await Promise.all([read('../../dist/v3/tennis_europe_oop_historical.json'),read('../../dist/v3/tennis_europe_oop_live.json')]);
if(historical.status!=='green'||live.status!=='green')throw new Error('Europe OOP source is not green');
const esc=value=>`'${String(value??'').replaceAll("'","''")}'`,payload=row=>esc(JSON.stringify(row));
const isoDate=value=>{const v=String(value||'');return /^\d{8}$/.test(v)?`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`:v||null};
const norm=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const tournamentMap=new Map((historical.tournaments||[]).map(x=>[x.competitionId,x]));
for(const x of live.tournaments||[])tournamentMap.set(x.competitionId,x);
const matchMap=new Map((historical.matches||[]).map(x=>[x.id,x]));
for(const x of live.matches||[])matchMap.set(x.id,x);
const tournaments=[...tournamentMap.values()],matches=[...matchMap.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
const identities=new Map();
for(const match of matches)for(const player of match.players||[]){const key=`${player.nationality||''}|${norm(player.name)}`,date=isoDate(match.date),old=identities.get(key)||{identityKey:key,displayName:player.name,normalizedName:norm(player.name),nationality:player.nationality||'',occurrences:0,firstMatchDate:date,lastMatchDate:date};old.occurrences++;if(date<old.firstMatchDate)old.firstMatchDate=date;if(date>old.lastMatchDate)old.lastMatchDate=date;identities.set(key,old)}
const dir='seed-tennis-europe-oop';await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(dir,{recursive:true});
const reset=['PRAGMA foreign_keys=ON;','DELETE FROM match_participants;','DELETE FROM tennis_europe_players;','DELETE FROM results WHERE circuit=\'tennis-europe\';','DELETE FROM schedules WHERE circuit=\'tennis-europe\';','DELETE FROM matches WHERE circuit=\'tennis-europe\';',"DELETE FROM tournaments WHERE id LIKE 'te-oop:%';"];
await fs.writeFile(path.join(dir,'00-reset.sql'),reset.join('\n')+'\n');
const tournamentSql=['PRAGMA foreign_keys=ON;'];
for(const t of tournaments){const id=`te-oop:${t.competitionId}`,compact={...t};delete compact.matches;tournamentSql.push(`INSERT INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) VALUES(${esc(id)},'tennis-europe',${esc(t.competitionId)},${esc(t.startDate)},${esc(t.endDate)},${payload(compact)});`)}
await fs.writeFile(path.join(dir,'01-tournaments.sql'),tournamentSql.join('\n')+'\n');
const playerRows=[...identities.values()],playerChunk=500;
for(let start=0,index=0;start<playerRows.length;start+=playerChunk,index++){const sql=['PRAGMA foreign_keys=ON;'];for(const p of playerRows.slice(start,start+playerChunk))sql.push(`INSERT INTO tennis_europe_players(identity_key,display_name,normalized_name,nationality,occurrences,first_match_date,last_match_date,payload) VALUES(${esc(p.identityKey)},${esc(p.displayName)},${esc(p.normalizedName)},${esc(p.nationality)},${p.occurrences},${esc(p.firstMatchDate)},${esc(p.lastMatchDate)},${payload(p)});`);await fs.writeFile(path.join(dir,`02-players-${String(index).padStart(2,'0')}.sql`),sql.join('\n')+'\n')}
const shardCount=64,shards=Array.from({length:shardCount},()=>['PRAGMA foreign_keys=ON;']);
for(let i=0;i<matches.length;i++){
 const m=matches[i],date=isoDate(m.date),tid=`te-oop:${m.competitionId}`,s=shards[i%shardCount],winner=new Set((m.winnerPlayerIds||[]).map(String));
 s.push(`INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(${esc(m.id)},${esc(tid)},'tennis-europe',${esc(date)},${payload(m)});`);
 s.push(`INSERT INTO schedules(id,tournament_id,match_id,circuit,local_date,payload) VALUES(${esc(`oop:${m.id}`)},${esc(tid)},${esc(m.id)},'tennis-europe',${esc(date)},${payload({date,time:m.time||'',court:m.court||'',event:m.event||'',round:m.round||'',status:m.status,sourceUrl:m.sourceUrl})});`);
 if(m.status==='completed')s.push(`INSERT INTO results(id,tournament_id,match_id,circuit,played_date,payload) VALUES(${esc(`result:${m.id}`)},${esc(tid)},${esc(m.id)},'tennis-europe',${esc(date)},${payload({score:m.score||'',winnerTeamIndex:m.winnerTeamIndex,winnerPlayerIds:m.winnerPlayerIds||[],status:m.status,sourceUrl:m.sourceUrl})});`);
 const teamByPlayer=new Map();(m.teams||[]).forEach((team,teamIndex)=>team.forEach(id=>teamByPlayer.set(String(id),teamIndex)));
 for(let pIndex=0;pIndex<(m.players||[]).length;pIndex++){const p=m.players[pIndex],source=String(p.id||''),team=teamByPlayer.get(source)??(pIndex<2?0:1),key=`${team}:${source}:${pIndex}`;s.push(`INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload) VALUES(${esc(m.id)},${esc(key)},${esc(source)},${esc(p.name)},${esc(norm(p.name))},${esc(p.nationality||'')},${team},${winner.has(source)?1:0},${payload(p)});`)}
}
for(let i=0;i<shards.length;i++)await fs.writeFile(path.join(dir,`03-matches-${String(i).padStart(2,'0')}.sql`),shards[i].join('\n')+'\n');
const counts={historicalMatches:(historical.matches||[]).length,liveMatches:(live.matches||[]).length,matches:matches.length,tournaments:tournaments.length,players:identities.size,completed:matches.filter(x=>x.status==='completed').length,scheduled:matches.filter(x=>x.status==='scheduled').length,participants:matches.reduce((n,x)=>n+(x.players||[]).length,0)};
const fileCount=2+Math.ceil(playerRows.length/playerChunk)+shardCount;
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({status:'green',counts},null,2)+'\n');console.log(JSON.stringify({status:'green',counts,files:fileCount}));
