import {playerNameKey} from './player-circuit-profiles.mjs';
import {matchingNation} from './archived-profile-evidence.mjs';
import {profileEvidence,validOfficialId} from './player-profile-evidence.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; preflight SELECTs only, no database writes.
// buildIncrementalSyncPlan remains in the importer after this validation.
const parse=p=>{try{return typeof p==='string'?JSON.parse(p||'{}'):p||{}}catch{throw Error('player_circuit_source_incomplete')}};
const excluded=r=>r.circuit==='tennis-europe'&&r.source_key==='tennis-europe|name:MOEZ BEN AMOR';
const evidence=r=>profileEvidence(r.circuit,{...parse(r.payload),name:r.display_name,officialId:r.official_id});
const compatible=(r,p)=>{
 const own=parse(r.payload),prior=parse(p.payload),nation=matchingNation(r.circuit,own.nationality||own.countryCode),other=matchingNation(r.circuit,prior.nationality||prior.countryCode);
 return (!r.display_name||!p.display_name||playerNameKey(r.display_name)===playerNameKey(p.display_name))
 &&(!own.birthYear||!prior.birthYear||Number(own.birthYear)===Number(prior.birthYear))
 &&(!nation||!other||nation===other||nation===matchingNation(r.circuit,prior.historicalNationality));
};
const complete=(r,e)=>({...r,official_id:e.officialId,payload:{...parse(r.payload),officialId:e.officialId,...(e.profileUrl?{profileUrl:e.profileUrl}:{}),...(e.nationality?{nationality:e.nationality}:{}),...(e.historicalNationality?{historicalNationality:e.historicalNationality}:{}),...(e.profileEvidenceProvenance?{profileEvidenceProvenance:e.profileEvidenceProvenance}:{})}});
function incomplete(rows){const counts={fitp:0,'tennis-europe':0,itf:0};for(const r of rows)counts[r.circuit]++;return Error('player_circuit_id_required:'+JSON.stringify(counts));}
export async function requirePlayerCircuitIds(query,incoming,{recoverMissing}={}){
 const rows=[],missing=[];let excludedRecords=0,recovered=0;
 for(const r of incoming){
  if(excluded(r)){excludedRecords++;continue;}
  if(!r.source_key||!['fitp','tennis-europe','itf'].includes(r.circuit))throw Error('player_circuit_source_incomplete');
  const e=evidence(r);
  if(e&&validOfficialId(r.circuit,e.officialId))rows.push(validOfficialId(r.circuit,r.official_id)?{...r,payload:parse(r.payload)}:complete(r,e));
  else if(validOfficialId(r.circuit,r.official_id))throw incomplete([r]); // Conflicting explicit URL/ID cannot borrow a different ID.
  else missing.push(r);
 }
 const known=new Map();
 for(let i=0;i<missing.length;i+=40){const keys=missing.slice(i,i+40).map(r=>sqlString(r.source_key)).join(',');
  const found=await query(`SELECT source_key,circuit,official_id,display_name,payload FROM observed_players WHERE source_key IN (${keys})
   UNION ALL SELECT source_key,circuit,official_id,display_name,json_object('profileUrl',profile_url,'nationality',nationality,'birthYear',birth_year) AS payload FROM player_circuit_identities WHERE source_key IN (${keys})`);
  for(const r of found){const list=known.get(r.source_key)||[];list.push(r);known.set(r.source_key,list);}
 }
 const unresolved=[];
 for(const r of missing){const candidates=(known.get(r.source_key)||[]).filter(p=>p.circuit===r.circuit&&compatible(r,p)).map(evidence).filter(e=>e&&validOfficialId(r.circuit,e.officialId));
  const ids=new Set(candidates.map(e=>e.officialId.toLowerCase()));if(ids.size>1)throw incomplete([r]);
  if(ids.size===1){rows.push(complete(r,candidates[0]));recovered++;}else unresolved.push(r);
 }
 const recoveredOnline=unresolved.length&&recoverMissing?await recoverMissing(unresolved):new Map();
 const failed=[];
 for(const r of unresolved){const e=recoveredOnline.get(r.source_key),verified=e?evidence({...r,official_id:e.officialId,payload:{...parse(r.payload),...e}}):null;
  if(verified&&validOfficialId(r.circuit,verified.officialId)){rows.push(complete(r,verified));recovered++;}else failed.push(r);
 }
 if(failed.length)throw incomplete(failed);
 return{rows:rows.sort((a,b)=>a.source_key.localeCompare(b.source_key)),recovered,excludedRecords};
}
