// D1_WRITE_POLICY: incremental
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {fetchFitpSheet,fitpCycle} from '../lib/fitp-player-metadata.mjs';
export function metadataPlan(current,incoming){
 const old=new Map(current.map(r=>[r.membership_card,r]));
 const valid=incoming.map(r=>{
  if(!/^\d{6,12}$/.test(r.membership_card)||!r.canonical_id)throw Error('fitp_incomplete_identity');
  const previous=old.get(r.membership_card);
  return{membership_card:r.membership_card,canonical_id:r.canonical_id,club:r.club||previous?.club||'',ranking:r.ranking||previous?.ranking||''};
 }).filter(r=>r.club||r.ranking);
 const keys=new Set(valid.map(r=>r.membership_card));
 return buildIncrementalSyncPlan({current:current.filter(r=>keys.has(r.membership_card)).map(({membership_card,canonical_id,club,ranking})=>({membership_card,canonical_id,club,ranking})),incoming:valid,keyOf:r=>r.membership_card,sourceComplete:true});
}
const identities=`FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id`;
const validCard=`length(l.official_id) BETWEEN 6 AND 12 AND l.official_id NOT GLOB '*[^0-9]*'`;
export const inventorySql=`SELECT l.official_id AS membership_card,MIN(COALESCE(a.canonical_id,l.canonical_id)) AS canonical_id
 ${identities} WHERE l.circuit='fitp' AND l.official_id>? AND ${validCard}
 GROUP BY l.official_id HAVING COUNT(DISTINCT COALESCE(a.canonical_id,l.canonical_id))=1 ORDER BY l.official_id LIMIT ?`;
export const metadataWriteSql=`INSERT INTO fitp_player_metadata(membership_card,canonical_id,club,ranking,updated_at)
 SELECT json_extract(value,'$.membership_card'),json_extract(value,'$.canonical_id'),json_extract(value,'$.club'),json_extract(value,'$.ranking'),? FROM json_each(?) WHERE 1
 ON CONFLICT(membership_card) DO UPDATE SET canonical_id=excluded.canonical_id,club=excluded.club,ranking=excluded.ranking,updated_at=excluded.updated_at
 WHERE fitp_player_metadata.canonical_id<>excluded.canonical_id OR fitp_player_metadata.club<>excluded.club OR fitp_player_metadata.ranking<>excluded.ranking`;
export const progressWriteSql=`INSERT INTO fitp_metadata_progress(cycle,last_card,complete,checked,with_club,with_ranking,unavailable,updated_at) VALUES(?,?,?,?,?,?,?,?)
 ON CONFLICT(cycle) DO UPDATE SET last_card=excluded.last_card,complete=excluded.complete,checked=excluded.checked,with_club=excluded.with_club,with_ranking=excluded.with_ranking,unavailable=excluded.unavailable,updated_at=excluded.updated_at`;
const failureWriteSql=`INSERT INTO fitp_metadata_failures(cycle,membership_card,canonical_id,error)
 SELECT ?,json_extract(value,'$.membership_card'),json_extract(value,'$.canonical_id'),json_extract(value,'$.error') FROM json_each(?) WHERE 1
 ON CONFLICT(cycle,membership_card) DO UPDATE SET canonical_id=excluded.canonical_id,error=excluded.error
 WHERE fitp_metadata_failures.canonical_id<>excluded.canonical_id OR fitp_metadata_failures.error<>excluded.error`;
