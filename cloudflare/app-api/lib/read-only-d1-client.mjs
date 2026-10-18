// D1_READ_ONLY: guarded
import {assertReadOnlyQuery} from './read-only-d1-query.mjs';
export function createReadOnlyD1Client(execute){
 const query=async(sql,params=[])=>{assertReadOnlyQuery(sql);return execute(sql,params);};
 const db={prepare(sql){const statement={bind(...params){return{all:async()=>({results:await query(sql,params)}),first:async()=>(await query(sql,params))[0]||null}},all:async()=>({results:await query(sql)}),first:async()=>(await query(sql))[0]||null};return statement;}};
 return{query,db};
}
export async function openReadOnlyD1({fetcher=globalThis.fetch,databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID||'',onMetrics}={}){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw Error('diagnostic_credentials_missing');
 if(databaseId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId))throw Error('diagnostic_invalid_database_id');
 const networkError=(error,stage)=>{const code=String(error?.cause?.code||error?.code||'');const kind=error?.name==='TimeoutError'?'request_timeout':error?.name==='AbortError'?'request_aborted':['ENOTFOUND','EAI_AGAIN'].includes(code)?'dns_failed':['ECONNRESET','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET'].includes(code)?code:['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)?'tls_failed':'transport_failed';return Error('diagnostic_d1_network_failed:'+kind+':stage_'+stage);};
 async function cf(path,body){
  const stage=body?'query':'database_list';
  let response;
  try{response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}
  catch(error){throw networkError(error,stage);}
  let data;try{data=await response.json();}catch(error){if(['TimeoutError','AbortError'].includes(error?.name))throw networkError(error,stage+'_response_body');}
  if(response.ok&&data?.success)return data.result;
  const codes=(data?.errors||[]).map(e=>e.code).filter(c=>Number.isFinite(c));
  throw Error(`diagnostic_d1_request_failed:http_${response.status}:codes_${codes.join(',')||'none'}`);
 }
 let id=databaseId;if(!id){const list=await cf('?name=courtwatch-app&per_page=100');if(!Array.isArray(list))throw Error('diagnostic_invalid_database_list');const database=list.find(d=>d.name==='courtwatch-app');if(!database)throw Error('diagnostic_database_missing');id=database.uuid||database.id;if(!id)throw Error('diagnostic_database_id_missing');}
 return createReadOnlyD1Client(async(sql,params)=>{const rows=await cf(`/${id}/query`,{sql,params});if(!Array.isArray(rows))throw Error('diagnostic_invalid_query_result');if(!rows.every(r=>r.success))throw Error('diagnostic_query_failed');if(onMetrics)onMetrics(rows);return rows[0]?.results||[];});
}
