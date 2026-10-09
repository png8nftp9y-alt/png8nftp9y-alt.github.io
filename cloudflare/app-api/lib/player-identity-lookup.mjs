const optional=async(db,sql,values=[])=>{try{return(await db.prepare(sql).bind(...values).all()).results||[]}catch(e){if(/no such table/i.test(e.message))return[];throw e}};
export async function identityMapReady(db){const rows=await optional(db,"SELECT status FROM player_identity_sync WHERE id='current' AND status IN ('ready','pending') AND EXISTS(SELECT 1 FROM player_identity_people LIMIT 1)");return rows.length===1;}
export async function storedIdentity(db,identity){
 if(!identity)return null;
 const rows=await optional(db,'SELECT p.payload FROM player_identity_people p WHERE p.canonical_id IN (SELECT canonical_id FROM player_identity_people WHERE canonical_id=? UNION SELECT canonical_id FROM player_circuit_identities WHERE source_key=? UNION SELECT canonical_id FROM player_identity_aliases WHERE alias_id=?) AND EXISTS(SELECT 1 FROM player_circuit_identities live WHERE live.canonical_id=p.canonical_id) LIMIT 2',[identity,identity,identity]);
 if(rows.length!==1)return null;try{return JSON.parse(rows[0].payload)}catch{return null}
}
export async function mappedPlayerSearch(db,{tokens,seek,pageSize,encode,userId}){
 if(!await identityMapReady(db))return null;
 const where=tokens.map(()=>"p.name_key LIKE ?").join(' AND ')+(seek?' AND (p.name_key>? OR (p.name_key=? AND p.canonical_id>?))':'');
 const rows=await optional(db,`SELECT p.payload,p.name_key AS normalized_name,p.canonical_id AS cursor_key FROM player_identity_people p WHERE ${where} AND EXISTS(SELECT 1 FROM player_circuit_identities l WHERE l.canonical_id=p.canonical_id) ORDER BY p.name_key,p.canonical_id LIMIT ${pageSize+1}`,[...tokens.map(t=>'%'+t+'%'),...(seek?[seek.n,seek.n,seek.k]:[])]);
 const linked=userId?await optional(db,'SELECT a.canonical_id,u.courtwatch_id FROM user_app_players u JOIN player_identity_aliases a ON a.alias_id=u.courtwatch_id WHERE u.user_id=? AND NOT EXISTS(SELECT 1 FROM user_app_player_removals r WHERE r.user_id=u.user_id AND r.courtwatch_id=u.courtwatch_id)',[userId]):[],ids=new Map(linked.map(r=>[r.canonical_id,r.courtwatch_id]));
 const page=rows.slice(0,pageSize);return{results:page.map(r=>{const p=JSON.parse(r.payload);return{...p,courtwatchId:ids.get(p.canonicalId)||''}}),nextCursor:rows.length>pageSize?encode(page.at(-1)):null};
}
export async function mappedPlayerId(db,sourceKey,userId){const person=await storedIdentity(db,sourceKey);if(!person)return null;const own=await optional(db,'SELECT u.courtwatch_id FROM user_app_players u JOIN player_identity_aliases a ON a.alias_id=u.courtwatch_id WHERE u.user_id=? AND a.canonical_id=? ORDER BY u.created_at,u.courtwatch_id LIMIT 1',[userId,person.canonicalId]);return{canonicalId:person.canonicalId,playerId:own[0]?.courtwatch_id||person.canonicalId};}
export async function mappedProfiles(db,players){
 const result=new Map();
 // Established source mappings remain usable while unrelated new evidence is queued.
 for(let offset=0;offset<players.length;offset+=100){const batch=players.slice(offset,offset+100),keys=[...new Set(batch.flatMap(p=>[p.id,p.sourceKey]).filter(Boolean))];if(!keys.length)continue;
  const rows=await optional(db,`WITH requested AS (SELECT value AS lookup_key FROM json_each(?)),resolved AS (
   SELECT k.lookup_key,l.canonical_id FROM requested k JOIN player_circuit_identities l ON l.source_key=k.lookup_key
   UNION SELECT k.lookup_key,a.canonical_id FROM requested k JOIN player_identity_aliases a ON a.alias_id=k.lookup_key
   UNION SELECT k.lookup_key,p.canonical_id FROM requested k JOIN player_identity_people p ON p.canonical_id=k.lookup_key
  ) SELECT r.lookup_key,p.canonical_id,p.payload FROM resolved r JOIN player_identity_people p ON p.canonical_id=r.canonical_id
  WHERE EXISTS(SELECT 1 FROM player_circuit_identities live WHERE live.canonical_id=p.canonical_id)`,[JSON.stringify(keys)]);
  const byKey=new Map();for(const r of rows){let p;try{p=JSON.parse(r.payload)}catch{continue}const persons=byKey.get(r.lookup_key)||new Map();persons.set(r.canonical_id,p);byKey.set(r.lookup_key,persons);}
  for(const player of batch){const persons=new Map();for(const key of [player.sourceKey,player.id])for(const [id,p]of byKey.get(key)||[])persons.set(id,p);if(persons.size===1)result.set(player,[...persons.values()][0].circuitProfiles||[]);}
 }
 return result;
}
