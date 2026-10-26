import {playerFederationMatchKey} from './player-nationality.mjs';
// Recover only from sources of the same established identity, never a name match.
export async function enrichIdentityNationalities(db,players){
 for(const p of players)if(!p.nationality)p.nationality=p.nationalityCode||p.countryCode||p.country||'';
 const pending=players.filter(p=>!(p.nationality||p.nationalityCode||p.countryCode||p.country)&&p.canonicalId);
 for(let offset=0;offset<pending.length;offset+=60){
  const batch=pending.slice(offset,offset+60),ids=[...new Set(batch.map(p=>p.canonicalId))];
  let rows;
  try{rows=(await db.prepare(`SELECT canonical_id,circuit,nationality FROM player_circuit_identities WHERE canonical_id IN (${ids.map(()=>'?').join(',')}) AND nationality<>''`).bind(...ids).all()).results||[];}
  catch(e){if(/no such table/i.test(String(e?.message)))continue;throw e;}
  for(const person of batch){
   const nations=new Map();
   for(const row of rows.filter(r=>r.canonical_id===person.canonicalId)){
    const key=playerFederationMatchKey(row.circuit,row.nationality);
    if(key)nations.set(key,row.nationality);
   }
   if(nations.size===1)person.nationality=[...nations.values()][0];
  }
 }
 return players;
}
