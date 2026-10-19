// D1_WRITE_POLICY: incremental
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {recoverableFitpWrite,reconcileFitpWrites} from '../lib/fitp-write-reconciliation.mjs';
import {parseFitpSheet} from '../lib/fitp-player-metadata.mjs';
import {openD1,metadataPlan,metadataWriteSql} from './sync-fitp-player-metadata.mjs';
export const pendingNewFitpSql="SELECT membership_card,state,error,checked_at FROM fitp_initial_metadata WHERE state='pending' AND membership_card>? ORDER BY membership_card LIMIT ?";
const metadataSql='SELECT membership_card,canonical_id,club,ranking FROM fitp_player_metadata WHERE membership_card IN (SELECT value FROM json_each(?))';
const linksSql="SELECT l.official_id AS membership_card,COALESCE(a.canonical_id,l.canonical_id) AS canonical_id FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE l.circuit='fitp' AND l.official_id IN (SELECT value FROM json_each(?))";
export async function fetchNewFitpProfile(card,{fetcher=fetch,now=Date.now()}={}){
 const year=new Date(now).getUTCFullYear();
 const response=await fetcher('https://dp-myfit-test-function-v2.azurewebsites.net/api/v1/tesserati/dettaglio/semplice',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Pagina-Giocatore/'},
  body:JSON.stringify({cardNumber:btoa(String(card)),fromYear:year,toYear:year}),signal:AbortSignal.timeout(10000)
 });
 if(response.status===404)return {membership_card:card,club:'',ranking:'',availability:'not_found'};
 if(!response.ok)throw Error('fitp_profile_http_'+response.status);
 const data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error('fitp_profile_invalid_response');
 return parseFitpSheet(data,card);
}
function canonicalFor(links,card){const ids=[...new Set(links.filter(r=>r.membership_card===card).map(r=>r.canonical_id))];return ids.length===1?ids[0]:null;}
export async function syncNewFitpMetadata({query,write,fetchProfile=card=>fetchNewFitpProfile(card),now=()=>Date.now(),log=()=>{},batchSize=40,concurrency=4,maxDurationMs=900000}){
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>100||!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('fitp_initial_invalid_settings');
 const started=now(),report={status:'complete',checked:0,sourceRequests:0,dataWrites:0,queueWrites:0,outcomes:{}};let cursor='';
 while(true){
  if(now()-started>maxDurationMs)throw Error('fitp_initial_time_budget_pending_preserved');
  const queued=await query(pendingNewFitpSql,[cursor,batchSize]);if(!queued.length)return report;
  const keys=queued.map(r=>r.membership_card),params=[JSON.stringify(keys)];
  const [links,existing]=await Promise.all([query(linksSql,params),query(metadataSql,params)]);
  const incoming=[],outcomes=[];let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,queued.length)},async()=>{
   while(index<queued.length){const row=queued[index++],card=row.membership_card,canonical=canonicalFor(links,card),stored=existing.find(r=>r.membership_card===card);
    if(!canonical){outcomes.push({membership_card:card,state:links.some(r=>r.membership_card===card)?'identity_conflict':'orphan',error:'fitp_initial_identity_unresolved'});continue;}
    if(stored&&stored.canonical_id===canonical){outcomes.push({membership_card:card,state:stored.club&&stored.ranking?'complete':'partial',error:''});continue;}
    try{
     report.sourceRequests++;const profile=await fetchProfile(card);
     if(profile.membership_card!==card)throw Error('fitp_profile_identity_mismatch');
     if(profile.club||profile.ranking)incoming.push({...profile,canonical_id:canonical});
     outcomes.push({membership_card:card,state:profile.club&&profile.ranking?'complete':profile.club||profile.ranking?'partial':'unavailable',error:''});
    }catch(error){const reason=String(error.message).slice(0,240);outcomes.push({membership_card:card,state:reason==='fitp_profile_missing'?'unavailable':'error',error:reason});}
   }
  }));
  // Resolve the exact identity again after external I/O; do not attach metadata across a concurrent relink.
  const verifiedLinks=incoming.length?await query(linksSql,[JSON.stringify(incoming.map(r=>r.membership_card))]):[];
  const safe=incoming.filter(r=>{if(canonicalFor(verifiedLinks,r.membership_card)===r.canonical_id)return true;Object.assign(outcomes.find(o=>o.membership_card===r.membership_card),{state:'identity_conflict',error:'fitp_initial_identity_changed'});return false;});
  const current=safe.length?await query(metadataSql,[JSON.stringify(safe.map(r=>r.membership_card))]):[];
  const plan=metadataPlan(current,safe),changed=[...plan.inserts,...plan.updates.map(u=>u.after)];
  if(changed.length){
   const statement={sql:metadataWriteSql,params:[new Date(now()).toISOString(),JSON.stringify(changed)]};
   try{await write(statement.sql,statement.params)}catch(error){if(!recoverableFitpWrite(error))throw error;await reconcileFitpWrites({query,write,statements:[statement],kinds:{metadataSql:metadataWriteSql},log});}
  }
  // Read back before acknowledging the queue, including a provider write with an unknown outcome.
  if(safe.length){const saved=await query(metadataSql,[JSON.stringify(safe.map(r=>r.membership_card))]);for(const expected of safe){const actual=saved.find(r=>r.membership_card===expected.membership_card);if(!actual||actual.canonical_id!==expected.canonical_id||expected.club&&actual.club!==expected.club||expected.ranking&&actual.ranking!==expected.ranking)throw Error('fitp_initial_metadata_not_verified_pending_preserved');}}
  const before=queued.map(r=>({membership_card:r.membership_card,state:r.state,error:r.error}));
  const queuePlan=buildIncrementalSyncPlan({current:before,incoming:outcomes,keyOf:r=>r.membership_card,sourceComplete:true});
  for(const {after} of queuePlan.updates)await write("UPDATE fitp_initial_metadata SET state=?,error=?,checked_at=? WHERE membership_card=? AND state='pending'",[after.state,after.error,new Date(now()).toISOString(),after.membership_card]);
  for(const r of outcomes)report.outcomes[r.state]=(report.outcomes[r.state]||0)+1;
  report.checked+=queued.length;report.dataWrites+=plan.writes;report.queueWrites+=queuePlan.writes;cursor=keys.at(-1);log({...report});
  if(outcomes.some(r=>r.state==='error'))throw Error('fitp_initial_source_error_recorded_no_automatic_retry');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let report;try{report=await syncNewFitpMetadata({...await openD1({initializeSchema:false}),log:r=>console.log('FITP_NEW_PLAYERS_PROGRESS='+JSON.stringify(r))});console.log('FITP_NEW_PLAYERS='+JSON.stringify(report));}
 catch(error){report={status:'failed',error:error.message};console.error(JSON.stringify(report));process.exitCode=1;}
 await mkdir('tmp',{recursive:true});await writeFile('tmp/fitp-new-player-metadata.json',JSON.stringify(report,null,2)+'\n');
}
