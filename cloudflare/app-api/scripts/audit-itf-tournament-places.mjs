// D1_READ_ONLY: guarded; public tournament metadata only, no player data.
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {fetchTournamentPresentation,mergeTournamentPresentation} from '../lib/personal-tournament-presentation.mjs';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function auditPlaces(rows,presentation,today){
 const groups={past:[],ongoing:[],future:[]};
 for(const row of rows){
  const t=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const id=String(row.source_tournament_id||t.competitionId||t.sourceTournamentId||'').toUpperCase();
  if(!id)throw Error('ITF tournament identity absent');
  const original={...t,circuit:'itf',competitionId:id},effective=mergeTournamentPresentation(original,presentation.get('itf|'+id)||{});
  const missing=x=>['location','venueName'].filter(k=>!String(x[k]||'').trim()||/da confermare|da pubblicare|^(?:TBC|TBD)$/i.test(x[k]));
  const phase=effective.endDate&&effective.endDate<today?'past':effective.startDate>today?'future':'ongoing';
  groups[phase].push({competitionId:id,name:t.name||t.tournamentName||'',storedMissing:missing(original),effectiveMissing:missing(effective),location:effective.location||'',venueName:effective.venueName||'',hostNationCode:t.hostNationCode||'',startDate:effective.startDate||'',endDate:effective.endDate||''});
 }
 const all=Object.values(groups).flat(),storedIds=new Set(all.map(t=>t.competitionId)),catalogueIds=[...presentation.keys()].filter(k=>k.startsWith('itf|')).map(k=>k.slice(4));
 return {generatedAt:new Date().toISOString(),scope:'All canonical ITF D1 tournaments; same exact-ID presentation merge used by player and opponent APIs',writes:0,total:all.length,catalogueTournaments:catalogueIds.length,catalogueNotStored:catalogueIds.filter(id=>!storedIds.has(id)),
  counts:Object.fromEntries(Object.entries(groups).map(([phase,list])=>[phase,{total:list.length,storedIncomplete:list.filter(t=>t.storedMissing.length).length,effectiveIncomplete:list.filter(t=>t.effectiveMissing.length).length}])),
  effectiveComplete:all.filter(t=>!t.effectiveMissing.length).length,missing:all.filter(t=>t.effectiveMissing.length),restoredByPresentation:all.filter(t=>t.storedMissing.length&&!t.effectiveMissing.length).map(t=>t.competitionId)};
}
const placeFields=['competitionId','sourceTournamentId','name','tournamentName','location','city','venueName','clubName','club','startDate','endDate','qualificationStartDate','officialStartDate','hostNationCode'];
export const ITF_PLACES_PAGE_SQL="SELECT id,source_tournament_id,json_object("+placeFields.map(k=>`'${k}',json_extract(payload,'$.${k}')`).join(',')+") AS payload FROM tournaments WHERE circuit='itf' AND id>? ORDER BY id LIMIT 100";
const temporaryInternal=error=>/^diagnostic_d1_request_failed:http_500:codes_(?:[0-9]+,)*7500(?:,[0-9]+)*$/.test(String(error?.message||''));
// Bounded recovery of one failed SELECT. Never restart the audit or a workflow.
export async function readItfAuditRows(query,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),stats={requests:0,retries:0,pages:0,rows:0,cursor:''}}={}){
 const rows=[];let cursor='';
 for(;;){
  let batch;
  for(let attempt=0;;attempt++){
   try{stats.requests++;batch=await query(ITF_PLACES_PAGE_SQL,[cursor]);break;}
   catch(error){if(attempt>=2||!temporaryInternal(error))throw error;stats.retries++;await wait([200,600][attempt]);}
  }
  if(!Array.isArray(batch)||batch.length>100||batch.some((row,i)=>typeof row.id!=='string'||row.id<=(i?batch[i-1].id:cursor)))throw Error('itf_audit_invalid_page');
  if(!batch.length)break;
  rows.push(...batch);cursor=batch.at(-1).id;Object.assign(stats,{pages:stats.pages+1,rows:rows.length,cursor});
 }
 if(!rows.length)throw Error('itf_audit_empty_source');
 return rows;
}
const safeFailure=error=>/^(?:diagnostic_[a-z0-9_:,]+|itf_audit_[a-z0-9_]+)$/.test(String(error?.message||''))?error.message:'itf_places_audit_failed';
async function writeAuditReport(report){await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-tournament-places.json',JSON.stringify(report,null,2)+'\n');}
export async function runPlacesAudit({openClient=openReadOnlyD1,readJson=async rel=>JSON.parse(await fs.readFile(rel,'utf8')),writeReport=writeAuditReport,wait,today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})}={}){
 let stage='open_d1';const stats={requests:0,retries:0,pages:0,rows:0,cursor:''};
 try{
  const client=await openClient();stage='read_itf_tournaments';
  const rows=await readItfAuditRows((sql,params)=>client.query(sql,params),{wait,stats});
  stage='load_presentation';const sources=[];
  const presentation=await fetchTournamentPresentation('itf',async url=>{const rel=new URL(url).pathname.slice(1);if(!rel)throw Error('itf_audit_invalid_metadata_path');const data=await readJson(rel);sources.push(rel);return {ok:true,json:async()=>data};});
  if(sources.length!==4)throw Error('itf_audit_incomplete_sources');
  stage='build_report';const report={...auditPlaces(rows,presentation,today),status:'complete',complete:true,read:stats};
  await writeReport(report);return report;
 }catch(error){
  await writeReport({generatedAt:new Date().toISOString(),status:'unavailable',complete:false,writes:0,stage,read:stats,error:safeFailure(error)});
  throw error;
 }
}
async function main(){const report=await runPlacesAudit();console.log('ITF_PLACES_AUDIT='+JSON.stringify(report));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
