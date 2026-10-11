import {saveAcceptanceImportDiagnostics} from '../lib/acceptance-import-diagnostics.mjs';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
import {requirePlayerCircuitIds} from '../lib/required-player-circuit-id.mjs';
import {acceptanceNativeIdRecovery} from '../lib/acceptance-native-id-recovery.mjs';
import {syncPlayerIdentities} from './sync-player-identities.mjs';
// D1_WRITE_POLICY: incremental
const participantName=p=>p.name||p.playerName||p.full1||p.full2||[p.firstName,p.lastName].filter(Boolean).join(' ');
export function acceptancePlayers(circuit, doc, knownFitpNames = new Map()) {
 if(!['fitp','tennis-europe','itf'].includes(circuit))throw Error('acceptance_circuit_invalid');
 if(!doc||typeof doc!=='object'||(circuit==='itf'?!Array.isArray(doc.participants):!doc.tournaments||typeof doc.tournaments!=='object'))throw Error('acceptance_source_incomplete');
 const participants=circuit==='itf'?doc.participants:Object.values(doc.tournaments).flatMap(t=>{if(!Array.isArray(t.participants))throw Error('acceptance_source_incomplete');return t.participants});
 if(!participants.length)throw Error('acceptance_source_incomplete');
 const rows=new Map();
 for(const p of participants){
  let row=acquiredPlayer(circuit,{...p,name:participantName(p)});
  if(!row&&circuit==='fitp'&&knownFitpNames.has(String(p.membershipCard||'')))row=acquiredPlayer(circuit,{...p,name:knownFitpNames.get(String(p.membershipCard))});
  if(!row)throw Error('acceptance_source_incomplete');
  // Reuse the established observed key for native IDs; unidentified names retain country/year distinctions.
  const source_key=row.officialId?circuit+'|id:'+row.officialId:'acceptance|'+row.sourceKey;
  if(!rows.has(source_key))rows.set(source_key,{source_key,circuit,official_id:row.officialId,normalized_name:row.normalizedName,display_name:row.displayName,payload:row.payload});
 }
 return [...rows.values()].sort((a,b)=>a.source_key.localeCompare(b.source_key));
}
async function importAcceptanceProfiles(query,circuit,doc,options,context) {
 const knownFitpNames=new Map();
 if(circuit==='fitp'&&doc?.tournaments&&typeof doc.tournaments==='object'){
  for(const t of Object.values(doc.tournaments)){
   if(!Array.isArray(t?.participants))throw Error('acceptance_source_incomplete');
   for(const p of t.participants){
    if(!p||typeof p!=='object')throw Error('acceptance_source_incomplete');
    if(acquiredPlayer(circuit,{...p,name:participantName(p)}))continue;
    const card=String(p.membershipCard||'');
    if(!/^\d{6,12}$/.test(card))throw Error('acceptance_source_incomplete');
    if(knownFitpNames.has(card))continue;
    const found=await query("SELECT display_name FROM observed_players WHERE circuit='fitp' AND official_id="+sqlString(card)+" UNION ALL SELECT display_name FROM search_acquired_players WHERE circuit='fitp' AND official_id="+sqlString(card));
    const names=found.map(r=>acquiredPlayer('fitp',{name:r.display_name,membershipCard:card})).filter(Boolean);
    const keys=new Set(names.map(r=>r.normalizedName.split(' ').sort().join(' ')));
    if(keys.size!==1)throw Error('acceptance_fitp_existing_name_missing_or_ambiguous');
    knownFitpNames.set(card,names[0].displayName);
   }
  }
 }
 context.rows=acceptancePlayers(circuit,doc,knownFitpNames);
 const required=await requirePlayerCircuitIds(query,context.rows,options);
 context.rows=required.rows;
 const rows=required.rows,hash=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),key='acceptanceProfiles:'+circuit;
 const checkpoint=(await query('SELECT value FROM app_state WHERE key='+sqlString(key)))[0];
 let changed=0;
 if(checkpoint?.value!==hash){
  for(let i=0;i<rows.length;i+=40){
   const incoming=rows.slice(i,i+40),current=await query('SELECT source_key,circuit,official_id,normalized_name,display_name,payload FROM observed_players WHERE source_key IN ('+incoming.map(r=>sqlString(r.source_key)).join(',')+')');
   const parsed=current.map(r=>({...r,payload:JSON.parse(r.payload)})),prior=new Map(parsed.map(r=>[r.source_key,r]));
   const merged=incoming.map(r=>({...r,official_id:r.official_id||prior.get(r.source_key)?.official_id||'',payload:{...(prior.get(r.source_key)?.payload||{}),...Object.fromEntries(Object.entries(r.payload).filter(([,v])=>v!==''&&v!=null))}}));
   const plan=buildIncrementalSyncPlan({current:parsed,incoming:merged,keyOf:r=>r.source_key,sourceComplete:true});
   const delta=[...plan.inserts,...plan.updates.map(u=>u.after)];changed+=delta.length;
   for(let j=0;j<delta.length;j+=20)await query(delta.slice(j,j+20).map(r=>'INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES('+[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,JSON.stringify(r.payload)].map(sqlString).join(',')+') ON CONFLICT(source_key) DO UPDATE SET official_id=excluded.official_id,normalized_name=excluded.normalized_name,display_name=excluded.display_name,payload=excluded.payload WHERE official_id IS NOT excluded.official_id OR normalized_name IS NOT excluded.normalized_name OR display_name IS NOT excluded.display_name OR payload IS NOT excluded.payload;').join('\n'));
   const saved=await query('SELECT source_key,circuit,official_id FROM observed_players WHERE source_key IN ('+incoming.map(r=>sqlString(r.source_key)).join(',')+')');
   const verified=new Map(saved.map(r=>[r.source_key,r]));
   if(incoming.some(r=>verified.get(r.source_key)?.circuit!==r.circuit||verified.get(r.source_key)?.official_id!==r.official_id))throw Error('acceptance_saved_circuit_id_unverified');
  }
 }
 const pending=await query('SELECT source_key FROM player_identity_pending_sources LIMIT 1');
 // Initial registration is explicitly authorized; subsequent deltas keep the existing bulk write guard.
 const identity=pending.length?await syncPlayerIdentities(query,{allowBulk:!checkpoint}):{status:'unchanged',writes:0,pending:0};
 if(identity.status==='pending')throw Error('acceptance_identity_pending');
 if(checkpoint?.value!==hash)await query('INSERT INTO app_state(key,value,updated_at) VALUES('+sqlString(key)+','+sqlString(hash)+','+sqlString(new Date().toISOString())+') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;');
 return {circuit,participants:rows.length,recoveredCircuitIds:required.recovered,excludedRecords:required.excludedRecords,recoveredExistingFitpNames:knownFitpNames.size,changed,identity,unchanged:checkpoint?.value===hash};
}
export async function syncAcceptanceProfiles(query,circuit,doc,options={}) {
 const context={rows:null};
 try {
  const result=await importAcceptanceProfiles(query,circuit,doc,options,context);
  await saveAcceptanceImportDiagnostics(query,circuit,{rows:context.rows,status:'complete'});
  return result;
 }catch(error){
  const message=String(error?.message||'');
  const reason=message.startsWith('player_circuit_id_required:')?'id_required':/incomplete|name_missing_or_ambiguous/.test(message)?'source_incomplete':/saved_circuit_id_unverified/.test(message)?'save_unverified':/identity_pending/.test(message)?'identity_pending':'import_failed';
  try{await saveAcceptanceImportDiagnostics(query,circuit,{rows:context.rows,status:'blocked',reason});}catch{throw Error('acceptance_import_failed_and_diagnostics_unavailable');}
  // Anonymous failure code only: no player data or SQL reaches workflow logs.
  throw Error('acceptance_'+reason+':'+(message.startsWith('player_circuit_id_required:')?message:'registration_incomplete'));
 }
}
async function main(){
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
 async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(x=>x.success))throw Error('acceptance_d1_query_failed:'+r.status);return j.result[0].results||[]}
 const doc=JSON.parse(gunzipSync(await fs.readFile(process.env.ACCEPTANCE_CACHE_FILE)));
 const audit=await syncAcceptanceProfiles(query,process.env.ACCEPTANCE_CIRCUIT,doc,{recoverMissing:acceptanceNativeIdRecovery(doc)});await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/acceptance-player-profiles.json',JSON.stringify(audit)+'\n');console.log(JSON.stringify(audit));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
