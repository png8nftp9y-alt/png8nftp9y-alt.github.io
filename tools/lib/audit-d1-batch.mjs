// D1_READ_ONLY: guarded. Scope-only REST batching, never imported by the application.
// https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
import {assertReadOnlyQuery} from '../../cloudflare/app-api/lib/read-only-d1-query.mjs';
export function auditD1Batch({account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID,fetcher=globalThis.fetch,onMetrics=()=>{}}={}){
 const metrics={requests:0,queries:0};
 async function batch(queries){
  if(!Array.isArray(queries)||queries.length<1||queries.length>4)throw Error('audit_invalid_batch_size');
  for(const q of queries){assertReadOnlyQuery(q.sql);if(!Array.isArray(q.params||[]))throw Error('audit_invalid_batch_params');}
  if(!account||!token||!databaseId||!/^[0-9a-f-]{36}$/i.test(databaseId))throw Error('diagnostic_credentials_missing');
  const body={batch:queries.map(q=>({sql:q.sql,params:q.params||[]}))};
  if(Buffer.byteLength(JSON.stringify(body))>65536)throw Error('audit_batch_too_large');
  metrics.requests++;metrics.queries+=queries.length;
  const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  let data;try{data=await response.json();}catch{throw Error('diagnostic_invalid_batch_response');}
  if(!response.ok||data?.success!==true){const codes=(data?.errors||[]).map(e=>e.code).filter(Number.isFinite);throw Error(`diagnostic_d1_request_failed:http_${response.status}:codes_${codes.join(',')||'none'}`);}
  const rows=data.result;
  if(!Array.isArray(rows)||rows.length!==queries.length)throw Error('diagnostic_batch_result_count');
  onMetrics(rows);
  if(rows.some(r=>Number(r.meta?.rows_written)))throw Error('audit_write_detected');
  if(rows.some(r=>r.success!==true||!Array.isArray(r.results)))throw Error('diagnostic_batch_query_failed');
  return rows.map(r=>r.results);
 }
 return{batch,metrics};
}
