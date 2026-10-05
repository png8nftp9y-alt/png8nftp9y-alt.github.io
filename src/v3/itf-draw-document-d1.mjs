import crypto from 'node:crypto';
import {acquiredDrawStatus} from './itf-audit-acquisition-policy.mjs';

export const sqlString=value=>`'${String(value??'').replaceAll("'","''")}'`;
export const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
export function documentRecord(doc,{archiveEvidence=false}={}){
 const competitionId=String(doc.competitionId||'').toUpperCase(),event=String(doc.event||'');
 const named=p=>Boolean(String(p?.name||p?.id||'').trim());
 const populated=(doc.players||[]).some(named)||(doc.matches||[]).some(m=>(m.teams||[]).some(t=>(t.players||[]).some(named)));
 const complete=Boolean(populated&&(doc.matches||[]).length&&acquiredDrawStatus({competitionId,event,artifact:doc}).complete);
 // A checksum-verified archived document must be preserved even when its
 // acquisition proof is insufficient. Storage never upgrades that proof.
 if(!competitionId||!event||(!complete&&!archiveEvidence))return null;
 const text=JSON.stringify(doc),points=Array.from(text),chunks=[];
 for(let offset=0;offset<points.length;offset+=12000)chunks.push(points.slice(offset,offset+12000).join(''));
 const stamp=[doc.generatedAt,doc.observedAt,doc.sourceObservedAt].map(x=>Date.parse(x)).filter(Number.isFinite);
 return {drawKey:competitionId+'|'+event,competitionId,event,sha256:digest(text),bytes:Buffer.byteLength(text),chunkCount:chunks.length,playerCount:(doc.players||[]).length,matchCount:(doc.matches||[]).length,observedAt:stamp.length?new Date(Math.max(...stamp)).toISOString():'',acquisitionState:complete?'complete':'archived_unverified',chunks};
}
export function documentSQL(row){
 const q=sqlString,values=[];
 // Immutable versions: interrupted uploads cannot expose a partial document.
 row.chunks.forEach((text,index)=>values.push(`INSERT INTO itf_draw_document_chunks(draw_key,content_sha256,chunk_index,content) VALUES(${q(row.drawKey)},${q(row.sha256)},${index},${q(text)}) ON CONFLICT(draw_key,content_sha256,chunk_index) DO NOTHING;`));
 const table=row.acquisitionState==='archived_unverified'?'itf_draw_unverified_documents':'itf_draw_documents';
 values.push(`INSERT INTO ${table}(draw_key,content_sha256,competition_id,event,observed_at,content_bytes,chunk_count,player_count,match_count) VALUES(${q(row.drawKey)},${q(row.sha256)},${q(row.competitionId)},${q(row.event)},${q(row.observedAt)},${row.bytes},${row.chunkCount},${row.playerCount},${row.matchCount}) ON CONFLICT(draw_key,content_sha256) DO NOTHING;`);
 return values;
}
export function verifyDocument(row,remote,chunks){
 if(!remote)throw new Error('Missing D1 document: '+row.drawKey);
 const ordered=[...chunks].sort((a,b)=>a.chunk_index-b.chunk_index);
 if(ordered.length!==row.chunkCount||ordered.some((x,i)=>x.chunk_index!==i))throw new Error('Missing D1 chunks: '+row.drawKey);
 const content=ordered.map(x=>x.content).join('');
 if(digest(content)!==row.sha256||Buffer.byteLength(content)!==row.bytes)throw new Error('D1 content hash/size mismatch: '+row.drawKey);
 for(const [column,key] of [['chunk_count','chunkCount'],['content_bytes','bytes'],['player_count','playerCount'],['match_count','matchCount']])if(Number(remote[column])!==row[key])throw new Error('D1 metadata mismatch: '+row.drawKey+' '+column);
 const doc=JSON.parse(content),check=documentRecord(doc,{archiveEvidence:row.acquisitionState==='archived_unverified'});
 if(!check||check.drawKey!==row.drawKey||check.sha256!==row.sha256)throw new Error('D1 document invalid: '+row.drawKey);
 return true;
}
