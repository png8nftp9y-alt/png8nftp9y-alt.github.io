import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {browserFactsheet} from './itf-metadata-browser.mjs';
import {factsheetMeta,tournamentFactSheetMeta,TODAY} from './itf-common.mjs';
const fields=['venueName','address','qualificationStartDate'];
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
export function futureMetadataTargets(catalogue,saved={},today=TODAY){
 return [...new Map((catalogue.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t])).values()].filter(t=>{
  const id=String(t.competitionId||'').toUpperCase();
  const qualifying=saved[id]?.qualificationStartDate||t.qualificationStartDate;
  return id&&validDate(t.startDate)&&t.startDate>today&&(!validDate(qualifying)||qualifying>today);
 });
}
export function enrichTournamentMetadata(catalogue,saved){
 return {...catalogue,tournaments:(catalogue.tournaments||[]).map(t=>{
  const row=saved[String(t.competitionId||'').toUpperCase()]||{},next={...t};
  for(const f of fields)if(row[f]&&(f!=='qualificationStartDate'||validDate(row[f])))next[f]=row[f];
  if(fields.some(f=>row[f]))next.factsheetMetadataSource='official_fact_sheet';
  return next;
 })};
}
export async function recoverMetadata(targets,existing,acquire,options={}){
 const metadata={...existing},failures=[],unavailable=[];
 const unique=[...new Map(targets.map(t=>[String(t.competitionId||'').toUpperCase(),t])).values()].filter(t=>t.competitionId);
 let acquired=0,processed=0,consecutiveFailures=0,stoppedReason='';
 const started=Date.now(),missing=row=>fields.filter(f=>!row?.[f]||(f==='qualificationStartDate'&&!validDate(row[f])));
 const snapshot=()=>({metadata,acquired,checked:unique.length,processed,remaining:unique.map(t=>({competitionId:String(t.competitionId).toUpperCase(),missing:missing(metadata[String(t.competitionId).toUpperCase()])})).filter(x=>x.missing.length),failures,unavailable,stoppedReason});
 await options.onCheckpoint?.(snapshot());
 for(const t of unique){
  if(options.maxElapsedMs&&Date.now()-started>=options.maxElapsedMs){stoppedReason='time_budget_exhausted';break;}
  const id=String(t.competitionId).toUpperCase(),previous=metadata[id]||{},begin=Date.now();
  await options.onProgress?.({phase:'start',competitionId:id,processed,total:unique.length,acquired});
  let status='reused',error='';
  if(missing(previous).length){
   let result={};
   try{result=await acquire(t)||{};}catch(e){error=String(e.message||'factsheet_acquisition_failed').split('\n')[0].slice(0,100);}
   const next={...previous};
   for(const f of fields){const v=typeof result[f]==='string'?result[f].trim():'';if(v&&(f!=='qualificationStartDate'||validDate(v)))next[f]=v;}
   const usable=fields.some(f=>typeof result[f]==='string'&&result[f].trim()&&(f!=='qualificationStartDate'||validDate(result[f])));
   if(fields.some(f=>next[f]!==previous[f])){metadata[id]={...next,competitionId:id,sourceUrl:t.sourceUrl||previous.sourceUrl||'',sourceField:'official_fact_sheet',observedAt:new Date().toISOString()};acquired++;status='acquired';}
   else status=usable?'partial_unchanged':'failed';
   if(usable)consecutiveFailures=0;
   else if(result._factsheetStatus==='not_public'){consecutiveFailures=0;status='source_unavailable';unavailable.push({competitionId:id,reason:'factsheet_not_public',sourceUrl:result._factsheetSourceUrl,observedAt:new Date().toISOString()});}
   else{consecutiveFailures++;failures.push({competitionId:id,error:error||'factsheet_no_usable_fields'});}
  }
  processed++;
  await options.onProgress?.({phase:'finish',competitionId:id,processed,total:unique.length,status,error,elapsedMs:Date.now()-begin,acquired,consecutiveFailures});
  if(options.maxConsecutiveFailures&&consecutiveFailures>=options.maxConsecutiveFailures)stoppedReason='consecutive_unproductive_reads';
  await options.onCheckpoint?.(snapshot());
  if(stoppedReason)break;
 }
 const result=snapshot();await options.onCheckpoint?.(result);return result;
}
export async function acquire(t,fetcher=fetch){
 const url=String(process.env.ITF_FACTSHEET_ACQUISITION_URL||process.env.ITF_ACQUISITION_URL||'').trim().replace(/\/v1\/fetch\/?$/i,'/v1/factsheet'),token=String(process.env.ITF_FACTSHEET_ACQUIRER_TOKEN||process.env.ITF_ACQUIRER_TOKEN||'').trim();
 if(url&&token){
  const response=await fetcher(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({url:t.sourceUrl}),signal:AbortSignal.timeout(35000)});
  if(!response.ok)throw Error('factsheet_http_'+response.status);
  const data=await response.json();
  if(!data.ok||data.responseKind!=='rendered_text'||!data.text)throw Error('factsheet_'+String(data.responseKind||'invalid_response').replace(/[^a-z_]/gi,'').slice(0,50));
  return tournamentFactSheetMeta(data.text);
 }
 const result=await factsheetMeta(t);
 if(!fields.some(f=>result?.[f]))throw Error('factsheet_no_official_fields');
 return result;
}

