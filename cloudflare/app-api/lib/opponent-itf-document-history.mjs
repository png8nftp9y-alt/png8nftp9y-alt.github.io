// D1_READ_ONLY: exact native identities and indexed competition/document keys.
// The immutable acquired draw is authoritative even when normalized match rows are absent.
import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {itfMatchParticipants,itfMatchScore} from '../../../src/v3/itf-match-participants.mjs';
const date=value=>String(value||'').slice(0,10);
const key=value=>String(value||'').toUpperCase();
export async function opponentItfDocumentHistory(db,{identity,entries=[],existing=[],asOf,excludeMatchId='',onIncomplete}){
 const native=playerCircuitIdentities(identity||{}).find(p=>p.circuit==='itf')?.profileId;
 if(!native)return[];
 const present=new Set(existing.filter(t=>t.circuit==='itf'&&t.matches?.length).map(t=>key(t.competitionId)));
 const candidates=[...new Map(entries.filter(t=>t.circuit==='itf'&&t.drawConfirmed===true&&t.entryStatus==='official_draw'&&date(t.endDate||t.startDate)<asOf&&/^\d{4}-\d{2}-\d{2}$/.test(date(t.endDate||t.startDate))&&!present.has(key(t.competitionId))).map(t=>[key(t.competitionId),t])).values()].sort((a,b)=>date(b.endDate||b.startDate).localeCompare(date(a.endDate||a.startDate)));
 const out=[];
 for(const entry of candidates){
  // Once three newer, match-backed tournaments exist, older evidence cannot enter the window.
  const newer=[...existing,...out].filter(t=>t.matches?.length&&date(t.endDate||t.startDate)<asOf&&date(t.endDate||t.startDate)>date(entry.endDate||entry.startDate));
  if(new Set(newer.map(t=>(t.circuit||'')+'|'+key(t.competitionId))).size>=3)continue;
  const competitionId=key(entry.competitionId),versions=(await db.prepare('SELECT draw_key,content_sha256,competition_id,event,chunk_count,content_bytes FROM itf_draw_documents WHERE competition_id=? ORDER BY event,observed_at DESC,content_sha256 DESC').bind(competitionId).all()).results||[],events=new Set(),matches=[],unavailable=[],verifiedSex=new Set();
  for(const version of versions){
   if(events.has(version.event))continue;events.add(version.event);
   const chunks=[],expectedChunks=Number(version.chunk_count);
   if(!Number.isSafeInteger(expectedChunks)||expectedChunks<1)throw Error('itf_history_document_chunks_missing');
   for(;;){
    const page=(await db.prepare('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? AND chunk_index>=? ORDER BY chunk_index LIMIT 8').bind(version.draw_key,version.content_sha256,chunks.length).all()).results||[];
    if(page.length>8||chunks.length+page.length>expectedChunks||page.some((x,i)=>Number(x.chunk_index)!==chunks.length+i))throw Error('itf_history_document_chunks_missing');
    chunks.push(...page);
    if(page.length<8)break;
   }
   if(chunks.length!==Number(version.chunk_count)||chunks.some((x,i)=>Number(x.chunk_index)!==i))throw Error('itf_history_document_chunks_missing');
   const text=chunks.map(x=>x.content).join(''),bytes=new TextEncoder().encode(text),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==version.content_sha256||bytes.length!==Number(version.content_bytes))throw Error('itf_history_document_integrity_failed');
   const doc=JSON.parse(text);if(key(doc.competitionId)!==competitionId||doc.event!==version.event)throw Error('itf_history_document_identity_mismatch');
   if(doc.error||doc.failureType){
    unavailable.push({circuit:'itf',sourcePlayerId:native,competitionId,event:version.event,reason:'itf_source_document_unavailable',failureType:String(doc.failureType||'source_error').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80),contentSha256:version.content_sha256});
    continue;
   }
   for(const [index,raw] of (doc.matches||[]).entries()){
    const people=itfMatchParticipants({...raw,id:''}),self=people.find(p=>p.source_player_id===native);
    if(!self)continue;
    const sex=/^([BG])-/.exec(version.event)?.[1];if(sex)verifiedSex.add(sex);
    const played=date(raw.playedDate||raw.date);if(played&&played>asOf)continue;
    const sourceId=String(raw.matchId||''),canonicalId=sourceId?`match_itf_${competitionId.toLowerCase()}_${version.event.toLowerCase()}_${sourceId}`:'';
    if(excludeMatchId&&(excludeMatchId===sourceId||excludeMatchId===canonicalId))continue;
    const decorate=p=>({name:p.display_name,nationality:p.nationality,profileId:p.source_player_id});
    const score=itfMatchScore(raw),oriented=self.team_index===1?score.split(/\s+/).map(s=>s.replace(/^(\d+(?:\(\d+\))?)-(\d+(?:\(\d+\))?)$/,'$2-$1')).join(' '):score;
    matches.push({matchId:canonicalId||`itf-document:${competitionId}:${version.event}:${index}`,date:played,event:version.event,round:raw.round||raw.roundName||'',drawUrl:raw.sourceUrl||doc.sourceUrl||entry.sourceUrl||'',score:oriented,status:raw.status||'',won:Boolean(self.is_winner),partners:people.filter(p=>p!==self&&p.team_index===self.team_index).map(decorate),opponents:people.filter(p=>p.team_index!==self.team_index).map(decorate)});
   }
  }
  // Only exact native-ID participation in current valid documents proves relevance.
  // Unknown or conflicting evidence keeps every unavailable event visible.
  for(const detail of unavailable){
   const sex=/^([BG])-/.exec(detail.event)?.[1];
   if(verifiedSex.size===1&&sex&&!verifiedSex.has(sex))continue;
   if(typeof onIncomplete!=='function')throw Error('itf_history_document_source_error');
   onIncomplete(detail);
  }
  if(matches.length)out.push({...entry,matches,historyMatchCount:matches.length,historyEvidence:'acquired_itf_draw_document'});
 }
 return out;
}
