import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {playerCircuitIdentities,playerNameKey} from './player-circuit-profiles.mjs';
import {personalNativeEvidence} from './player-identity-mapping.mjs';
import {playerNativeIdAuditCtes} from './all-player-id-audit.mjs';
import {storedIdentity} from './player-identity-lookup.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; exact audited reference and already approved native pair.
export const personalId='cw-23cc2accbe35f678d4356dc659753315';
export const sourceKey='acquired|itf|id:800638581';
export const repairKey='confirmedPlayerCircuitLink:pietro-sala-personal-audit-v1';
export const approved=[{circuit:'fitp',officialId:'4537099241'},{circuit:'itf',officialId:'800638581'}];
const nativeKey=x=>x.circuit+'|'+(x.officialId||x.official_id||x.profileId);
const wanted=new Set(approved.map(nativeKey));
export function personalRepairRule(snapshot){
 const confirmed=JSON.parse(snapshot.confirmed?.value||'{}');
 if(confirmed.nameKey!=='PIETRO SALA'||JSON.stringify((confirmed.identities||[]).map(nativeKey).sort())!==JSON.stringify([...wanted].sort()))throw Error('existing_pietro_sala_approval_not_verified');
 if(!snapshot.additions.length||snapshot.additions.some(r=>r.observed_source_key!==sourceKey))throw Error('personal_reference_changed');
 if(!snapshot.oldLinks.length||snapshot.oldLinks.some(r=>r.circuit!=='courtwatch'||r.canonical_id!==personalId||r.source_key!=='courtwatch|'+personalId))throw Error('personal_canonical_has_other_sources');
 if(!snapshot.oldNative.length||snapshot.oldNative.some(r=>!wanted.has(nativeKey(r))))throw Error('personal_native_evidence_conflicts');
 const targetNative=new Set(snapshot.targetNative.map(nativeKey));
 if([...wanted].some(k=>!targetNative.has(k))||snapshot.targetNative.some(r=>!wanted.has(nativeKey(r))))throw Error('target_native_evidence_conflicts');
 for(const r of snapshot.additions){
  const p=JSON.parse(r.payload),ids=personalNativeEvidence(p);
  if(playerNameKey(p.name)!=='PIETRO SALA'||!ids.length||ids.some(x=>!wanted.has(nativeKey(x)))||(p.birthYear||p.birthDate||p.dateOfBirth)&&Number(p.birthYear||String(p.birthDate||p.dateOfBirth).slice(0,4))!==2009)throw Error('personal_payload_evidence_conflicts');
 }
 return {nameKey:'PIETRO SALA',birthYear:2009,identities:approved,courtwatchIds:[personalId],reason:'Repair exact personal reference identified by daily audit 39670420597; existing approved native IDs required'};
}
export async function repairPersonalAuditReference(query,{onEvidence=()=>{}}={}){
 const db={prepare(sql){return {bind(...values){let i=0;return {all:async()=>({results:await query(sql.replace(/\?/g,()=>sqlString(values[i++])) )})}}}}};
 const previous=await query('SELECT key,value FROM app_state WHERE key='+sqlString(repairKey));
 if(previous.length){
  const r=JSON.parse(previous[0].value);
  if(r.courtwatchIds?.length!==1||r.courtwatchIds[0]!==personalId||JSON.stringify(r.identities)!==JSON.stringify(approved))throw Error('personal_repair_checkpoint_changed');
  const a=await storedIdentity(db,personalId),b=await storedIdentity(db,sourceKey);
  if(a&&b&&a.canonicalId===b.canonicalId)return {status:'already_verified',writes:0,canonicalId:a.canonicalId};
 }
 const additions=await query('SELECT courtwatch_id,observed_source_key,payload FROM user_app_player_additions WHERE courtwatch_id='+sqlString(personalId));
 const oldLinks=await query('SELECT source_key,canonical_id,circuit,official_id FROM player_circuit_identities WHERE canonical_id='+sqlString(personalId));
 const target=await query('SELECT canonical_id FROM player_circuit_identities WHERE source_key='+sqlString(sourceKey));
 if(target.length!==1)throw Error('personal_reference_target_missing');
 const native=await query(playerNativeIdAuditCtes+' SELECT DISTINCT canonical_id,circuit,official_id FROM native WHERE canonical_id IN ('+[personalId,target[0].canonical_id].map(sqlString).join(',')+')');
 const confirmed=(await query("SELECT value FROM app_state WHERE key='confirmedPlayerCircuitLink:pietro-sala-decimomannu'"))[0];
 const snapshot={confirmed,additions,oldLinks,oldNative:native.filter(r=>r.canonical_id===personalId),targetNative:native.filter(r=>r.canonical_id===target[0].canonical_id)};
 onEvidence({...snapshot,additions:additions.map(r=>{const p=JSON.parse(r.payload);return {courtwatchId:r.courtwatch_id,sourceKey:r.observed_source_key,name:p.name,birthYear:p.birthYear,nativeIds:playerCircuitIdentities(p)}})});
 const rule=personalRepairRule(snapshot),incoming={key:repairKey,value:JSON.stringify(rule)};
 if(previous.length&&previous[0].value!==incoming.value)throw Error('personal_repair_checkpoint_changed');
 const plan=buildIncrementalSyncPlan({current:previous,incoming:[incoming],keyOf:r=>r.key,sourceComplete:true});
 // Requeue only these approved native sources and this personal ID. All reads
 // and writes stay within the existing serialized D1 writer job.
 const queue=`INSERT INTO player_identity_pending_sources(source_table,source_key,revision)
 SELECT 'user_app_player_additions',courtwatch_id,1 FROM user_app_player_additions WHERE courtwatch_id=${sqlString(personalId)} GROUP BY courtwatch_id
 UNION SELECT 'observed_players',source_key,1 FROM observed_players WHERE (circuit='fitp' AND official_id='4537099241') OR (circuit='itf' AND official_id='800638581')
 UNION SELECT 'search_acquired_players',source_key,1 FROM search_acquired_players WHERE (circuit='fitp' AND official_id='4537099241') OR (circuit='itf' AND official_id='800638581')
 ON CONFLICT(source_table,source_key) DO NOTHING;`;
 await query((plan.writes?`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(repairKey)},${sqlString(incoming.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;\n`:'')+queue);
 const pendingSources=await query(`SELECT 'user_app_player_additions' AS source_table,courtwatch_id AS source_key FROM user_app_player_additions WHERE courtwatch_id=${sqlString(personalId)} GROUP BY courtwatch_id
 UNION SELECT 'observed_players',source_key FROM observed_players WHERE (circuit='fitp' AND official_id='4537099241') OR (circuit='itf' AND official_id='800638581')
 UNION SELECT 'search_acquired_players',source_key FROM search_acquired_players WHERE (circuit='fitp' AND official_id='4537099241') OR (circuit='itf' AND official_id='800638581')`);
 const mapping=await syncPlayerIdentities(query,{pendingSources});
 const a=await storedIdentity(db,personalId),b=await storedIdentity(db,sourceKey);
 if(!a||!b||a.canonicalId!==b.canonicalId)throw Error('personal_repair_readback_failed');
 return {status:'verified_personal_reference',canonicalId:a.canonicalId,mapping};
}
