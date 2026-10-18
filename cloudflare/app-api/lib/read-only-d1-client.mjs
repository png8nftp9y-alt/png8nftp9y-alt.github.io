// D1_READ_ONLY: guarded
import {assertReadOnlyQuery} from './read-only-d1-query.mjs';
export function createReadOnlyD1Client(execute){
 const query=async(sql,params=[])=>{assertReadOnlyQuery(sql);return execute(sql,params);};
 const db={prepare(sql){const statement={bind(...params){return{all:async()=>({results:await query(sql,params)}),first:async()=>(await query(sql,params))[0]||null}},all:async()=>({results:await query(sql)}),first:async()=>(await query(sql))[0]||null};return statement;}};
 return{query,db};
}
export async function openReadOnlyD1({fetcher=globalThis.fetch}={}){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw Error('diagnostic_credentials_missing');
 async function cf(path,body){
  let response;
  try{response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}
  catch{throw Error('diagnostic_d1_network_failed');}
  let data;try{data=await response.json();}catch{}
  if(response.ok&&data?.success)return data.result;
  const codes=(data?.errors||[]).map(e=>e.code).filter(c=>Number.isFinite(c));
  throw Error(`diagnostic_d1_request_failed:http_${response.status}:codes_${codes.join(',')||'none'}`);
 }
 const database=(await cf('?name=courtwatch-app&per_page=100')).find(d=>d.name==='courtwatch-app');if(!database)throw Error('diagnostic_database_missing');
 return createReadOnlyD1Client(async(sql,params)=>{const rows=await cf(`/${database.uuid||database.id}/query`,{sql,params});if(!rows.every(r=>r.success))throw Error('diagnostic_query_failed');return rows[0]?.results||[];});
}
