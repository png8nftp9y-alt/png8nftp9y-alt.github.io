// D1_READ_ONLY: guarded. One comparison, no mutation, acquisition or retry.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {openReadOnlyD1} from '../cloudflare/app-api/lib/read-only-d1-client.mjs';
import {VOLATILE} from '../cloudflare/app-api/scripts/github-d1-reconciliation.mjs';
const TOURNAMENTS=['tournament_38d3e1481f0bcdac50d9da9c','tournament_itf_90e2570a21c27c2cbc20f1b0'];
const metadataKeys=new Set([...VOLATILE,'lastObservedAt','sourceObservedAt','_itfDrawObservedAt']);
export function fieldDifferences(github,d1){
 const changes=[];
 const walk=(a,b,parts=[],hasA=true,hasB=true)=>{
  if(hasA&&hasB&&Object.is(a,b))return;
  const object=x=>x!==null&&typeof x==='object';
  if(hasA&&hasB&&object(a)&&object(b)&&Array.isArray(a)===Array.isArray(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],[...parts,key],Object.hasOwn(a,key),Object.hasOwn(b,key));return;
  }
  changes.push({path:parts.join('.'),kind:metadataKeys.has(parts.at(-1))?'observation_metadata':'data',github:{present:hasA,value:hasA?a:null},d1:{present:hasB,value:hasB?b:null}});
 };walk(github,d1);return changes;
}
export function compareRecords(ids,githubRows,d1Rows){
 const gh=new Map(githubRows.map(r=>[r.id,r])),db=new Map(d1Rows.map(r=>[r.id,typeof r.payload==='string'?JSON.parse(r.payload):r.payload]));
 return ids.map(id=>{const a=gh.get(id),b=db.get(id);if(!a||!b)return{id,status:!a?'not_in_current_github':'missing_in_d1',presentInGithub:!!a,presentInD1:!!b};
  const changes=fieldDifferences(a,b),data=changes.filter(c=>c.kind==='data');
  return{id,name:a.name||'',circuit:a.circuit||'',status:!changes.length?'identical':data.length?'data_differences':'observation_metadata_only',changes};
 });
}
async function main(){
 const root=fileURLToPath(new URL('../',import.meta.url)),report={status:'running',writes:0,baselineRun:39168670150,startedAt:new Date().toISOString()};
 try{
  const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
  const baseline=await read(process.argv[2]),ids=baseline.projections?.entries?.different;
  if(!Array.isArray(ids)||ids.length!==515||new Set(ids).size!==515)throw Error('unexpected_515_baseline_scope');
  report.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const entries=(await read(root+'dist/v3/universal/entries.json')).entries,tournaments=(await read(root+'dist/v3/universal/tournaments.json')).tournaments;
  const {query}=await openReadOnlyD1();
  const marker=async()=>JSON.stringify(await query("SELECT generated_at,counts_json FROM generations WHERE id='current'"));const before=await marker();
  const rows=async(table,wanted)=>{const out=[];for(let i=0;i<wanted.length;i+=20){const batch=wanted.slice(i,i+20);out.push(...await query(`SELECT id,payload FROM ${table} WHERE id IN (${batch.map(()=>'?').join(',')})`,batch));}return out;};
  report.entries=compareRecords(ids,entries,await rows('entries',ids));report.tournaments=compareRecords(TOURNAMENTS,tournaments,await rows('tournaments',TOURNAMENTS));
  report.concurrentGenerationChanged=before!==await marker();
  report.summary={};for(const [table,records]of [['entries',report.entries],['tournaments',report.tournaments]]){
   const counts={},fields={};for(const record of records){counts[record.status]=(counts[record.status]||0)+1;for(const change of record.changes||[])fields[change.path]=(fields[change.path]||0)+1;}
   report.summary[table]={compared:records.length,counts,fields};
  }
  report.status=report.concurrentGenerationChanged?'concurrent_update':Object.values(report.summary).some(s=>Object.keys(s.counts).some(k=>!['identical','observation_metadata_only'].includes(k)))?'needs_review':'no_data_differences';
  if(report.status!=='no_data_differences')process.exitCode=2;
 }catch(error){report.status='error';report.error=error.message;process.exitCode=1;}
 finally{report.finishedAt=new Date().toISOString();await fs.mkdir(root+'dist/v3/audits',{recursive:true});await fs.writeFile(root+'dist/v3/audits/d1-record-differences.json',JSON.stringify(report,null,2)+'\n');console.log('D1_RECORD_DIFFERENCES='+JSON.stringify({status:report.status,error:report.error,summary:report.summary,tournaments:report.tournaments,writes:0,concurrentGenerationChanged:report.concurrentGenerationChanged}));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
