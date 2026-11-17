// D1_READ_ONLY: paginated immutable document metadata, no raw chunks or writes.
import fs from 'node:fs/promises';
import {sqlString} from './itf-draw-document-d1.mjs';
export async function existingDocumentManifest(query){
 const documents=[];
 for(const table of ['itf_draw_documents','itf_draw_unverified_documents']){
  let key='',sha='';
  for(;;){
   const rows=await query(`SELECT draw_key,content_sha256,competition_id,event,content_bytes,chunk_count,player_count,match_count,observed_at FROM ${table} WHERE (draw_key,content_sha256)>(${sqlString(key)},${sqlString(sha)}) ORDER BY draw_key,content_sha256 LIMIT 500`);
   if(rows.length>500)throw Error('Invalid document manifest page');
   for(const row of rows){if(row.draw_key<key||(row.draw_key===key&&row.content_sha256<=sha))throw Error('Unordered document manifest');documents.push({...row,table});key=row.draw_key;sha=row.content_sha256;}
   if(rows.length<500)break;
  }
 }
 return {version:1,documents};
}
export function storedDocumentMatches(row,stored){
 if(!stored)return false;
 return stored.table===(row.acquisitionState==='complete'?'itf_draw_documents':'itf_draw_unverified_documents')&&
  stored.draw_key===row.drawKey&&stored.content_sha256===row.sha256&&stored.competition_id===row.competitionId&&stored.event===row.event&&
  ['content_bytes','chunk_count','player_count','match_count'].every((k,i)=>Number(stored[k])===Number(row[['bytes','chunkCount','playerCount','matchCount'][i]]));
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const config=JSON.parse(await fs.readFile('cloudflare/app-api/wrangler.generated.jsonc','utf8'));
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,id=config.d1_databases?.find(x=>x.binding==='DB')?.database_id;
 if(!account||!token||!id)throw Error('Missing D1 configuration');
 const manifest=await existingDocumentManifest(async sql=>{
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});
  const body=await response.json();if(!response.ok||!body.success||!body.result?.[0]?.success)throw Error('D1 document manifest query failed: HTTP '+response.status);
  return body.result[0].results;
 });
 await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-existing-documents.json',JSON.stringify(manifest));
 console.log('Existing immutable document versions: '+manifest.documents.length);
}
