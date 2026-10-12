import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
export async function personalUnreleasedTournamentHistory(db,players){
 const links=players.flatMap(player=>playerCircuitIdentities(player).filter(link=>['itf','fitp'].includes(link.circuit)).map(link=>({...link,playerId:player.id})));
 if(!links.length)return [];
 const rows=(await db.prepare(`WITH links AS (SELECT json_extract(value,'$.profileId') AS native_id,json_extract(value,'$.circuit') AS circuit,json_extract(value,'$.playerId') AS player_id FROM json_each(?))
 SELECT DISTINCT links.player_id,links.circuit,m.tournament_id,t.source_tournament_id,t.payload AS tournament_payload FROM links JOIN match_participants p ON p.source_player_id=links.native_id JOIN matches m ON m.id=p.match_id AND m.circuit=links.circuit JOIN tournaments t ON t.id=m.tournament_id`).bind(JSON.stringify(links)).all()).results||[];
 return rows.map(row=>{let t={};try{t=JSON.parse(row.tournament_payload||'{}')}catch{}return {...t,id:row.tournament_id,competitionId:t.competitionId||row.source_tournament_id,circuit:row.circuit,playerId:row.player_id,name:t.name||t.tournamentName||row.source_tournament_id,calendarState:'draw_confirmed',entryStatus:'official_draw',calendarListLabel:''}});
}
