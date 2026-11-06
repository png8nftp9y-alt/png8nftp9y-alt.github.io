// D1_WRITE_POLICY: incremental; invalidate affected receipts before domain writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {decodeReceipts,digest,planDelta,prefix,receiptFiles,sourceUnits} from '../lib/tennis-europe-import-delta.mjs';
import {importSeeds,validateFile} from './import-tennis-europe-query.mjs';
const dir='seed-tennis-europe-oop',load=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const fileHashes=files=>Object.fromEntries(Object.entries(files).map(([name,s])=>[name,digest(s)]));
async function source(){const files={},h=createHash('sha256');for(const n of (await fs.readdir(dir)).filter(n=>n.endsWith('.sql')).sort()){const s=await fs.readFile(path.join(dir,n),'utf8');files[n]=s;h.update(n+'\0'+s+'\0')}return {files,hash:h.digest('hex')};}
async function stage(folder,files){const target=path.join(dir,folder);await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});for(const [n,s]of Object.entries(files)){validateFile(s,n);await fs.writeFile(path.join(target,n),s);}}
async function execute(folder,expected){const target=path.join(dir,folder),names=(await fs.readdir(target)).filter(n=>n.endsWith('.sql')).sort();
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(expected).sort()))throw Error('TE_DELTA_PLAN_CHANGED');
 for(const n of names)if(digest(await fs.readFile(path.join(target,n),'utf8'))!==expected[n])throw Error('TE_DELTA_PLAN_CHANGED');
 if(names.length)await importSeeds({directory:target});
}
const action=process.argv[2];
if(action==='plan'){
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),databaseId=config.d1_databases?.find(d=>d.database_name==='courtwatch-app')?.database_id;if(!databaseId)throw Error('TE_DELTA_DB_MISSING');
 const metrics={requests:0,rowsRead:0};
 const {query}=await openReadOnlyD1({databaseId,onMetrics:rows=>{if(rows.length!==1||!Array.isArray(rows[0].results)||rows[0].meta?.rows_written!==0||!Number.isFinite(rows[0].meta?.rows_read))throw Error('TE_DELTA_INVALID_READ');metrics.requests++;metrics.rowsRead+=rows[0].meta.rows_read;}});
 const original=await source(),rows=[];let last='';
 // Keep each receipt response bounded. This reads metadata, not match tables.
 while(true){const page=await query('SELECT key,value FROM app_state WHERE key GLOB ? AND key>? ORDER BY key LIMIT 24',[prefix+'*',last]);
  if(page.length>24||page.some((r,i)=>typeof r.key!=='string'||r.key<=(i?page[i-1].key:last)))throw Error('TE_DELTA_RECEIPT_PAGE');rows.push(...page);if(rows.length>256)throw Error('TE_DELTA_RECEIPT_PAGE');if(page.length<24)break;last=page.at(-1).key;
 }
 const old=decodeReceipts(rows),plan=await planDelta(sourceUnits(original.files),old,query,{fullCheck:process.env.TE_DELTA_FULL_CHECK==='1'});
 const invalidate=receiptFiles(old,plan.invalidated),confirm=receiptFiles(plan.invalidated,plan.next);
 await stage('delta',plan.files);await stage('invalidate',invalidate);await stage('receipts',confirm);
 const report={id:randomUUID(),sourceHash:original.hash,delta:fileHashes(plan.files),invalidate:fileHashes(invalidate),receipts:fileHashes(confirm),stats:plan.stats,metrics};
 await fs.writeFile(path.join(dir,'delta-plan.json'),JSON.stringify(report,null,2)+'\n');
 console.log('TE_D1_DELTA='+JSON.stringify({...plan.stats,...metrics,receiptFiles:Object.keys(confirm).length}));
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`changed=${Object.keys(plan.files).length>0}\nverification_needed=${Object.keys(plan.files).length+Object.keys(confirm).length>0}\n`);
}else if(action==='import'||action==='confirm'){
 const p=await load('delta-plan.json');if((await source()).hash!==p.sourceHash)throw Error('TE_DELTA_SOURCE_CHANGED');
 if(action==='import'){await execute('invalidate',p.invalidate);await execute('delta',p.delta);}
 else{
  const proof=await load('verified-parity.json');if(proof.status!=='green'||proof.id!==p.id||proof.sourceHash!==p.sourceHash)throw Error('TE_DELTA_PARITY_REQUIRED');
  if(Object.keys(p.delta).length){const report=await load('delta/import-report.json'),confirmed=new Map(report.confirmed?.map(x=>[x.file,x.sha256]));
   if(report.status!=='imported_not_parity_verified'||report.failed||confirmed.size!==Object.keys(p.delta).length||Object.entries(p.delta).some(([n,h])=>confirmed.get(n)!==h))throw Error('TE_DELTA_IMPORT_REQUIRED');
  }
  await execute('receipts',p.receipts);console.log('TE_D1_DELTA_VERIFIED='+p.id);
 }
}else throw Error('TE_DELTA_ACTION');
