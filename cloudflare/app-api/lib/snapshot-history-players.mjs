import {storedIdentities} from './player-identity-lookup.mjs';
import {playerCircuitIdentities} from './player-circuit-profiles.mjs';

// Extend the existing personal flow to configured ITF players, scoped to membership.
// Never infer an ITF identity from a matching name.
export async function snapshotHistoryPlayers(db,players,personal){
 const personalIds=new Set(personal.map(p=>p.id));
 const configured=players.filter(p=>!personalIds.has(p.id));
 const keys=configured.flatMap(p=>[p.id,'courtwatch|'+p.id]);
 const stored=keys.length?await storedIdentities(db,keys):new Map();
 const itf=[];
 for(const player of configured){
  const people=[stored.get(player.id),stored.get('courtwatch|'+player.id)].filter(Boolean);
  if(new Set(people.map(p=>p.canonicalId)).size>1)continue;
  const own=playerCircuitIdentities(player).find(l=>l.circuit==='itf');
  const person=people[0],linked=person&&playerCircuitIdentities(person).find(l=>l.circuit==='itf');
  if(own&&linked&&own.profileId!==linked.profileId)continue;
  const native=linked?.profileId||own?.profileId;
  if(!native)continue;
  itf.push({...player,worldTennisId:native,...(person?.canonicalId?{canonicalId:person.canonicalId}:{})});
 }
 return {players:[...personal,...itf],configuredIds:new Set(itf.map(p=>p.id))};
}

export function snapshotEntryPlayer(player,configuredIds){
 return configuredIds.has(player.id)
  ? {id:player.id,name:player.name,sourceCircuit:'itf',sourcePlayerId:player.worldTennisId}
  : player;
}
