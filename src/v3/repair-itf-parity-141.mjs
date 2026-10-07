import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {documentRecord,documentSQL,verifyDocument,sqlString} from './itf-draw-document-d1.mjs';
import {prepareResume} from './resume-itf-resolved-parity.mjs';
// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan contract: immutable versions, conflict DO NOTHING, no replacement/deletion.

export async function findFile(root,name){
 const found=[];
 async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())await walk(p);else if(item.name===name)found.push(p)}}
 await walk(root);if(found.length!==1)throw Error('Expected one artifact file: '+name);return found[0];
}
export function repairTargets(scope,selection,failed){
 if(scope.resumedFromRun!==37696656152||scope.wanted?.length!==4892||selection.documents?.length!==4892||scope.userExcludedDraws?.map(x=>x.drawKey).sort().join(',')!==['J-J200-TUR-2026-002|G-S-Q-KO','J-J30-ALG-2026-004|G-S-Q-KO'].sort().join(','))throw Error('Unexpected resumed scope');
 if(failed.status!=='failed'||failed.expectedDocuments!==4892||failed.verifiedDocuments!==4751||failed.missingOrCorrupt?.length!==141||new Set(failed.missingOrCorrupt.map(x=>x.drawKey)).size!==141)throw Error('Unexpected failed audit; review cohort before repair');
 const map=new Map(selection.documents.map(d=>[d.drawKey,d]));
 if(map.size!==4892||scope.wanted.some(x=>!map.has(x.drawKey)))throw Error('Selection differs from frozen scope');
 return failed.missingOrCorrupt.map(x=>{
  const d=map.get(x.drawKey);
  if(!d||x.error!=='Missing D1 document: '+x.drawKey||!x.drawKey.startsWith('J-J100-'))throw Error('Unexpected failed document: '+x.drawKey);
  return d;
 });
}

export async function exactSources(targets,roots){
 const wanted=new Map(targets.map(d=>[d.drawKey,d])),found=new Map();
 async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){await walk(file);continue}if(!item.name.endsWith('.json.gz'))continue;
  const doc=JSON.parse(gunzipSync(await fs.readFile(file))),key=String(doc.competitionId||'').toUpperCase()+'|'+doc.event,expected=wanted.get(key);
  if(!expected)continue;
  const record=documentRecord(doc);
  if(record?.sha256!==expected.sha256)continue;
  for(const field of ['drawKey','competitionId','event','bytes','chunkCount','playerCount','matchCount','observedAt','acquisitionState'])if(record[field]!==expected[field])throw Error('Source metadata differs: '+key+' '+field);
  found.set(key,record);
 }}
 for(const root of roots)await walk(root);
 return found;
}

export function classifyExisting(expected,rows){
 const exact=rows.filter(d=>d.content_sha256===expected.sha256);
 if(exact.some(d=>d.acquisition_state==='complete'))return 'exact_complete_present';
 if(exact.length)return 'exact_saved_non_complete';
 return rows.length?'other_version_present':'draw_document_absent';
}

export function assertNoConflict(expected,source,headers,chunks){
 for(const row of headers.filter(d=>d.content_sha256===expected.sha256)){
  for(const [col,key] of [['chunk_count','chunkCount'],['content_bytes','bytes'],['player_count','playerCount'],['match_count','matchCount']])if(Number(row[col])!==expected[key])throw Error('Conflicting existing metadata; no overwrite: '+expected.drawKey);
 }
 const seen=new Set();
 for(const chunk of chunks){
  if(!Number.isInteger(chunk.chunk_index)||seen.has(chunk.chunk_index)||source.chunks[chunk.chunk_index]!==chunk.content)throw Error('Conflicting existing chunk; no overwrite: '+expected.drawKey);
  seen.add(chunk.chunk_index);
 }
}

async function query(sql){
 const config=JSON.parse(await fs.readFile('cloudflare/app-api/wrangler.generated.jsonc','utf8'));
 const id=config.d1_databases.find(x=>x.binding==='DB')?.database_id;
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});
 const body=await response.json();if(!response.ok||body.success!==true||body.result?.[0]?.success!==true)throw Error('D1 diagnostic read failed: HTTP '+response.status);
 return body.result[0].results;
}

