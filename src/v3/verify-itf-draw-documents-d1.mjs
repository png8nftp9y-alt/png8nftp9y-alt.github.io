import {itfDrawPresence} from './itf-draw-presence.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sqlString,verifyDocument} from './itf-draw-document-d1.mjs';

const root=process.cwd();
const expected=JSON.parse(await fs.readFile(path.join(root,'dist/v3/audits/itf-draw-d1-sync.json'),'utf8'));
let account,token,id;
async function query(sql){
 for(let attempt=0;attempt<4;attempt++){
  let error;
  try{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});const body=await response.json();if(response.ok&&body.success&&body.result?.[0]?.success)return body.result[0].results;error=new Error('D1 content read failed: HTTP '+response.status+' '+JSON.stringify(body.errors||body.result?.[0]?.error||[]))}catch(e){error=e}
  if(attempt===3)throw error;
  await new Promise(resolve=>setTimeout(resolve,(attempt+1)*2000));
 }
}
const report={version:3,verifiedAt:new Date().toISOString(),scope:expected.scope,expectedDocuments:expected.documents.length,verifiedDocuments:0,missingOrCorrupt:[],archivedUnverified:expected.archivedUnverified||[],resolvedEmptyQualifications:expected.resolvedEmptyQualifications||[],fullPeriodCertified:false,verifiedPresenceRelations:0,missingPresence:[],unidentifiedParticipants:expected.presence?.unidentified?.length??null,caseChecks:expected.presence?.caseChecks||[]};
try{
 // Empty work has no participation to certify and older empty manifests may
 // omit presence metadata. Nonempty work still requires explicit zero gaps.
 if(report.unidentifiedParticipants>0||(expected.documents.length&&report.unidentifiedParticipants!==0))throw Error('Acquired draw participants without valid native IDs; presence completeness cannot be certified');
 if(expected.documents.length){
  const config=JSON.parse(await fs.readFile(path.join(root,'cloudflare/app-api/wrangler.generated.jsonc'),'utf8'));
  account=process.env.CLOUDFLARE_ACCOUNT_ID;token=process.env.CLOUDFLARE_API_TOKEN;id=config.d1_databases?.find(x=>x.binding==='DB')?.database_id;
  if(!account||!token||!id)throw new Error('Missing configured D1 credentials/database');
 }
 for(let offset=0;offset<expected.documents.length;offset+=10){
  const batch=expected.documents.slice(offset,offset+10);
  const predicate=batch.map(x=>`(d.draw_key=${sqlString(x.drawKey)} AND d.content_sha256=${sqlString(x.sha256)} AND d.acquisition_state=${sqlString((x.acquisitionState||'complete')==='complete'?'complete':'saved_non_complete')})`).join(' OR ');
  const rows=await query(`SELECT d.*,c.chunk_index,c.content FROM (SELECT *, 'complete' AS acquisition_state FROM itf_draw_documents UNION ALL SELECT *, 'saved_non_complete' AS acquisition_state FROM itf_draw_unverified_documents) d LEFT JOIN itf_draw_document_chunks c ON c.draw_key=d.draw_key AND c.content_sha256=d.content_sha256 WHERE ${predicate} ORDER BY d.draw_key,c.chunk_index`);
  const completeRows=batch.filter(row=>row.acquisitionState==='complete');
  const presenceRows=completeRows.length?await query(`SELECT p.draw_key,p.content_sha256,p.source_player_id,t.source_tournament_id FROM itf_draw_participations p LEFT JOIN tournaments t ON t.id=p.tournament_id WHERE ${completeRows.map(row=>`(p.draw_key=${sqlString(row.drawKey)} AND p.content_sha256=${sqlString(row.sha256)})`).join(' OR ')} ORDER BY source_player_id`):[];
  for(const expectedRow of batch){const chunks=rows.filter(x=>x.draw_key===expectedRow.drawKey&&x.content_sha256===expectedRow.sha256);try{verifyDocument(expectedRow,chunks[0],chunks.filter(x=>x.chunk_index!==null));if(expectedRow.acquisitionState==='complete'){
 const doc=JSON.parse(chunks.map(c=>c.content||'').join(''));
 const wanted=itfDrawPresence(doc).players.map(p=>p.id).sort();
 if(presenceRows.some(p=>p.draw_key===expectedRow.drawKey&&p.content_sha256===expectedRow.sha256&&p.source_tournament_id!==expectedRow.competitionId))throw Error('Draw participation linked to a different tournament');
 const actual=presenceRows.filter(p=>p.draw_key===expectedRow.drawKey&&p.content_sha256===expectedRow.sha256).map(p=>p.source_player_id);
 if(JSON.stringify(wanted)!==JSON.stringify(actual)){report.missingPresence.push({drawKey:expectedRow.drawKey,expected:wanted.length,actual:actual.length});throw Error('Draw participation index differs from acquired document');}
 report.verifiedPresenceRelations+=wanted.length;
 }report.verifiedDocuments++}catch(e){report.missingOrCorrupt.push({drawKey:expectedRow.drawKey,error:e.message})}}
  if(offset%200===0)console.log(`ITF_D1_CONTENT_VERIFIED=${report.verifiedDocuments}/${expected.documents.length}`);
 }
 report.status=report.missingOrCorrupt.length?'failed':report.expectedDocuments?(report.archivedUnverified.length?'verified_saved_documents_with_unverified_acquisition':report.resolvedEmptyQualifications.length?'verified_saved_documents':'verified_acquired_documents'):'no_complete_documents';
}catch(e){report.status='failed';report.error=e.message}
await fs.writeFile(path.join(root,'dist/v3/audits/itf-draw-d1-content-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log('ITF_D1_CONTENT_VERIFICATION='+JSON.stringify(report));
if(report.status==='failed')throw new Error('D1 ITF content verification failed; inspect audit artifact');