export function storedMetadata(doc){
 const out={};
 function visit(x){
  if(Array.isArray(x)){for(const v of x)visit(v);return;}
  if(!x||typeof x!=='object')return;
  const id=String(x.competitionId||'').toUpperCase();
  if(id.startsWith('J-')){
   const row=out[id]||{};
   for(const f of fields){const v=typeof x[f]==='string'?x[f].trim():'';if(v&&(f!=='qualificationStartDate'||validDate(v)))row[f]=v;}
   if(x.clubName&&!row.venueName)row.venueName=x.clubName;
   out[id]=row;
  }
  for(const [k,v]of Object.entries(x)){
   if(k.toUpperCase().startsWith('J-')&&v&&typeof v==='object'&&!Array.isArray(v))visit({...v,competitionId:k});
   else visit(v);
  }
 }
 visit(doc);return out;
}
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,d)=>{await fs.mkdir(p.slice(0,p.lastIndexOf('/')),{recursive:true});await fs.writeFile(p+'.tmp',JSON.stringify(d,null,2)+'\n');await fs.rename(p+'.tmp',p);};
async function collect(){
 const shard=Number(process.env.ITF_METADATA_SHARD||0),total=Number(process.env.ITF_METADATA_TOTAL||8);
 const paths=['history/itf_player_tournament_db.json','history/itf_historical_player_tournaments.json','history/itf_draw_target_db.json','dist/v3/tournaments.json','history/itf_official_metadata.json'];
 const saved={};
 for(const p of paths){let d;try{d=await read(p)}catch{continue}for(const [id,row]of Object.entries(storedMetadata(d)))saved[id]={...saved[id],...row};}
 const catalogue=await read('dist/v3/source_itf_tournaments.json');
 const targets=futureMetadataTargets(catalogue,saved);
 console.log('ITF_METADATA_SCOPE='+JSON.stringify({scope:'not_started_itf_tournaments',today:TODAY,catalogue:catalogue.tournaments.length,targeted:targets.length,shard}));
 const number=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 const selected=targets.filter(t=>number(String(t.competitionId).toUpperCase())%total===shard);
 let context;
 let acquireSelected=acquire;
 if(process.env.ITF_METADATA_BROWSER==='1'&&selected.some(t=>fields.some(f=>!saved[String(t.competitionId).toUpperCase()]?.[f]))){
  const require=createRequire(new URL('../../infra/itf-acquirer/package.json',import.meta.url));
  const {chromium}=require('playwright');
  context=await chromium.launchPersistentContext('',{headless:true,locale:'en-GB',timezoneId:'Europe/Rome'});
  acquireSelected=t=>browserFactsheet(context,t);
 }
 let result;
 try{result=await recoverMetadata(selected,saved,acquireSelected,{
  maxConsecutiveFailures:5,maxElapsedMs:15*60*1000,
  onProgress:p=>console.log('ITF_METADATA_PROGRESS='+JSON.stringify({shard,...p})),
  onCheckpoint:d=>write('dist/v3/shards/itf-metadata/meta-'+shard+'.json',{shard,total,...d,metadata:Object.fromEntries(Object.entries(d.metadata).filter(([id])=>selected.some(t=>String(t.competitionId).toUpperCase()===id)))})
 });}finally{await context?.close();}
 const ids=new Set(selected.map(t=>String(t.competitionId).toUpperCase()));
 const metadata=Object.fromEntries(Object.entries(result.metadata).filter(([id])=>ids.has(id)));
 await write('dist/v3/shards/itf-metadata/meta-'+shard+'.json',{shard,total,checked:result.checked,acquired:result.acquired,metadata,remaining:result.remaining,failures:result.failures,unavailable:result.unavailable,processed:result.processed,stoppedReason:result.stoppedReason});
 console.log('ITF_METADATA_SHARD='+JSON.stringify({shard,checked:result.checked,processed:result.processed,acquired:result.acquired,remaining:result.remaining.length,stoppedReason:result.stoppedReason}));
 if(result.stoppedReason)process.exitCode=2;
}
async function merge(){
 const old=await read('history/itf_official_metadata.json'),all={...(old.tournaments||{})},remaining=[],failures=[],unavailable=[];let checked=0,acquired=0;
 const names=(await fs.readdir('/tmp/itf-metadata')).filter(n=>/^meta-\d+\.json$/.test(n));
 if(names.length!==8)throw Error('Missing metadata shard: '+names.length+'/8; archive unchanged');
 for(const name of names){
  const d=await read('/tmp/itf-metadata/'+name);checked+=d.checked;acquired+=d.acquired;remaining.push(...d.remaining);failures.push(...(d.failures||[]));unavailable.push(...(d.unavailable||[]));
  for(const[id,row]of Object.entries(d.metadata)){
   const prev=all[id]||{},next={...prev};
   for(const[field,value]of Object.entries(row))if(value)next[field]=value;
   all[id]=next;
  }
 }
 const now=new Date().toISOString();
 await write('history/itf_official_metadata.json',{...old,updatedAt:now,tournaments:all});
 const catalogue=await read('dist/v3/source_itf_tournaments.json');
 await write('dist/v3/source_itf_tournaments.json',enrichTournamentMetadata(catalogue,all));
 await write('dist/v3/itf_tournament_metadata_diagnostics.json',{generatedAt:now,scope:'not_started_itf_tournaments',asOf:TODAY,status:remaining.length?'incomplete':'complete',checked,acquired,remaining,failures,unavailable});
 await fs.appendFile('docs/CourtWatch_v3_handoff_report.md','\nFuture ITF factsheet metadata '+now+': '+JSON.stringify({checked,acquired,remaining:remaining.length})+'. Only not-started tournaments targeted (known qualifying dates take precedence); archived metadata preserved; discovery catalogue enriched; unresolved fields explicit.\n');
 console.log('ITF_METADATA_GLOBAL='+JSON.stringify({checked,acquired,remaining:remaining.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await(process.argv.includes('--merge')?merge():collect());