async function prepare(original,failedRoot){
 const read=async(root,name)=>JSON.parse(await fs.readFile(await findFile(root,name),'utf8'));
 const resume=prepareResume(await read(original,'itf-resolved-parity-scope.json'),await read(original,'itf-draw-d1-sync.json'));
 const oldScope=await read(failedRoot,'itf-resolved-parity-scope.json'),oldSelection=await read(failedRoot,'itf-draw-d1-sync.json');
 if(JSON.stringify(oldScope.wanted)!==JSON.stringify(resume.scope.wanted)||JSON.stringify(oldSelection.documents)!==JSON.stringify(resume.selection.documents))throw Error('Failed audit differs from original R2 selection');
 const targets=repairTargets(oldScope,oldSelection,await read(failedRoot,'itf-draw-d1-content-verification.json'));
 await fs.mkdir('dist/v3/audits',{recursive:true});
 await fs.writeFile('dist/v3/audits/itf-resolved-parity-scope.json',JSON.stringify(oldScope,null,2)+'\n');
 await fs.writeFile('dist/v3/audits/itf-draw-d1-sync.json',JSON.stringify(oldSelection,null,2)+'\n');
 await fs.writeFile('dist/v3/audits/itf-parity-repair-targets.json',JSON.stringify({sourceRun:37702531693,originalSourceRun:37696656152,targets},null,2)+'\n');
 const manifest=await read(original,'itf-manifest.json');
 if(!/^[a-f0-9]{64}$/.test(manifest.generation))throw Error('Invalid original R2 archive generation');
 await fs.writeFile('/tmp/itf-manifest.json',JSON.stringify(manifest));
 await fs.copyFile(await findFile(original,'itf-resolved-parity-live-selection.json'),'/tmp/itf-original-live-selection.json');
 console.log(JSON.stringify({repairTargets:targets.length,fullVerificationDocuments:oldSelection.documents.length,archiveGeneration:manifest.generation}));
}

async function main(){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='prepare'){await prepare(...args);return}
 const {targets}=JSON.parse(await fs.readFile('dist/v3/audits/itf-parity-repair-targets.json','utf8'));
 if(mode==='missing-sources'){
  const found=await exactSources(targets,args),missing=targets.filter(x=>!found.has(x.drawKey));
  await fs.writeFile('/tmp/itf-repair-live-needed.json',JSON.stringify(missing));
  console.log(JSON.stringify({exactSourcesInArchive:found.size,remainingLiveSources:missing.length}));return;
 }
 if(mode!=='stage')throw Error('Use prepare, missing-sources or stage');
 const sources=await exactSources(targets,args),missing=targets.filter(x=>!sources.has(x.drawKey));
 if(missing.length)throw Error('Exact R2 versions missing; no SQL created: '+JSON.stringify(missing.map(x=>x.drawKey)));
 const report={sourceRun:37702531693,targetCount:targets.length,records:[],noExistingRowsOverwritten:true};
 const pending=[];
 for(const d of targets){
  const q=sqlString;
  const headers=await query(`SELECT *, 'complete' AS acquisition_state FROM itf_draw_documents WHERE draw_key=${q(d.drawKey)} UNION ALL SELECT *, 'saved_non_complete' AS acquisition_state FROM itf_draw_unverified_documents WHERE draw_key=${q(d.drawKey)}`);
  const chunks=await query(`SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=${q(d.drawKey)} AND content_sha256=${q(d.sha256)} ORDER BY chunk_index`);
  const source=sources.get(d.drawKey);assertNoConflict(d,source,headers,chunks);
  const header=headers.find(x=>x.content_sha256===d.sha256&&x.acquisition_state==='complete');
  let verified=false;try{verifyDocument(d,header,chunks);verified=true}catch{}
  report.records.push({drawKey:d.drawKey,expectedSha256:d.sha256,diagnosis:classifyExisting(d,headers),otherVersionCount:headers.filter(x=>x.content_sha256!==d.sha256).length,alreadyVerified:verified,action:verified?'skip_identical':'insert_missing_immutable_version'});
  if(!verified)pending.push(source);
  if(report.records.length%20===0)console.log(`ITF_REPAIR_PREFLIGHT=${report.records.length}/${targets.length}`);
 }
 // Preflight ALL sources and existing chunks before producing any SQL.
 await fs.rm('seed-itf-parity-repair',{recursive:true,force:true});await fs.mkdir('seed-itf-parity-repair');
 let batch='',index=0;
 const flush=async()=>{if(batch){await fs.writeFile(`seed-itf-parity-repair/${String(index++).padStart(4,'0')}.sql`,batch);batch=''}};
 for(const source of pending)for(const sql of documentSQL(source)){if(batch&&Buffer.byteLength(batch+sql)>256*1024)await flush();batch+=sql+'\n'}
 await flush();
 report.insertVersions=pending.length;
 await fs.writeFile('dist/v3/audits/itf-parity-repair-plan.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({targets:targets.length,insertVersions:pending.length,alreadyVerified:targets.length-pending.length,diagnoses:report.records.reduce((a,x)=>(a[x.diagnosis]=(a[x.diagnosis]||0)+1,a),{})}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
