import {normalizePlayerName,playerNameKey} from './player-circuit-profiles.mjs';
import {validOfficialId} from './player-profile-evidence.mjs';
import {matchingNation} from './archived-profile-evidence.mjs';
import {teProfileEvidence,lookupTeDirectory} from './live-profile-evidence.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
export function historicalProfileCandidate(source,history){
 const nation=matchingNation('tennis-europe',source.nationality),name=playerNameKey(source.display_name);
 if(!nation||!name||source.birth_year)return null;
 const compatible=history.filter(r=>{
  let url;try{url=new URL(r.source_url)}catch{return false}
  return validOfficialId('tennis-europe',r.profile_id)&&playerNameKey(r.display_name)===name&&matchingNation('tennis-europe',r.nationality)===nation&&/^\d{4}-\d{2}-\d{2}$/.test(r.ranking_date)&&url.protocol==='https:'&&url.hostname==='te.tournamentsoftware.com'&&url.pathname==='/ranking/category.aspx'&&url.searchParams.get('id')&&url.searchParams.get('category');
 });
 const ids=new Set(compatible.map(r=>r.profile_id.toLowerCase()));if(ids.size!==1)return null;
 const r=compatible.sort((a,b)=>b.ranking_date.localeCompare(a.ranking_date))[0];
 return{officialId:r.profile_id.toLowerCase(),name:source.display_name,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+r.profile_id.toLowerCase(),historicalNationality:source.nationality,profileEvidenceProvenance:{type:'official_historical_ranking',rankingDate:r.ranking_date,sourceUrl:r.source_url}};
}
export async function historicalRankingProfiles(rows,query,publicPage){
 const resolved=new Map(),histories=new Map(),pages=new Map(),directories=new Map(),report={examined:0,historicalCandidates:0,verified:0,ambiguousOrMissing:0,unreadable:0};
 for(const row of rows.filter(r=>r.circuit==='tennis-europe'&&!r.official_id)){
  report.examined++;const name=normalizePlayerName(row.display_name),variants=[name,name.toLowerCase(),name.split(' ').reverse().join(' '),name.split(' ').reverse().join(' ').toLowerCase()];
  if(!histories.has(name))histories.set(name,await query('SELECT profile_id,display_name,nationality,ranking_date,source_url FROM tennis_europe_ranking_history WHERE normalized_name IN ('+variants.map(sqlString).join(',')+') LIMIT 10001'));
  const history=histories.get(name),candidate=history.length<=10000?historicalProfileCandidate(row,history):null;
  if(!candidate){report.ambiguousOrMissing++;continue}report.historicalCandidates++;
  try{if(!directories.has(name))directories.set(name,await lookupTeDirectory(row.display_name,publicPage));const ids=new Set(directories.get(name).map(e=>e.officialId.toLowerCase()));if(ids.size!==1||!ids.has(candidate.officialId)){report.ambiguousOrMissing++;continue}if(!pages.has(candidate.officialId))pages.set(candidate.officialId,await publicPage(candidate.profileUrl));const page=pages.get(candidate.officialId),current=teProfileEvidence(page.text,candidate,page.url);if(!current){report.unreadable++;continue}
   resolved.set(row.source_table+'|'+row.source_key,{officialId:current.officialId,profileUrl:current.profileUrl,nationality:current.nationality,historicalNationality:candidate.historicalNationality,profileEvidenceProvenance:candidate.profileEvidenceProvenance});report.verified++;
  }catch{report.unreadable++}
 }
 return{resolved,report};
}
