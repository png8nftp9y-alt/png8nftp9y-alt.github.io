// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan receives the retained aliases as unchanged rows.
import {validOfficialId} from './player-profile-evidence.mjs';
export function retainedNativeNameAliases(current,incoming,{sourceComplete=false}={}){
 if(!sourceComplete)throw Error('Opponent entry source incomplete: refusing alias migration');
 const nativeNames=new Set(incoming.filter(r=>r.circuit==='tennis-europe'&&validOfficialId(r.circuit,r.sourcePlayerId)).map(r=>r.normalizedName));
 const desired=new Set(incoming.map(r=>r.circuit+'|'+r.sourcePlayerId));
 return current.filter(r=>r.circuit==='tennis-europe'&&String(r.source_player_id).startsWith('name:')&&!desired.has(r.circuit+'|'+r.source_player_id)&&nativeNames.has(r.normalized_name));
}
export function selectOpponentEntryProfiles(rows,profileId=''){
 const groups=new Map();for(const row of rows){const group=groups.get(row.circuit)||[];group.push(row);groups.set(row.circuit,group)}
 const selected=[];
 for(const [circuit,group]of groups){const equal=(a,b)=>circuit==='tennis-europe'?String(a).toLowerCase()===String(b).toLowerCase():String(a)===String(b);
  const exact=profileId&&group.find(row=>equal(row.source_player_id,profileId));
  if(exact){selected.push(exact);continue}
  const native=group.filter(row=>validOfficialId(circuit,row.source_player_id));
  const candidates=native.length?native:group;
  if(candidates.length===1)selected.push(candidates[0]);
 }
 return selected;
}
