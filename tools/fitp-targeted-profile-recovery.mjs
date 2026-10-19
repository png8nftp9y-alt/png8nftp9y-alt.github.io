// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from '../cloudflare/app-api/lib/d1-incremental-sync.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fetchFitpSheet} from '../cloudflare/app-api/lib/fitp-player-metadata.mjs';
import {openD1,metadataWriteSql} from '../cloudflare/app-api/scripts/sync-fitp-player-metadata.mjs';
const normalized=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function recoverConfirmedProfiles({query,write,targets,fetchProfile=fetchFitpSheet,now=()=>new Date().toISOString()}){
 if(!targets.length||targets.length>8||new Set(targets.map(r=>r.membership_card)).size!==targets.length)throw Error('fitp_target_scope_invalid');
 const incoming=[],unresolved=[];
 for(const target of targets){
  const links=await query("SELECT DISTINCT COALESCE(a.canonical_id,l.canonical_id) AS canonical_id FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE l.circuit='fitp' AND l.official_id=?",[target.membership_card]);
  if(links.length!==1||links[0].canonical_id!==target.canonical_id)throw Error('fitp_target_identity_changed');
  try{
   const profile=await fetchProfile(target.membership_card);
   if(profile.membership_card!==target.membership_card||!profile.club||!profile.ranking)throw Error('fitp_target_profile_incomplete');
   incoming.push({...profile,canonical_id:target.canonical_id});
  }catch(error){unresolved.push({...target,error:error.message});}
 }
 const cards=incoming.map(r=>r.membership_card),params=[JSON.stringify(cards)];
 const sql='SELECT membership_card,canonical_id,club,ranking FROM fitp_player_metadata WHERE membership_card IN (SELECT value FROM json_each(?))';
 const current=cards.length?await query(sql,params):[];
 const plan=buildIncrementalSyncPlan({current,incoming:incoming.map(({membership_card,canonical_id,club,ranking})=>({membership_card,canonical_id,club,ranking})),keyOf:r=>r.membership_card,sourceComplete:true}),changed=[...plan.inserts,...plan.updates.map(r=>r.after)];
 if(changed.length)await write(metadataWriteSql,[now(),JSON.stringify(changed)]);
 const saved=cards.length?await query(sql,params):[];
 for(const expected of incoming){const actual=saved.find(r=>r.membership_card===expected.membership_card);if(!actual||['canonical_id','club','ranking'].some(k=>actual[k]!==expected[k]))throw Error('fitp_target_write_not_verified');}
 const failures=cards.length?await query("SELECT cycle,membership_card FROM fitp_metadata_failures WHERE error='fitp_profile_missing' AND membership_card IN (SELECT value FROM json_each(?))",params):[];
 if(failures.length)await write("DELETE FROM fitp_metadata_failures WHERE error='fitp_profile_missing' AND membership_card IN (SELECT value FROM json_each(?))",params);
 if(cards.length&&(await query("SELECT membership_card FROM fitp_metadata_failures WHERE error='fitp_profile_missing' AND membership_card IN (SELECT value FROM json_each(?))",params)).length)throw Error('fitp_target_ledger_not_verified');
 return {status:unresolved.length?'recovery_incomplete':'recovery_verified',attempted:targets.length,verified:saved.length,dataWrites:plan.writes,clearedUnavailable:failures.length,unresolved,saved};
}
export async function fetchNamedProfile(target,fetcher=fetch){
 // Use the same official request/parser; validate the returned name in addition to its masked card suffix.
 let returnedName='';
 const profile=await fetchFitpSheet(target.membership_card,async(...args)=>{
  const response=await fetcher(...args);
  if(response.ok){const data=await response.clone().json();returnedName=[data?.player?.Name||data?.player?.name,data?.player?.Surname||data?.player?.surname].filter(Boolean).join(' ');}
  return response;
 });
 if(normalized(returnedName)!==normalized(target.name))throw Error('fitp_target_name_mismatch');
 return profile;
}
export async function inspectStoredOrigins(query,cards){
 const identities=[],sources=[];
 for(let i=0;i<cards.length;i+=100)identities.push(...await query("SELECT source_key,canonical_id,official_id,display_name,profile_url FROM player_circuit_identities WHERE circuit='fitp' AND official_id IN (SELECT value FROM json_each(?))",[JSON.stringify(cards.slice(i,i+100))]));
 const keys=[...new Set(identities.map(r=>r.source_key))];
 for(const table of ['observed_players','search_acquired_players'])for(let i=0;i<keys.length;i+=100)sources.push(...(await query(`SELECT source_key,official_id,display_name,payload FROM ${table} WHERE source_key IN (SELECT value FROM json_each(?))`,[JSON.stringify(keys.slice(i,i+100))])).map(r=>({...r,source_table:table})));
 const byTable={};for(const r of sources)byTable[r.source_table]=(byTable[r.source_table]||0)+1;
 return {requested:cards.length,identities:identities.length,sourceRows:sources.length,byTable,rows:identities.map(r=>({...r,sources:sources.filter(s=>s.source_key===r.source_key)}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const scope=JSON.parse(await readFile(new URL('./fitp-targeted-profile-recovery.json',import.meta.url),'utf8'));
 const report={checkedAt:new Date().toISOString(),scope:'eight_confirmed_profiles_and_stored_503_origins',polling:false};
 try{
  const db=await openD1();
  report.recovery=await recoverConfirmedProfiles({...db,targets:scope.recover,fetchProfile:card=>fetchNamedProfile(scope.recover.find(r=>r.membership_card===card))});
  report.origins=await inspectStoredOrigins(db.query,scope.inspect);
  // One diagnostic request only. Preserve the exact response type rather than assuming JSON is an object.
  try{
   const response=await fetch('https://dp-fit-prod-function.azurewebsites.net/api/v6/player/sheet/simple',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Pagina-Giocatore/'},body:JSON.stringify({cardNumber:btoa('8313056632')}),signal:AbortSignal.timeout(15000)});
   const body=await response.text();let data;try{data=JSON.parse(body)}catch{}
   report.pisani={http:response.status,contentType:response.headers.get('content-type'),bodyType:data===null?'null':Array.isArray(data)?'array':typeof data,bodyLength:body.length,bodyPreview:body.slice(0,1000)};
  }catch(error){report.pisani={error:error.message};}
  console.log('FITP_TARGETED_RECOVERY='+JSON.stringify({...report,origins:{...report.origins,rows:undefined}}));
  if(report.recovery.unresolved.length)process.exitCode=1;
 }catch(error){report.error=error.message;process.exitCode=1;console.error(error.message)}
 await writeFile('fitp-targeted-profile-recovery-report.json',JSON.stringify(report,null,2)+'\n');
}
