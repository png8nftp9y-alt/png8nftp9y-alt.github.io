import worker from '../cloudflare/app-api/src/index.js';
import fs from 'node:fs/promises';
const snapshotPath=process.env.COURTWATCH_OTHERS_SNAPSHOT_PATH||'/tmp/courtwatch-others-snapshot.json';
await fs.rm(snapshotPath,{force:true});
const source=await fs.readFile('cloudflare/app-api/src/index.js','utf8');
const email=source.match(/email:\s*['"]([^'"]+)['"]/)[1];
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const clean=s=>String(s).replace(/[\w.+-]+@[\w.-]+/g,'[email]').replace(/\b\d{8,}\b/g,'[id]').slice(0,600);
async function cf(url,init={}){const r=await fetch(url,{...init,headers,signal:AbortSignal.timeout(30000)}),b=await r.json();if(!r.ok||b.success===false)throw Error(clean(JSON.stringify(b.errors||b)));return b.result}
const list=await cf(base+'?name=courtwatch-app&per_page=100'),db=(Array.isArray(list)?list:[]).find(x=>x.name==='courtwatch-app');if(!db)throw Error('existing_database_not_found');
let queries=0;
async function select(sql,params){if(!/^\s*(SELECT|WITH)\b/i.test(sql))throw Error('read_only_guard');const start=Date.now();const result=(await cf(base+'/'+(db.uuid||db.id)+'/query',{method:'POST',body:JSON.stringify({sql,params})}))[0];queries++;console.log(JSON.stringify({query:queries,table:sql.match(/\bFROM\s+([\w]+)/i)?.[1]||'select',ms:Date.now()-start,rows:result.results?.length||0}));if(result.success===false)throw Error(clean(result.error));return result}
const DB={prepare(sql){let params=[];const statement={bind(...values){params=values;return statement},async all(){return select(sql,params)},async first(){return(await select(sql,params)).results?.[0]||null},run(){throw Error('read_only_guard')}};return statement},batch(){throw Error('read_only_guard')}};
const start=Date.now();let result;try{const response=await worker.fetch(new Request('https://local.invalid/app/api/app-snapshot',{headers:{'Cf-Access-Authenticated-User-Email':email,'X-CourtWatch-Group':'others'}}),{DB},{});const body=await response.json();if(response.status===200)await fs.writeFile(snapshotPath,JSON.stringify(body));result={status:response.status,ms:Date.now()-start,queries,players:body.players?.length,tournaments:body.tournaments?.length,matches:body.matches?.length,error:body.error||''};}catch(e){result={status:'diagnostic_failed',ms:Date.now()-start,queries,error:clean(e.message)}}
console.log('OTHERS_READ_ONLY_RESULT='+JSON.stringify(result));
if(result.status!==200)process.exitCode=1;
