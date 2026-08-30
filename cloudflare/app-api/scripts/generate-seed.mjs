import fs from 'node:fs/promises';
const base='../../dist/v3/universal',out='seed-universal.sql';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [manifest,players,tournaments,entries,schedules,matches,results,legacy,mapDoc,playerConfig,observed]=await Promise.all([
  ...['manifest','players','tournaments','entries','schedules','matches','results'].map(name=>read(`${base}/${name}.json`)),
  read('../../data.json'),read('../../dist/v3/tournaments.json'),read('../../players.json'),read('observed-players.json'),
]);
const esc=value=>`'${String(value??'').replaceAll("'","''")}'`,payload=row=>esc(JSON.stringify(row));
const circuit=row=>{const s=String(row.circuit||row.sourceId||row.sourceName||'').toLowerCase();return s.includes('tennis-europe')||s.includes('tennis europe')?'tennis-europe':s.includes('itf')?'itf':'fitp'};
const sql=['PRAGMA foreign_keys=ON;','DELETE FROM observed_players;','DELETE FROM app_matches;','DELETE FROM app_tournaments;','DELETE FROM app_players;','DELETE FROM results;','DELETE FROM matches;','DELETE FROM schedules;','DELETE FROM entries;','DELETE FROM tournaments;','DELETE FROM players;'];
for(const r of observed.players||[])sql.push(`INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,monitored,observations,first_observed_at,last_observed_at,payload) VALUES(${esc(r.sourceKey)},${esc(r.circuit)},${esc(r.officialId)},${esc(r.normalizedName)},${esc(r.displayName)},${r.monitored?1:0},${Number(r.observations)||1},${esc(r.firstObservedAt)},${esc(r.lastObservedAt)},${payload(r)});`);
for(const r of players.players||[])sql.push(`INSERT INTO players(id,courtwatch_id,display_name,active,payload) VALUES(${esc(r.id)},${esc(r.courtwatchId)},${esc(r.displayName)},${r.active===false?0:1},${payload(r)});`);
for(const r of tournaments.tournaments||[])sql.push(`INSERT INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) VALUES(${esc(r.id)},${esc(r.circuit)},${esc(r.sourceTournamentId)},${esc(r.startDate)},${esc(r.endDate)},${payload(r)});`);
for(const r of entries.entries||[])sql.push(`INSERT INTO entries(id,tournament_id,player_id,circuit,state,payload) VALUES(${esc(r.id)},${esc(r.tournamentId)},${esc(r.playerId)},${esc(r.circuit)},${esc(r.state)},${payload(r)});`);
for(const r of schedules.schedules||[])sql.push(`INSERT INTO schedules(id,tournament_id,match_id,circuit,local_date,payload) VALUES(${esc(r.id)},${esc(r.tournamentId)},${esc(r.matchId)},${esc(r.circuit)},${esc(r.localDate)},${payload(r)});`);
for(const r of matches.matches||[])sql.push(`INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(${esc(r.id)},${esc(r.tournamentId)},${esc(r.circuit)},${esc(r.playedDate)},${payload(r)});`);
for(const r of results.results||[])sql.push(`INSERT INTO results(id,tournament_id,match_id,circuit,played_date,payload) VALUES(${esc(r.id)},${esc(r.tournamentId)},${esc(r.matchId)},${esc(r.circuit)},${esc(r.playedDate)},${payload(r)});`);
const configPlayers=[...new Map((playerConfig.players||[]).map(p=>[p.id,p])).values()],allowed=new Set(configPlayers.map(p=>p.id)),legacyById=new Map((legacy.players||[]).map(p=>[p.id,p]));
const appPlayers=configPlayers.map(p=>({...p,...(legacyById.get(p.id)||{})}));
const appTournaments=(mapDoc.tournaments||[]).filter(row=>allowed.has(row.playerId));
const appMatches=[];
appPlayers.forEach((r,i)=>sql.push(`INSERT INTO app_players(seq,id,payload) VALUES(${i+1},${esc(r.id)},${payload(r)});`));
appTournaments.forEach((r,i)=>sql.push(`INSERT INTO app_tournaments(seq,player_id,competition_id,circuit,payload) VALUES(${i+1},${esc(r.playerId)},${esc(r.competitionId)},${esc(circuit(r))},${payload(r)});`));
appMatches.forEach((r,i)=>sql.push(`INSERT INTO app_matches(seq,player_id,competition_id,match_date,payload) VALUES(${i+1},${esc(r.playerId)},${esc(r.competitionId)},${esc(r.date)},${payload(r)});`));
const counts={...manifest.counts,observedPlayers:(observed.players||[]).length,observedByCircuit:observed.counts||{},observedSources:observed.sources||{},appPlayers:appPlayers.length,appTournaments:appTournaments.length,appMatches:appMatches.length};
sql.push(`INSERT OR REPLACE INTO generations(id,generated_at,schema_version,status,counts_json) VALUES('current',${esc(manifest.generatedAt)},${esc(manifest.version)},'green',${esc(JSON.stringify(counts))});`);
await fs.writeFile(out,sql.join('\n')+'\n');console.log(JSON.stringify({output:out,counts}));
