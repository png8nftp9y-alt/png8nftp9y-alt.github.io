import {playerCircuitIdentities} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
// One indexed, bounded SELECT for observed native IDs; never scans document payloads or writes D1.
export async function readObservedEuropeEvidence(db,players) {
 const links=players.flatMap(p=>playerCircuitIdentities(p).filter(i=>i.circuit==='tennis-europe').flatMap(i=>
  [...new Set([i.profileId.toLowerCase(),i.profileId.toUpperCase()])].map(nativeId=>({playerId:p.id,nativeId}))));
 if(!links.length)return [];
 const result=await db.prepare(`WITH links AS (SELECT json_extract(value,'$.playerId') player_id,json_extract(value,'$.nativeId') native_id FROM json_each(?))
 SELECT DISTINCT links.player_id,t.source_tournament_id,t.payload AS tournament_payload
 FROM links CROSS JOIN match_participants p ON p.source_player_id=links.native_id
 CROSS JOIN matches m ON m.id=p.match_id AND m.circuit='tennis-europe'
 CROSS JOIN tournaments t ON t.id=m.tournament_id LIMIT 10001`).bind(JSON.stringify(links)).all();
 const rows=result.results || [];if(rows.length>=10001)throw Error('europe_draw_evidence_limit_exceeded');
 return rows.map(r=>{const t=JSON.parse(r.tournament_payload || '{}');const competitionId=t.competitionId || r.source_tournament_id;
  if(!competitionId)throw Error('europe_draw_competition_unresolved');
  return {playerId:r.player_id,circuit:'tennis-europe',competitionId,name:t.name || t.tournamentName || competitionId,
   drawConfirmed:true,calendarState:'draw_confirmed',entryStatus:'official_draw',evidence:'indexed_native_match_participation'};});
}
