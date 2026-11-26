import {officialItfDrawUrl} from './itf-official-draw-url.mjs';
// D1_READ_ONLY: exact competition index, latest immutable versions, bounded chunks.
const str=value=>String(value??'');
export function drawParticipants(value){
 const found=new Map();
 function walk(v){
  if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;
  const id=str(v.playerId||v.worldTennisId||v.id),name=str(v.name||[v.givenName,v.familyName].filter(Boolean).join(' ')).trim();
  if(id&&name&&!/^bye$/i.test(name)&&(/^(?:800\d{6}|[a-f\d-]{36})$/i.test(id)))found.set(id,{id,name});
  Object.values(v).forEach(x=>{if(x&&typeof x==='object')walk(x);});
 }walk(value);return [...found.values()];
}
export function itfDocumentDraws(doc,tournament){
 if(doc.error||doc.failureType||!Array.isArray(doc.matches)||!doc.matches.length)return [];
 const event=doc.event;if(!/^[BG]-[SD]-[MQ]-(KO|RR)$/.test(event))return [];
 const base=officialItfDrawUrl(tournament,event,{tournamentId:doc.tournamentId||doc.task?.tournamentId});
 if(!event.endsWith('-RR'))return [{event,drawUrl:base,participants:drawParticipants(doc.matches)}];
 const groups=new Map();for(const match of doc.matches){const group=[match.groupName,match.groupDesc,match.group,match.groupNumber,match.groupId].map(str).map(x=>x.trim()).find(Boolean)||'';if(!group)continue;const rows=groups.get(group)||[];rows.push(match);groups.set(group,rows);}
 if(!groups.size)return [{event,drawId:event,drawUrl:base,participants:drawParticipants(doc.matches)}];
 return [...groups].map(([group,matches])=>({event,group,drawId:event+'|'+group,participants:drawParticipants(matches),matches,drawUrl:base}));
}
export async function acquiredItfDraws(db,tournament){
 if(!db)return [];
 const versions=(await db.prepare('SELECT draw_key,content_sha256,event,chunk_count,content_bytes FROM itf_draw_documents d WHERE competition_id=? AND NOT EXISTS (SELECT 1 FROM itf_draw_documents newer WHERE newer.draw_key=d.draw_key AND (newer.observed_at>d.observed_at OR (newer.observed_at=d.observed_at AND newer.content_sha256>d.content_sha256))) ORDER BY event LIMIT 16').bind(tournament.competitionId.toUpperCase()).all()).results||[];
 const seen=new Set(),out=[];let total=0;
 for(const v of versions){
  if(seen.has(v.event))continue;seen.add(v.event);
  if(!/^[BG]-[SD]-[MQ]-(KO|RR)$/.test(v.event)||!Number.isSafeInteger(v.chunk_count)||v.chunk_count<1||v.chunk_count>256||v.content_bytes>2*1024*1024)continue;
  total+=v.content_bytes;if(total>8*1024*1024)break;
  const chunks=[];
  while(chunks.length<v.chunk_count){const page=(await db.prepare('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? AND chunk_index>=? ORDER BY chunk_index LIMIT 8').bind(v.draw_key,v.content_sha256,chunks.length).all()).results||[];if(!page.length||page.some((r,i)=>r.chunk_index!==chunks.length+i))throw Error('draw_document_incomplete');chunks.push(...page);}
  if(chunks.length!==v.chunk_count)throw Error('draw_document_incomplete');
  const text=chunks.map(c=>c.content).join(''),bytes=new TextEncoder().encode(text),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(bytes.length!==v.content_bytes||hash!==v.content_sha256)throw Error('draw_document_integrity');
  const doc=JSON.parse(text);if(str(doc.competitionId).toUpperCase()!==tournament.competitionId.toUpperCase()||doc.event!==v.event)throw Error('draw_document_identity');
  out.push(...itfDocumentDraws(doc,tournament));
 }
 return out;
}
