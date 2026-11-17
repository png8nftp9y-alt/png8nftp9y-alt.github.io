// D1_READ_ONLY: guarded. Native identity index; no scans of raw document chunks.
import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
export async function itfDrawParticipationTournaments(db,players){
 const links=players.flatMap(player=>playerCircuitIdentities(player).filter(p=>p.circuit==='itf'&&/^800\d{6}$/.test(String(p.profileId))).map(p=>({id:String(p.profileId),playerId:player.id||player.canonicalId||player.sourceKey||p.profileId})));
 if(!links.length)return [];
 let rows;
 try{rows=(await db.prepare(`WITH links AS (SELECT json_extract(value,'$.id') AS native_id,json_extract(value,'$.playerId') AS player_id FROM json_each(?))
 SELECT DISTINCT links.player_id,p.source_player_id,p.tournament_id,t.source_tournament_id,t.payload AS tournament_payload
 FROM links CROSS JOIN itf_draw_participations p ON p.source_player_id=links.native_id
 CROSS JOIN itf_draw_documents d ON d.draw_key=p.draw_key AND d.content_sha256=p.content_sha256
 CROSS JOIN tournaments t ON t.id=p.tournament_id AND t.circuit='itf'
 WHERE NOT EXISTS(SELECT 1 FROM itf_draw_documents newer WHERE newer.draw_key=d.draw_key AND (newer.observed_at>d.observed_at OR (newer.observed_at=d.observed_at AND newer.content_sha256>d.content_sha256)))`).bind(JSON.stringify(links)).all()).results||[];}
 catch(error){if(/no such table: itf_draw_participations/.test(String(error)))return [];throw error;}
 return rows.map(row=>{
  const t=JSON.parse(row.tournament_payload||'{}');
  return {...t,id:row.tournament_id,competitionId:t.competitionId||row.source_tournament_id,circuit:'itf',playerId:row.player_id,sourcePlayerId:row.source_player_id,name:t.name||t.tournamentName||row.source_tournament_id,entryStatus:'official_draw',calendarState:'draw_confirmed',drawConfirmed:true,historyEvidence:'acquired_itf_draw_presence',calendarListLabel:'',acceptanceCode:'',acceptancePosition:null};
 });
}
