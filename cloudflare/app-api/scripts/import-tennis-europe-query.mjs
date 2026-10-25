// D1_WRITE_POLICY: incremental; transports existing guarded SQL without changing its write plan.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Only generated seed SQL is accepted. Never split a file: each match shard and
// its change detection, child cleanup and child inserts remain one D1 batch.
export function statements(sql) {
 const out=[]; let start=0,quote='',comment='';
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue;}
  if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
  if(quote){if(c===quote){if(n===quote){i++;continue;}quote='';}continue;}
  if(c==='-'&&n==='-'){comment='line';i++;continue;}
  if(c==='/'&&n==='*'){comment='block';i++;continue;}
  if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
  if(c===';'){out.push(sql.slice(start,i+1));start=i+1;}
 }
 if(quote||comment==='block'||sql.slice(start).trim())throw Error('TE_SQL_INCOMPLETE');
 return out.filter(s=>s.trim());
}
export function validateFile(sql,name){
 const list=statements(sql);
 if(!list.length||list.length>2000||Buffer.byteLength(sql)>8_000_000)throw Error('TE_QUERY_FILE_TOO_LARGE: '+name);
 if(list.some(s=>Buffer.byteLength(s)>100_000))throw Error('TE_QUERY_STATEMENT_TOO_LARGE: '+name);
 return list.length;
}
export async function importSeeds({directory='seed-tennis-europe-oop',config='wrangler.generated.jsonc',env=process.env,request=fetch,log=console.log}={}){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN;
 if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('TE_QUERY_CREDENTIALS_MISSING');
 const settings=JSON.parse(await fs.readFile(config,'utf8'));
 const binding=settings.d1_databases?.find(d=>d.database_name==='courtwatch-app');
 if(!/^[a-f0-9-]{36}$/i.test(binding?.database_id||''))throw Error('TE_QUERY_DATABASE_MISSING');
 const files=(await fs.readdir(directory)).filter(n=>n.endsWith('.sql')).sort();
 if(!files.length)throw Error('TE_QUERY_NO_SEEDS');
 const plan=[];
 // Validate the complete plan before the reset or any other remote mutation.
 const hash=sql=>createHash('sha256').update(sql).digest('hex');
 for(const name of files){const sql=await fs.readFile(path.join(directory,name),'utf8');plan.push({name,hash:hash(sql),count:validateFile(sql,name)});}
 const url=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${binding.database_id}/query`;
 const totals={files:0,statements:0,rowsRead:0,rowsWritten:0};
 for(const {name,hash:expectedHash,count} of plan){
  const sql=await fs.readFile(path.join(directory,name),'utf8');
  if(hash(sql)!==expectedHash)throw Error('TE_QUERY_FILE_CHANGED: '+name);
  log('TE_QUERY_IMPORT '+name+' statements='+count);
  // No automatic write replay after a timeout or ambiguous response.
  const response=await request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(35_000)});
  let body;try{body=await response.json();}catch{throw Error('TE_QUERY_INVALID_RESPONSE: '+name+' HTTP '+response.status);}
  if(!response.ok||body.success!==true||!Array.isArray(body.result)||!body.result.length||body.result.some(r=>r.success!==true)){
   const codes=(body.errors||[]).map(e=>e.code).join(',');
   throw Error('TE_QUERY_FAILED: '+name+' HTTP '+response.status+' codes='+codes);
  }
  for(const row of body.result){
   if(!Number.isFinite(row.meta?.rows_read)||!Number.isFinite(row.meta?.rows_written))throw Error('TE_QUERY_METRICS_MISSING: '+name);
   totals.rowsRead+=row.meta.rows_read;totals.rowsWritten+=row.meta.rows_written;
  }
  totals.files++;totals.statements+=count;
 }
 log('TE_QUERY_IMPORT_METRICS='+JSON.stringify(totals));return totals;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await importSeeds();
