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
export async function importSeeds({directory='seed-tennis-europe-oop',config='wrangler.generated.jsonc',env=process.env,request=fetch,log=console.log,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now(),reportFile=null}={}){
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
 const report={version:1,status:'in_progress',policy:'one request per whole SQL file; no retries; complete parity required separately',plannedFiles:plan.length,confirmed:[],failed:null,totals};
 const reportPath=reportFile||path.join(directory,'import-report.json');
 const persist=async()=>{const temp=reportPath+'.tmp';await fs.writeFile(temp,JSON.stringify(report,null,2)+'\n');await fs.rename(temp,reportPath);};
 let gap=0;
 await persist();
 try{

 for(const {name,hash:expectedHash,count} of plan){
  const sql=await fs.readFile(path.join(directory,name),'utf8');
  if(hash(sql)!==expectedHash)throw Error('TE_QUERY_FILE_CHANGED: '+name);
  if(gap)await wait(gap);
  // Recheck after yielding; a changed local plan must never be submitted.
  if(hash(await fs.readFile(path.join(directory,name),'utf8'))!==expectedHash)throw Error('TE_QUERY_FILE_CHANGED: '+name);
  const started=now();
  report.failed={file:name,sha256:expectedHash,statements:count,bytes:Buffer.byteLength(sql),outcome:'unconfirmed'};
  await persist();
  log('TE_QUERY_IMPORT '+name+' statements='+count);

  // No automatic write replay after a timeout or ambiguous response.
  const response=await request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(35_000)});
  let body;try{body=await response.json();}catch{throw Error('TE_QUERY_INVALID_RESPONSE: '+name+' HTTP '+response.status);}
  if(!response.ok||body.success!==true||!Array.isArray(body.result)||!body.result.length||body.result.some(r=>r.success!==true)){
   const codes=(body.errors||[]).map(e=>e.code).join(',');
   const detail=JSON.stringify([body.errors,...(body.result||[]).map(r=>r.error||r.errors)]).toLowerCase();
   const reason=/cpu/.test(detail)?'cpu_limit':/memory/.test(detail)?'memory_limit':/daily.*read|read.*daily/.test(detail)?'daily_read_limit':/daily.*writ|writ.*daily/.test(detail)?'daily_write_limit':/overload|queue/.test(detail)?'overloaded':/rate.limit|too many requests/.test(detail)?'rate_limit':'unclassified';
   const queueCause=/requests queued for too long/.test(detail)?'queued_too_long':/too many requests queued/.test(detail)?'too_many_queued':'unspecified';
   // Log only recognised provider categories, never arbitrary SQL/error text or credentials.
   Object.assign(report.failed,{httpStatus:response.status,codes,reason,queueCause,requestMs:Math.max(0,now()-started),ray:response.headers?.get?.('cf-ray')||null});
   throw Error('TE_QUERY_FAILED: '+name+' HTTP '+response.status+' codes='+codes+' reason='+reason+' queue='+queueCause);

  }
  if(body.result.some(row=>!Number.isFinite(row.meta?.rows_read)||!Number.isFinite(row.meta?.rows_written)))throw Error('TE_QUERY_METRICS_MISSING: '+name);
  const rowsRead=body.result.reduce((sum,row)=>sum+row.meta.rows_read,0),rowsWritten=body.result.reduce((sum,row)=>sum+row.meta.rows_written,0);
  const durationMs=body.result.reduce((sum,row)=>sum+(Number.isFinite(row.meta.duration)?Math.max(0,row.meta.duration):0),0);
  const confirmed={file:name,sha256:expectedHash,statements:count,rowsRead,rowsWritten,durationMs,requestMs:Math.max(0,now()-started)};
  totals.rowsRead+=rowsRead;totals.rowsWritten+=rowsWritten;totals.files++;totals.statements+=count;
  report.confirmed.push(confirmed);report.failed=null;await persist();
  log('TE_QUERY_CONFIRMED='+JSON.stringify(confirmed));
  // Give the shared database a breather after every acknowledged file.
  // This waits before NEW work; it never replays an uncertain write.
  gap=Math.min(5000,Math.max(1000,Math.ceil(durationMs*2)));
 }
 report.status='imported_not_parity_verified';await persist();
 }catch(error){report.status='incomplete';report.error=String(error?.message||error).startsWith('TE_QUERY_')?String(error.message).slice(0,500):'transport_or_local_failure';await persist();log('TE_QUERY_PARTIAL_METRICS='+JSON.stringify({status:report.status,totals,failed:report.failed}));throw error;}
 log('TE_QUERY_IMPORT_METRICS='+JSON.stringify(totals));return totals;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await importSeeds();
