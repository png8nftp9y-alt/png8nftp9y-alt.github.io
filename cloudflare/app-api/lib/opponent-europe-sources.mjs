import {verifiedParticipantAliases} from './personal-tennis-europe-history.mjs';
import {normalizePlayerName} from './player-circuit-profiles.mjs';
import {tennisEuropeNativeId} from './opponent-linked-identity.mjs';

export async function opponentEuropeSources(db,{profileId,name,identity,asOf,excludeMatchId=''}) {
 const native=tennisEuropeNativeId(profileId),normalized=normalizePlayerName(name).toLowerCase();
 const names=[normalized,normalizePlayerName(identity?.name).toLowerCase()].filter(Boolean),variants=[...new Set(names.flatMap(n=>[n,n.split(' ').reverse().join(' ')]))];
 const aliases=native?await verifiedParticipantAliases(db,identity||{name,sourceCircuit:'tennis-europe',sourcePlayerId:native},'tennis-europe',native,variants):new Set();
 if(!native&&!variants.length)return{rows:[],native,aliases};
 const ids=native?[...new Set([native,native.toUpperCase()])]:[];
 const aliasMatches=[...new Set([...aliases].map(key=>JSON.parse(key)[0]))];
 const candidateSql=native
  ? `SELECT match_id FROM match_participants WHERE source_player_id IN (${ids.map(()=>'?').join(',')}) UNION SELECT value AS match_id FROM json_each(?)`
  : `SELECT DISTINCT match_id FROM match_participants WHERE normalized_name IN (${variants.map(()=>'?').join(',')})`;
 const values=native?[...ids,JSON.stringify(aliasMatches)]:variants;
 const sql=`WITH candidate_matches AS MATERIALIZED (${candidateSql}) SELECT m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id,t.start_date AS tournament_start_date,t.end_date AS tournament_end_date FROM candidate_matches ids CROSS JOIN matches m ON m.id=ids.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit='tennis-europe' AND m.played_date<=? AND m.id<>? ORDER BY m.played_date DESC,m.id LIMIT 250`;
 try{return{rows:(await db.prepare(sql).bind(...values,asOf,excludeMatchId).all()).results||[],native,aliases};}
 catch(error){if(/no such table/i.test(String(error?.message)))return{rows:[],native,aliases};throw error;}
}

export function opponentSelfParticipant(participant,{native,aliases},name) {
 if(native)return String(participant.source_player_id||'').toLowerCase()===native||aliases.has(JSON.stringify([participant.match_id,participant.participant_key]));
 return normalizePlayerName(participant.normalized_name||participant.display_name).split(' ').sort().join(' ')===normalizePlayerName(name).split(' ').sort().join(' ');
}
