import {participantSourceKey} from './personal-tennis-europe-history.mjs';
import {storedIdentities} from './player-identity-lookup.mjs';
import {normalizePlayerName,playerNameKey,playerCircuitIdentities} from './player-circuit-profiles.mjs';

// A draw-local number is scoped to its participant evidence, never a global ID.
// Reuse the same acquired source-key algorithm used by verified history aliases.
export async function localEuropeOpponentIdentity(db,{profileId='',name=''}={}) {
 const id=String(profileId),normalized=normalizePlayerName(name);
 if(!/^\d{1,5}$/.test(id)||!normalized)return null;
 const names=[...new Set([normalized,normalized.toLowerCase(),normalized.split(' ').reverse().join(' '),normalized.split(' ').reverse().join(' ').toLowerCase()])];
 let rows;
 try{rows=(await db.prepare(`SELECT p.match_id,p.participant_key,p.source_player_id,p.display_name,p.normalized_name,p.nationality,p.payload FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id WHERE p.source_player_id=? AND p.normalized_name IN (${names.map(()=>'?').join(',')}) AND m.circuit='tennis-europe' LIMIT 251`).bind(id,...names).all()).results||[];}
 catch(error){if(/no such table/i.test(String(error?.message)))return null;throw error;}
 if(!rows.length||rows.length>250)return null;
 const exact=rows.filter(p=>playerNameKey(p.display_name)===playerNameKey(name));
 if(!exact.length)return null;
 const keys=await Promise.all(exact.map(p=>participantSourceKey('tennis-europe',p)));
 const mapped=await storedIdentities(db,keys),people=new Map();
 for(const key of keys){const person=mapped.get(key);if(!person?.canonicalId||playerNameKey(person.name)!==playerNameKey(name))return null;people.set(person.canonicalId,person);}
 if(people.size!==1)return null;
 const person=[...people.values()][0],native=playerCircuitIdentities(person).find(p=>p.circuit==='tennis-europe')?.profileId;
 return native?{...person,sourceCircuit:'tennis-europe',sourcePlayerId:native}:null;
}
