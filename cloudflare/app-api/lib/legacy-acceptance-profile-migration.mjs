import {normalizePlayerName,playerNameKey} from './player-circuit-profiles.mjs';
import {validOfficialId} from './player-profile-evidence.mjs';
import {lookupTeDirectory} from './live-profile-evidence.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
export function legacyAcceptanceCandidate(source,entries,doc){
 if(doc?.status!=='tennis_europe_participant_cache_complete'||!doc.tournaments||!Object.keys(doc.tournaments).length)throw Error('native_acceptance_source_incomplete');
 const name=playerNameKey(source.display_name),competitions=new Set(),retainedNativeIds=new Set();
 for(const row of entries){const retainedId=String(row.source_player_id||'');if(playerNameKey(row.display_name)!==name)continue;if(retainedId.startsWith('name:')){if(playerNameKey(retainedId.slice(5))!==name)continue}else if(validOfficialId('tennis-europe',retainedId)){retainedNativeIds.add(retainedId.toLowerCase())}else continue;let payload;try{payload=JSON.parse(row.payload)}catch{return null}for(const t of payload.tournaments||[])if(validOfficialId('tennis-europe',t.competitionId))competitions.add(t.competitionId.toLowerCase())}
 if(!competitions.size)return null;
 const matches=[],shared=new Set();for(const t of Object.values(doc.tournaments)){if(!Array.isArray(t.participants))throw Error('native_acceptance_source_incomplete');for(const p of t.participants){if(playerNameKey(p.playerName)!==name)continue;if(!validOfficialId('tennis-europe',p.participantId))return null;matches.push(p);if(competitions.has(String(t.competitionId).toLowerCase()))shared.add(String(t.competitionId).toLowerCase())}}
 const ids=new Set(matches.map(p=>p.participantId.toLowerCase())),years=new Set(matches.map(p=>p.birthYear).filter(Boolean));
 if(!shared.size||ids.size!==1||retainedNativeIds.size>1||retainedNativeIds.size===1&&!ids.has([...retainedNativeIds][0])||years.size>1||source.birth_year&&(years.size!==1||!years.has(source.birth_year)))return null;
 return{officialId:[...ids][0],birthYear:years.size?[...years][0]:undefined,sharedTournaments:shared.size};
}
export async function legacyAcceptanceProfiles(rows,query,publicPage,doc){
 const resolved=new Map(),report={examined:0,nativeCandidates:0,verified:0,ambiguousOrAbsent:0,unreadable:0,retainedEntries:0,legacyNameEntries:0,nativeIdEntries:0};
 for(const source of rows.filter(r=>r.circuit==='tennis-europe'&&!r.official_id)){report.examined++;const n=normalizePlayerName(source.display_name),variants=[n,n.toLowerCase(),n.split(' ').reverse().join(' '),n.split(' ').reverse().join(' ').toLowerCase()];
  const entries=await query("SELECT source_player_id,display_name,payload FROM opponent_entry_profiles WHERE circuit='tennis-europe' AND normalized_name IN ("+variants.map(sqlString).join(',')+') LIMIT 101');
  report.retainedEntries+=entries.length;report.legacyNameEntries+=entries.filter(e=>String(e.source_player_id).startsWith('name:')).length;report.nativeIdEntries+=entries.filter(e=>validOfficialId('tennis-europe',e.source_player_id)).length;
  const candidate=entries.length<=100?legacyAcceptanceCandidate(source,entries,doc):null;if(!candidate){report.ambiguousOrAbsent++;continue}report.nativeCandidates++;
  try{const directory=await lookupTeDirectory(source.display_name,publicPage),ids=new Set(directory.map(e=>e.officialId.toLowerCase()));if(ids.size!==1||!ids.has(candidate.officialId)){report.ambiguousOrAbsent++;continue}const profile=directory.find(e=>e.officialId.toLowerCase()===candidate.officialId);
   resolved.set(source.source_table+'|'+source.source_key,{officialId:candidate.officialId,profileUrl:profile.profileUrl,nationality:profile.nationality,...(candidate.birthYear?{birthYear:candidate.birthYear}:{}),historicalNationality:source.nationality,profileEvidenceProvenance:{type:'retained_acceptance_alias_native_migration',sharedTournaments:candidate.sharedTournaments,cacheGeneratedAt:doc.generatedAt}});report.verified++;
  }catch{report.unreadable++}
 }
 return{resolved,report};
}
