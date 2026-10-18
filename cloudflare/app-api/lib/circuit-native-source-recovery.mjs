import {recoveryReadQuery} from './recovery-read-query.mjs';
import {sourceNativeEvidence,hasConflictingNativeSource} from './native-player-source-fields.mjs';
import {acquiredPlayer} from './acquired-player-index.mjs';
import {playerNameKey} from './player-circuit-profiles.mjs';
import {playerNativeIdAuditCtes} from './all-player-id-audit.mjs';
import {applyArchiveEvidence} from '../scripts/repair-archived-player-profiles.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan and optimistic readback
// are enforced by applyArchiveEvidence. Unresolved sources are never checkpointed.
const parse=p=>typeof p==='string'?JSON.parse(p||'{}'):p||{};
const guid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const name=p=>p.name||p.playerName||p.full1||p.full2||[p.givenName||p.firstName||p.Name||p.FirstName||p.Nome,p.familyName||p.lastName||p.Surname||p.LastName||p.Cognome].filter(Boolean).join(' ');
const country=p=>String(p.nationality||p.nationalityCode||p.countryCode||p.country||p.NationalityCode||p.CountryCode||'').toUpperCase();
const birth=p=>String(p.birthDate||p.dateOfBirth||p.BirthDate||p.DateOfBirth||'').slice(0,10);
const local=p=>String(p.localPlayerId||p.participantUid||p.ParticipantUid||p.ParticipantId||'');
const compatible=(original,p)=>playerNameKey(name(original))===playerNameKey(name(p))&&(!country(original)||country(original)===country(p))&&(!birth(original)||birth(original)===birth(p))&&(!original.birthYear||Number(original.birthYear)===Number(p.birthYear||birth(p).slice(0,4)));
export function circuitOfficialJson({fetchPage=fetch,onRequest=()=>{}}={}){
 const cache=new Map();
 return async(circuit,competitionId)=>{
  const key=circuit+'|'+competitionId.toLowerCase();
  if(!cache.has(key))cache.set(key,(async()=>{
   let url,options={method:'GET'};
   if(circuit==='fitp'){
    if(!guid.test(competitionId))throw Error('fitp_original_competition_invalid');
    url='https://dp-myfit-test-function-v2.azurewebsites.net/api/v3/puc/competizione/dettaglio';
    options={method:'POST',body:JSON.stringify({competitionUid:competitionId}),headers:{'Content-Type':'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Tornei/Ricerca-tornei'}};
   }else if(circuit==='itf'){
    if(!/^J-[A-Z0-9-]+$/i.test(competitionId))throw Error('itf_original_competition_invalid');
    url='https://www.itftennis.com/tennis/api/TournamentApi/GetAcceptanceList?'+new URLSearchParams({tournamentKey:competitionId.toLowerCase(),circuitCode:'JT'});
   }else throw Error('native_recovery_circuit_invalid');
   onRequest({circuit});
   const r=await fetchPage(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(r.status!==200)throw Error('native_original_source_http_'+r.status);
   const json=JSON.parse(await r.text());
   if(circuit==='fitp'&&String(json?.CompetitionUid||'').toLowerCase()!==competitionId.toLowerCase())throw Error('fitp_original_competition_mismatch');
   return json;
  })());
  return cache.get(key);
 };
}
function apiParticipants(circuit,json,original){
 if(circuit==='fitp'){
  if(!Array.isArray(json?.Tournaments)||!original.draw)throw Error('fitp_original_draw_unavailable');
  const draws=json.Tournaments.filter(d=>(d.TournamentDescription||d.Description)===original.draw);
  if(draws.length!==1||!Array.isArray(draws[0].Participants))throw Error('fitp_original_draw_ambiguous');
  return draws[0].Participants;
 }
 if(!Array.isArray(json)||!original.playerTypeCode||!original.acceptanceCode||!Number.isInteger(Number(original.acceptancePosition))||Number(original.acceptancePosition)<1)throw Error('itf_original_entry_unavailable');
 const genders=json.filter(g=>g.playerTypeCode===original.playerTypeCode);
 if(genders.length!==1||!Array.isArray(genders[0].entryClassifications))throw Error('itf_original_gender_ambiguous');
 const code=v=>v==='M'?'MD':v==='Q'?'Q':v==='A'?'A':v;
 const groups=genders[0].entryClassifications.filter(g=>code(g.entryClassificationCode)===original.acceptanceCode);
 if(groups.length!==1||!Array.isArray(groups[0].entries))throw Error('itf_original_group_ambiguous');
 return groups[0].entries.flatMap(e=>{if(!Array.isArray(e.players))throw Error('itf_original_entries_incomplete');return e.players.map(p=>({...p,acceptancePosition:Number(e.positionDisplay)}))});
}
export async function recoverOriginalParticipant(circuit,ref,officialJson){
 const original=ref.participant,competitionId=String(ref.competitionId||'');
 if(circuit==='fitp'?!guid.test(competitionId):!/^J-[A-Z0-9-]+$/i.test(competitionId))return null;
 if(hasConflictingNativeSource(circuit,original))return null;
 const direct=sourceNativeEvidence(circuit,original);
 if(direct)return{...direct,profileEvidenceProvenance:{type:'exact_original_native_participant',competitionId}};
 // The retained row needs more than a name. A list position or subscription
 // timestamp/local UID binds it to its original event; homonyms still fail closed.
 if(circuit==='fitp'&&!local(original)&&!original.subscriptionDate)return null;
 const json=await officialJson(circuit,competitionId),participants=apiParticipants(circuit,json,original);
 const sameName=participants.filter(p=>playerNameKey(name(original))===playerNameKey(name(p)));
 if(sameName.length!==1||!compatible(original,sameName[0]))return null;
 const p=sameName[0];
 if(circuit==='fitp'){
  if(local(original)?local(p)!==local(original):String(p.SubscriptionDate||p.subscriptionDate||'')!==String(original.subscriptionDate))return null;
 }else if(p.acceptancePosition!==Number(original.acceptancePosition))return null;
 const e=sourceNativeEvidence(circuit,p);
 return e?{...e,profileEvidenceProvenance:{type:'exact_original_tournament_participant_rechecked',competitionId}}:null;
}
export function circuitAcceptanceRecovery(doc,{officialJson=circuitOfficialJson()}={}){
 return async rows=>{
  const resolved=new Map();
  for(const row of rows.filter(r=>['fitp','itf'].includes(r.circuit))){
   const refs=[];
   const tournaments=row.circuit==='fitp'?Object.values(doc?.tournaments||{}):[{participants:doc?.participants}];
   let complete=true;
   for(const t of tournaments){if(!Array.isArray(t.participants)){complete=false;continue}
    for(const p of t.participants){const source=acquiredPlayer(row.circuit,{...p,name:name(p)});if(source&&'acceptance|'+source.sourceKey===row.source_key)refs.push({competitionId:p.competitionId||t.competitionId,participant:p});}
   }
   const ids=new Map();
   if(!refs.length||refs.length>50)continue;
   for(const ref of refs)try{const e=await recoverOriginalParticipant(row.circuit,ref,officialJson);if(e)ids.set(e.officialId,e);else complete=false}catch{complete=false}
   if(complete&&ids.size===1)resolved.set(row.source_key,[...ids.values()][0]);
  }return resolved;
 };
}
// Only groups containing an invalid native ID can be missing native evidence.
// The full native rules (including configured profile URLs) still decide recovery.
const invalidNative=`(l.circuit='fitp' AND NOT(length(trim(l.official_id)) BETWEEN 6 AND 12 AND trim(l.official_id) NOT GLOB '*[^0-9]*')) OR (l.circuit='itf' AND NOT(length(trim(l.official_id))=9 AND trim(l.official_id) GLOB '800*' AND trim(l.official_id) NOT GLOB '*[^0-9]*'))`;
const scopedNativeCtes=playerNativeIdAuditCtes.replace('WITH RECURSIVE eligible_links AS (',`WITH RECURSIVE candidate_links AS MATERIALIZED (
 SELECT l.source_key,l.canonical_id,l.circuit FROM player_circuit_identities l WHERE ${invalidNative}
), eligible_links AS (`).replace('FROM player_circuit_identities WHERE','FROM player_circuit_identities INDEXED BY player_circuit_identity_person WHERE canonical_id IN (SELECT canonical_id FROM candidate_links) AND');
export const circuitMissingNativeSourcesSql=`${scopedNativeCtes}
SELECT 'observed_players' AS source_table,s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,s.payload,l.canonical_id
FROM candidate_links c JOIN eligible_links l ON l.source_key=c.source_key
CROSS JOIN observed_players s ON s.source_key=l.source_key AND s.circuit=l.circuit
WHERE NOT EXISTS(SELECT 1 FROM native n WHERE n.canonical_id=l.canonical_id AND n.circuit=l.circuit)
UNION ALL
SELECT 'search_acquired_players',s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,s.payload,l.canonical_id
FROM candidate_links c JOIN eligible_links l ON l.source_key=c.source_key
CROSS JOIN search_acquired_players s ON s.source_key=l.source_key AND s.circuit=l.circuit
WHERE NOT EXISTS(SELECT 1 FROM native n WHERE n.canonical_id=l.canonical_id AND n.circuit=l.circuit)
ORDER BY 1,2`;
export async function recoverCircuitNativeSources(query,{officialJson=circuitOfficialJson(),onProgress=()=>{}}={}){
 const rows=await recoveryReadQuery(query,circuitMissingNativeSourcesSql,'identity_invalid_native'),report={examined:rows.length,repaired:0,unresolved:0};
 for(const row of rows){
  const refs=[];let afterMatch='',afterPlayer='';
  // Indexed normalized_name is only a narrowing filter; the source hash must match.
  while(true){
   const batch=await query(`SELECT p.*,t.source_tournament_id FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=${sqlString(row.circuit)} AND p.normalized_name=${sqlString(row.normalized_name.toLowerCase())} AND (p.match_id,p.participant_key)>(${sqlString(afterMatch)},${sqlString(afterPlayer)}) ORDER BY p.match_id,p.participant_key LIMIT 1000`);
   for(const p of batch){const raw=parse(p.payload),participant={...raw,name:p.display_name,source_player_id:p.source_player_id,nationality:p.nationality||raw.nationality},source=acquiredPlayer(row.circuit,participant);
    if(source?.sourceKey!==row.source_key&&acquiredPlayer(row.circuit,participant,{nativeFields:false})?.sourceKey!==row.source_key)continue;
    refs.push({competitionId:p.source_tournament_id,participant});
   }
   if(batch.length<1000)break;afterMatch=batch.at(-1).match_id;afterPlayer=batch.at(-1).participant_key;
  }
  const ids=new Map();let complete=refs.length>0&&refs.length<=50;
  if(complete)for(const ref of refs)try{const e=await recoverOriginalParticipant(row.circuit,ref,officialJson);if(e)ids.set(e.officialId,e);else complete=false}catch{complete=false}
  const evidence=complete&&ids.size===1?[...ids.values()][0]:null;
  const delta=await applyArchiveEvidence(query,[row],{resolve:()=>evidence});report.repaired+=delta.repaired;report.unresolved+=1-delta.repaired;
  onProgress({...report});
 }return report;
}
