import fs from 'node:fs/promises';
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!accountId||!token)throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
const base=`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
async function cf(url,init={}){const response=await fetch(url,{...init,headers:{...headers,...init.headers}});const body=await response.json();if(!response.ok||body.success===false)throw new Error(`Cloudflare D1 ${response.status}: ${JSON.stringify(body.errors||body)}`);return body.result}
const list=await cf(`${base}?name=courtwatch-app&per_page=100`);
let database=(Array.isArray(list)?list:list?.result||[]).find(row=>row.name==='courtwatch-app');
if(!database)database=await cf(base,{method:'POST',body:JSON.stringify({name:'courtwatch-app'})});
const id=database.uuid||database.id;if(!id)throw new Error('Cloudflare did not return the D1 database id');
const config={$schema:'./node_modules/wrangler/config-schema.json',name:'courtwatch-app-api',main:'src/index.js',compatibility_date:'2026-08-29',observability:{enabled:true,head_sampling_rate:1},d1_databases:[{binding:'DB',database_name:'courtwatch-app',database_id:id,migrations_dir:'migrations'}],...(process.env.R2_BUCKET?{r2_buckets:[{binding:'ARCHIVE',bucket_name:process.env.R2_BUCKET}]}:{}),vars:{COURTWATCH_SCHEMA_VERSION:'courtwatch-universal-v1'}};
await fs.writeFile('wrangler.generated.jsonc',JSON.stringify(config,null,2)+'\n');
await fs.appendFile(process.env.GITHUB_OUTPUT||'/dev/null',`database_id=${id}\n`);
console.log(JSON.stringify({database:'courtwatch-app',databaseId:id,reused:Boolean(list?.length)}));
