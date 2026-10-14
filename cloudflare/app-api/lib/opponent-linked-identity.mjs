import {storedIdentity} from './player-identity-lookup.mjs';

export const tennisEuropeNativeId=value=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(value||''))?String(value).toLowerCase():'';

// Canonical/source keys and official IDs resolve the same established person.
// Native lookups seek (circuit,official_id); they do not search a person's name.
export async function linkedOpponentIdentity(db,identity) {
 const known=await storedIdentity(db,identity);
 if(known)return known;
 const id=String(identity||''),circuits=tennisEuropeNativeId(id)?['tennis-europe']:[...(/^\d{6,12}$/.test(id)?['fitp']:[]),...(/^800\d{6}$/.test(id)?['itf']:[])];
 if(!circuits.length)return null;
 const ids=[...new Set([id,id.toLowerCase(),id.toUpperCase()])];
 let rows;
 try {rows=(await db.prepare(`SELECT DISTINCT p.canonical_id,p.payload FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id JOIN player_identity_people p ON p.canonical_id=COALESCE(a.canonical_id,l.canonical_id) WHERE l.circuit IN (${circuits.map(()=>'?').join(',')}) AND l.official_id IN (${ids.map(()=>'?').join(',')}) LIMIT 2`).bind(...circuits,...ids).all()).results||[];}
 catch(error){if(/no such table/i.test(String(error?.message)))return null;throw error;}
 if(rows.length!==1)return null;
 try{return JSON.parse(rows[0].payload);}catch{return null;}
}
