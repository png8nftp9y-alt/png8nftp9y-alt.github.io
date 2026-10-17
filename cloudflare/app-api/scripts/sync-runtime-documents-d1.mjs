// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan in runtime-document-plan.mjs.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {RUNTIME_DOCUMENT_FILES,encodeDocument,decodeDocument,versionStatements,releasePlan} from '../lib/runtime-document-plan.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('runtime_d1_credentials_missing');
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
async function cf(path,body){const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const result=await response.json();if(!response.ok||!result.success)throw Error('runtime_d1_request_failed:'+response.status);return result.result;}
const db=(await cf('?name=courtwatch-app&per_page=100')).find(d=>d.name==='courtwatch-app');
if(!db)throw Error('Existing database required; no database created');
const metrics={rowsRead:0,rowsWritten:0};
async function query(sql,params=[]){const results=await cf('/'+(db.uuid||db.id)+'/query',{sql,params});if(!results.every(r=>r.success))throw Error('runtime_d1_sql_failed');for(const r of results){metrics.rowsRead+=Number(r.meta?.rows_read||0);metrics.rowsWritten+=Number(r.meta?.rows_written||0);}return results.flatMap(r=>r.results||[]);}
const documents=[];
// Validate the ENTIRE scope before creating schema or writing content.
for(const path of RUNTIME_DOCUMENT_FILES)documents.push(encodeDocument(path,JSON.parse(await fs.readFile(root+path,'utf8'))));
const previous=(await query("SELECT value FROM app_state WHERE key='runtimeDocumentRelease'"))[0]?.value||null;
if(previous){const old=JSON.parse(previous);if(old.sourceCommit!==sourceCommit){try{execFileSync('git',['merge-base','--is-ancestor',old.sourceCommit,sourceCommit],{cwd:root,stdio:'pipe'});}catch{throw Error('Runtime source is older or ancestry unavailable; publication blocked');}}}
await query('CREATE TABLE IF NOT EXISTS runtime_document_chunks(path TEXT NOT NULL,content_hash TEXT NOT NULL,seq INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(path,content_hash,seq)) WITHOUT ROWID');
const plan=releasePlan(documents,sourceCommit,previous);
let insertedVersions=0,unchangedVersions=0;
for(const d of documents){
 const stored=await query('SELECT seq,data FROM runtime_document_chunks WHERE path=? AND content_hash=? ORDER BY seq',[d.path,d.hash]);
 const existing=stored.length?stored.map(r=>r.data):null;
 // A partial immutable version can resume only when every stored chunk agrees.
 if(existing&&stored.some(r=>d.chunks[r.seq]!==r.data))throw Error('Immutable runtime chunk conflict:'+d.path);
 const complete=existing&&stored.length===d.chunks.length;
 if(complete){decodeDocument({...d,chunks:d.chunks.length},existing);unchangedVersions++;}
 else{for(const sql of versionStatements(d,null))await query(sql);insertedVersions++;}
 const check=await query('SELECT seq,data FROM runtime_document_chunks WHERE path=? AND content_hash=? ORDER BY seq',[d.path,d.hash]);
 decodeDocument({...d,chunks:d.chunks.length},check.map(r=>r.data));
}
// Publish one release pointer only AFTER every document's full-content readback.
for(const sql of plan.sql)await query(sql);
const actual=(await query("SELECT value FROM app_state WHERE key='runtimeDocumentRelease'"))[0]?.value;
const expected=plan.changed?plan.value:previous;if(actual!==expected)throw Error('Runtime release pointer conflict');
const report={status:'verified',sourceCommit,verifiedDocuments:documents.length,insertedVersions,unchangedVersions,releaseChanged:plan.changed,metrics,documents:plan.manifest,cutoverEnabled:false};
await fs.mkdir(root+'dist/v3/audits',{recursive:true});await fs.writeFile(root+'dist/v3/audits/runtime-documents-d1.json',JSON.stringify(report,null,2)+'\n');
console.log('RUNTIME_DOCUMENTS_D1='+JSON.stringify(report));
