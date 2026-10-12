import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
export async function exactPersonalEntryProfiles(db,players){
 const links=players.flatMap(player=>playerCircuitIdentities(player).map(link=>({...link,playerId:player.id})));
 const result=new Map();if(!links.length)return result;
 for(const player of players)if(links.some(l=>l.playerId===player.id))result.set(player.id,[]);
 let rows;try{rows=(await db.prepare(`WITH links AS (SELECT json_extract(value,'$.profileId') AS native_id,json_extract(value,'$.circuit') AS circuit,json_extract(value,'$.playerId') AS player_id FROM json_each(?))
 SELECT links.player_id,p.circuit,p.source_player_id,p.normalized_name,p.payload FROM links JOIN opponent_entry_profiles p ON p.circuit=links.circuit AND p.source_player_id=links.native_id WHERE links.circuit<>'tennis-europe'
 UNION ALL SELECT links.player_id,p.circuit,p.source_player_id,p.normalized_name,p.payload FROM links JOIN opponent_entry_profiles p ON p.circuit=links.circuit AND p.source_player_id=links.native_id COLLATE NOCASE WHERE links.circuit='tennis-europe'`).bind(JSON.stringify(links)).all()).results||[];}catch(error){if(/no such table/i.test(error.message))return result;throw error;}
 for(const row of rows)result.get(row.player_id)?.push(row);
 return result;
}
