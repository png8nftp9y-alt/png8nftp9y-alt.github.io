import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {factsheetMeta,tournamentFactSheetMeta} from './itf-common.mjs';
const fields=['venueName','address','qualificationStartDate'];
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
export async function recoverMetadata(targets,existing,acquire){
 const metadata={...existing},remaining=[],failures=[];let acquired=0,index=0;
 const unique=[...new Map(targets.map(t=>[String(t.competitionId||'').toUpperCase(),t])).values()].filter(t=>t.competitionId);
 await Promise.all(Array.from({length:Math.min(1,unique.length)},async()=>{
  while(index<unique.length){
   const t=unique[index++],id=String(t.competitionId).toUpperCase(),previous=metadata[id]||{};
   if(fields.every(f=>previous[f])&&validDate(previous.qualificationStartDate))continue;
   let result={};try{result=await acquire(t)||{}}catch(error){failures.push({competitionId:id,error:String(error.message||'factsheet_acquisition_failed').slice(0,100)});}
   const next={...previous};
   for(const f of fields){const value=typeof result[f]==='string'?result[f].trim():'';if(value&&(f!=='qualificationStartDate'||validDate(value)))next[f]=value;}
   if(fields.some(f=>next[f]!==previous[f])){
    metadata[id]={...next,competitionId:id,sourceUrl:t.sourceUrl||previous.sourceUrl||'',sourceField:'official_fact_sheet',observedAt:new Date().toISOString()};acquired++;
   }
   const saved=metadata[id]||previous,missing=fields.filter(f=>!saved[f]||(f==='qualificationStartDate'&&!validDate(saved[f])));
   if(missing.length)remaining.push({competitionId:id,missing});
  }
 }));
 return {metadata,acquired,checked:unique.length,remaining,failures};
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
const write=async(p,d)=>{await fs.mkdir(p.slice(0,p.lastIndexOf('/')),{recursive:true});await fs.writeFile(p,JSON.stringify(d,null,2)+'\n');};
async function collect(){
 const shard=Number(process.env.ITF_METADATA_SHARD||0),total=Number(process.env.ITF_METADATA_TOTAL||8);
 const paths=['history/itf_player_tournament_db.json','history/itf_historical_player_tournaments.json','history/itf_draw_target_db.json','dist/v3/tournaments.json','history/itf_official_metadata.json'];
 const saved={};
 for(const p of paths){let d;try{d=await read(p)}catch{continue}for(const [id,row]of Object.entries(storedMetadata(d)))saved[id]={...saved[id],...row};}
 const catalogues=await Promise.all(['dist/v3/source_itf_history_tournaments.json','dist/v3/source_itf_tournaments.json'].map(read));
 const targets=[...new Map(catalogues.flatMap(d=>d.tournaments||[]).map(t=>[String(t.competitionId).toUpperCase(),t])).values()];
 const number=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 const selected=targets.filter(t=>number(String(t.competitionId).toUpperCase())%total===shard);
 const result=await recoverMetadata(selected,saved,acquire);
 const ids=new Set(selected.map(t=>String(t.competitionId).toUpperCase()));
 const metadata=Object.fromEntries(Object.entries(result.metadata).filter(([id])=>ids.has(id)));
 await write('dist/v3/shards/itf-metadata/meta-'+shard+'.json',{shard,total,checked:result.checked,acquired:result.acquired,metadata,remaining:result.remaining,failures:result.failures});
 console.log('ITF_METADATA_SHARD='+JSON.stringify({shard,checked:result.checked,acquired:result.acquired,remaining:result.remaining.length}));
}
async function merge(){
 const old=await read('history/itf_official_metadata.json'),all={...(old.tournaments||{})},remaining=[],failures=[];let checked=0,acquired=0;
 const names=(await fs.readdir('/tmp/itf-metadata')).filter(n=>/^meta-\d+\.json$/.test(n));
 if(names.length!==8)throw Error('Missing metadata shard: '+names.length+'/8; archive unchanged');
 for(const name of names){
  const d=await read('/tmp/itf-metadata/'+name);checked+=d.checked;acquired+=d.acquired;remaining.push(...d.remaining);failures.push(...(d.failures||[]));
  for(const[id,row]of Object.entries(d.metadata)){
   const prev=all[id]||{},next={...prev};
   for(const[field,value]of Object.entries(row))if(value)next[field]=value;
   all[id]=next;
  }
 }
 const now=new Date().toISOString();
 await write('history/itf_official_metadata.json',{...old,updatedAt:now,tournaments:all});
 await write('dist/v3/itf_tournament_metadata_diagnostics.json',{generatedAt:now,scope:'all_official_itf_tournaments',status:remaining.length?'incomplete':'complete',checked,acquired,remaining,failures});
 await fs.appendFile('docs/CourtWatch_v3_handoff_report.md','\nGlobal ITF metadata '+now+': '+JSON.stringify({checked,acquired,remaining:remaining.length})+'. Existing metadata reused; only missing official factsheet fields acquired; unresolved records retained explicitly.\n');
 console.log('ITF_METADATA_GLOBAL='+JSON.stringify({checked,acquired,remaining:remaining.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await(process.argv.includes('--merge')?merge():collect());