export async function syncFitpMetadata({query,write,fetchProfile=fetchFitpSheet,now=()=>Date.now(),log=console.log,batchSize=100,concurrency=4,maxDurationMs=19800000,retryFailures=false}){
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>100||!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('fitp_invalid_batch_settings');
 const started=now(),cycle=fitpCycle(started);
 const state=(await query('SELECT * FROM fitp_metadata_progress WHERE cycle=?',[cycle]))[0]||{last_card:'',checked:0,with_club:0,with_ranking:0,unavailable:0,complete:0};
 const failedCount=async()=>Number((await query('SELECT COUNT(*) AS n FROM fitp_metadata_failures WHERE cycle=?',[cycle]))[0]?.n||0);
 if(state.complete&&!retryFailures){const failed=await failedCount();log(JSON.stringify({status:'already_complete',cycle,...state,failed}));if(failed)throw Error('fitp_profiles_failed_'+failed+'_retry_failures_manually');return state;}
 if(retryFailures&&!state.complete)throw Error('fitp_finish_initial_acquisition_before_retry');
 let retryCursor='';
 const coverage=(await query(`SELECT COUNT(*) AS eligible,SUM(people>1) AS ambiguous FROM (SELECT l.official_id,COUNT(DISTINCT COALESCE(a.canonical_id,l.canonical_id)) AS people ${identities} WHERE l.circuit='fitp' AND ${validCard} GROUP BY l.official_id)`))[0]||{};
 log(JSON.stringify({status:'inventory',cycle,...coverage}));
 const checkpoint=complete=>write(progressWriteSql,[cycle,state.last_card,complete,state.checked,state.with_club,state.with_ranking,state.unavailable,new Date(now()).toISOString()]);
 while(true){
  if(now()-started>maxDurationMs)throw Error('fitp_run_time_budget_reached_resume_manually');
  const cards=retryFailures?await query(`SELECT f.membership_card,MIN(COALESCE(a.canonical_id,l.canonical_id)) AS canonical_id
 FROM fitp_metadata_failures f JOIN player_circuit_identities l ON l.circuit='fitp' AND l.official_id=f.membership_card LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 WHERE f.cycle=? AND f.membership_card>? GROUP BY f.membership_card HAVING COUNT(DISTINCT COALESCE(a.canonical_id,l.canonical_id))=1 ORDER BY f.membership_card LIMIT ?`,[cycle,retryCursor,batchSize]):await query(inventorySql,[state.last_card,batchSize]);
  if(!cards.length){
   if(!retryFailures){await checkpoint(1);state.complete=1;}
   const failed=await failedCount();
   const stored=(await query("SELECT COUNT(*) AS total,SUM(club<>'') AS with_club,SUM(ranking<>'') AS with_ranking FROM fitp_player_metadata"))[0]||{};
   log(JSON.stringify({stored,status:failed?'complete_with_source_errors':coverage.ambiguous?'complete_with_identity_conflicts':state.unavailable?'complete_with_unavailable_fields':'complete',cycle,...state,failed,coverage,retryFailures}));
   if(failed)throw Error('fitp_profiles_failed_'+failed+'_retry_failures_manually');
   return state;
  }
  const current=await query('SELECT membership_card,canonical_id,club,ranking FROM fitp_player_metadata WHERE membership_card IN (SELECT value FROM json_each(?))',[JSON.stringify(cards.map(r=>r.membership_card))]);
  const incoming=[],errors=[];let index=0;
  await Promise.all(Array.from({length:Math.min(concurrency,cards.length)},async()=>{
   while(index<cards.length){const row=cards[index++];try{
    const profile=await fetchProfile(row.membership_card);
    if(profile.membership_card!==row.membership_card)throw Error('fitp_profile_identity_mismatch');
    incoming.push({...profile,canonical_id:row.canonical_id});
   }catch(error){errors.push({...row,error:String(error.message).slice(0,240)});}}
  }));
  const plan=metadataPlan(current,incoming),changed=[...plan.inserts,...plan.updates.map(r=>r.after)];
  if(changed.length)await write(metadataWriteSql,[new Date(now()).toISOString(),JSON.stringify(changed)]);
  if(errors.length)await write(failureWriteSql,[cycle,JSON.stringify(errors)]);
  // A retry is always explicit. Normal acquisition keeps visiting distinct cards.
  if(incoming.length)await write('DELETE FROM fitp_metadata_failures WHERE cycle=? AND membership_card IN (SELECT value FROM json_each(?))',[cycle,JSON.stringify(incoming.map(r=>r.membership_card))]);
  if(errors.some(r=>/http_(401|403|429)$/.test(r.error))||errors.length===cards.length)throw Error('fitp_source_unavailable_resume_manually');
  if(retryFailures){retryCursor=cards.at(-1).membership_card;log(JSON.stringify({status:'retry_progress',cycle,attempted:cards.length,failed:errors.length,dataWrites:plan.writes}));continue;}
  state.last_card=cards.at(-1).membership_card;state.checked+=cards.length;
  state.with_club+=incoming.filter(r=>r.club).length;state.with_ranking+=incoming.filter(r=>r.ranking).length;
  state.unavailable+=incoming.filter(r=>!r.club||!r.ranking).length;
  await checkpoint(0);log(JSON.stringify({status:'progress',cycle,...state,dataWrites:plan.writes,failed:errors.length}));
 }
}
async function openD1(){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw Error('fitp_d1_credentials_missing');
 const base=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
 const request=async(path,body)=>{
  const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await r.json();if(!r.ok||!data.success)throw Error('fitp_d1_http_'+r.status);return data.result;
 };
 const database=(await request('?name=courtwatch-app&per_page=100')).find(r=>r.name==='courtwatch-app');if(!database)throw Error('fitp_d1_database_missing');
 const execute=async(sql,params=[])=>{const data=await request('/'+(database.uuid||database.id)+'/query',{sql,params});if(!data.every(r=>r.success))throw Error('fitp_d1_query_failed');return data[0]?.results||[];};
 await execute(await readFile(new URL('../migrations/0041_fitp_metadata_engine.sql',import.meta.url),'utf8'));
 return{query:execute,write:execute};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await syncFitpMetadata({...await openD1(),retryFailures:process.env.FITP_RETRY_FAILURES==='true'});
