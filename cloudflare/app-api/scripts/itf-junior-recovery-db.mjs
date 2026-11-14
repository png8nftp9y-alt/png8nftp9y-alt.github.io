const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
export async function query(sql,params=[]){
 if(!account||!token)throw Error('Cloudflare credentials missing');
 async function call(path,init={}){
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database'+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
  const body=await response.json();if(!response.ok||body.success===false)throw Error('D1: '+JSON.stringify(body.errors||response.status));return body.result;
 }
 const databases=await call('?name=courtwatch-app&per_page=100');
 const database=databases.find(d=>d.name==='courtwatch-app');if(!database)throw Error('Existing courtwatch-app D1 database not found');
 const result=await call('/'+(database.uuid||database.id)+'/query',{method:'POST',body:JSON.stringify({sql,params})});
 if(!Array.isArray(result)||result.some(block=>block.success===false))throw Error('D1 query failed');
 return result[0]?.results||[];
}
