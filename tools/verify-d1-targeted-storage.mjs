// D1_READ_ONLY: guarded. No imports, migrations, acquisitions or retries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {openReadOnlyD1} from '../cloudflare/app-api/lib/read-only-d1-client.mjs';
import {runtimeDocumentReader} from '../cloudflare/app-api/lib/runtime-document-reader.mjs';
import {documentRecord,verifyDocument} from '../src/v3/itf-draw-document-d1.mjs';
export const TARGETS=['J-J30-LTU-2026-003|B-S-Q-KO','J-J30-LTU-2026-003|G-S-Q-KO','J-J60-ESP-2026-007|B-S-Q-KO','J-J60-ESP-2026-007|G-S-Q-KO'];
const key=r=>String(r.competitionId||r.sourceTournamentId||'').trim().toUpperCase();
export function compareCatalogue(archive,stored){
 const source=archive?.tournaments,rows=Array.isArray(source)?source:source&&typeof source==='object'?Object.values(source):null;
 if(!rows?.length||rows.some(r=>!r||!key(r)))throw Error('invalid_historical_catalogue');
 const ids=[...new Set(rows.map(key))],saved=new Set(stored.map(key));
 const missing=ids.filter(id=>!saved.has(id));
 return {expected:ids.length,present:ids.length-missing.length,missing};
}
export async function sourceDocuments(directory){
 const found=new Map();
 async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);if(item.isDirectory()){await walk(file);continue;}if(!item.name.endsWith('.json.gz'))continue;
  const doc=JSON.parse(gunzipSync(await fs.readFile(file))),id=String(doc.competitionId||'').toUpperCase()+'|'+doc.event;
  if(!TARGETS.includes(id))continue;const record=documentRecord(doc);if(!record||record.acquisitionState!=='complete')throw Error('original_not_complete:'+id);
  if(found.has(id)&&found.get(id).sha256!==record.sha256)throw Error('conflicting_original:'+id);found.set(id,record);
 }}await walk(directory);
 if(TARGETS.some(id=>!found.has(id)))throw Error('missing_original_artifact');return found;
}
export async function verifyFour(query,sources){
 const output=[];
 for(const id of TARGETS){const original=sources.get(id);if(!original)throw Error('missing_original:'+id);
  const exact=(await query('SELECT * FROM itf_draw_documents WHERE draw_key=? AND content_sha256=?',[id,original.sha256]))[0];
  if(!exact){const current=await query('SELECT draw_key,content_sha256,observed_at FROM itf_current_draw_documents WHERE draw_key=?',[id]);output.push({drawKey:id,status:current.length?'other_version_present':'missing',originalHash:original.sha256,current});continue;}
  const chunks=await query('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? ORDER BY chunk_index',[id,original.sha256]);
  try{verifyDocument(original,exact,chunks);output.push({drawKey:id,status:'verified_exact_original',sha256:original.sha256,bytes:original.bytes,chunks:original.chunkCount});}
  catch(error){output.push({drawKey:id,status:'corrupt',error:error.message});}
 }return output;
}
async function main(){
 const root=fileURLToPath(new URL('../',import.meta.url)),report={status:'running',sourceRun:38935714222,writes:0,startedAt:new Date().toISOString(),catalogues:{},draws:[]};
 const read=async p=>JSON.parse(await fs.readFile(root+p,'utf8'));
 try{
  const sources=await sourceDocuments(process.argv[2]||'/tmp/courtwatch-four-originals');
  const {query,db}=await openReadOnlyD1(),documents=runtimeDocumentReader(db),release=await documents.release();report.releaseSourceCommit=release.sourceCommit;
  for(const [circuit,archivePath,documentPath]of [['fitp','history/fitp_tournament_archive.json','dist/v3/source_fitp_tournaments.json'],['tennis-europe','history/tennis_europe_tournament_catalog.json','dist/v3/source_tennis_europe_tournaments_sharded.json']]){
   report.stage='catalogue_'+circuit;const doc=await documents.get(documentPath),native=[];let after='';
   while(true){const rows=await query('SELECT id,source_tournament_id FROM tournaments WHERE circuit=? AND id>? ORDER BY id LIMIT 200',[circuit,after]);native.push(...rows.map(r=>({competitionId:r.source_tournament_id})));if(rows.length<200)break;after=rows.at(-1).id;}
   report.catalogues[circuit]={...compareCatalogue(await read(archivePath),[...(doc.tournaments||[]),...native]),archivePath,documentPath,documentContentVerified:true};
  }
  report.stage='four_exact_documents';report.draws=await verifyFour(query,sources);
  report.status=Object.values(report.catalogues).every(c=>!c.missing.length)&&report.draws.every(d=>d.status==='verified_exact_original')?'verified':'needs_review';if(report.status==='needs_review')process.exitCode=2;
 }catch(error){report.status='error';report.error=error.message;process.exitCode=1;}
 finally{report.finishedAt=new Date().toISOString();await fs.mkdir(root+'dist/v3/audits',{recursive:true});await fs.writeFile(root+'dist/v3/audits/targeted-d1-storage.json',JSON.stringify(report,null,2)+'\n');console.log('TARGETED_D1_STORAGE='+JSON.stringify(report));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
