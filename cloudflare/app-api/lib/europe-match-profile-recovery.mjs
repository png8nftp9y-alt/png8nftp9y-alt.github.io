import {recoveryReadQuery} from './recovery-read-query.mjs';
import {acquiredPlayer} from './acquired-player-index.mjs';
import {validOfficialId} from './player-profile-evidence.mjs';
import {matchingNation} from './archived-profile-evidence.mjs';
import {retainedPlayerReference,tournamentProfileAnchor,tournamentFederationAlias,redirectedGlobalProfile} from './retained-tournament-profile-evidence.mjs';
import {teProfileEvidence,publicCookiePair} from './live-profile-evidence.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
import {applyArchiveEvidence} from '../scripts/repair-archived-player-profiles.mjs';
import {europeMissingIdDetailsSql} from './europe-missing-id-origins.mjs';
// D1_WRITE_POLICY: incremental. applyArchiveEvidence enforces buildIncrementalSyncPlan,
// optimistic payload guards and exact readback; source keys and match history are retained.
const host='https://te.tournamentsoftware.com';
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):value||{};

export function europePublicPages({fetchPage=fetch}={}){
 const cookies=new Map(),pages=new Map();let consent;
 async function request(url,options={}){
  let method=options.method||'GET',body=options.body;
  for(let attempt=0;attempt<8;attempt++){
   const u=new URL(url);if(u.origin!==host||u.username||u.password)throw Error('europe_profile_foreign_url');
   const response=await fetchPage(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
   for(const value of response.headers.getSetCookie?.()||[]){const pair=publicCookiePair(value);if(pair)cookies.set(...pair)}
   const location=response.headers.get('location');
   if(location&&response.status>=300&&response.status<400){url=new URL(location,url).href;if(response.status!==307&&response.status!==308){method='GET';body=undefined}continue}
   if(response.status!==200)throw Error('europe_profile_http_'+response.status);
   return{url,text:await response.text()};
  }throw Error('europe_profile_redirect_limit');
 }
 return async url=>{
  consent??=(async()=>{const page=await request(host+'/find/player');if(/CookiePurposes|SettingsOpen/.test(page.text))await request(host+'/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false',CookiePurposes:'1'}).toString()})})();
  await consent;
  if(!pages.has(url))pages.set(url,request(url));
  return pages.get(url);
 };
}

export async function europeMatchProfileEvidence(rows,query,publicPage){
 const resolved=new Map(),report={examined:rows.length,sourceBound:0,verified:0,unresolved:0,requests:0};
 const pages=new Map();
 const page=url=>{if(!pages.has(url)){report.requests++;pages.set(url,publicPage(url))}return pages.get(url)};
 for(const row of rows){
  if(row.circuit!=='tennis-europe'||!row.source_key.startsWith('acquired|tennis-europe|name:')||validOfficialId('tennis-europe',row.official_id)){report.unresolved++;continue}
  const refs=new Map();let afterMatch='',afterPlayer='';
  while(true){
   const batch=await query(`SELECT p.match_id,p.participant_key,p.display_name,p.source_player_id,p.nationality,p.payload,t.source_tournament_id FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit='tennis-europe' AND p.normalized_name=${sqlString(row.normalized_name.toLowerCase())} AND (p.match_id,p.participant_key)>(${sqlString(afterMatch)},${sqlString(afterPlayer)}) ORDER BY p.match_id,p.participant_key LIMIT 1000`);
   for(const participant of batch){
    const raw=parse(participant.payload),source=acquiredPlayer('tennis-europe',{...raw,name:participant.display_name,source_player_id:participant.source_player_id,nationality:participant.nationality||raw.nationality});
    // Reconstruct the production hash: names alone cannot establish provenance.
    if(source?.sourceKey!==row.source_key)continue;
    const href=retainedPlayerReference(raw,participant.source_tournament_id,participant.source_player_id);
    if(href)refs.set(href,participant);
   }
   if(batch.length<1000)break;afterMatch=batch.at(-1).match_id;afterPlayer=batch.at(-1).participant_key;
  }
  if(!refs.size){report.unresolved++;continue}report.sourceBound++;
  const evidence=new Map();let complete=true;
  for(const [href,participant] of refs){try{
   const local=await page(href),tournament=participant.source_tournament_id,player=participant.source_player_id;
   let anchor=tournamentProfileAnchor(local.text,local.url,tournament,player);
   if(!anchor){const alias=tournamentFederationAlias(local.text,local.url,tournament,player);if(alias)anchor=redirectedGlobalProfile(await page(alias))}
   if(!anchor)throw Error('europe_profile_global_link_missing');
   const global=await page(anchor.profileUrl),verified=teProfileEvidence(global.text,{...anchor,name:row.display_name},global.url);
   const own=parse(row.payload),nation=matchingNation('tennis-europe',row.nationality||own.nationality);
   if(!verified||nation&&matchingNation('tennis-europe',verified.nationality)!==nation)throw Error('europe_profile_identity_unverified');
   evidence.set(verified.officialId,{officialId:verified.officialId,profileUrl:verified.profileUrl,
    profileEvidenceProvenance:{type:'exact_acquired_match_tournament_global_profile',originalCompetitions:new Set([...refs.values()].map(p=>p.source_tournament_id)).size}});
  }catch{complete=false}}
  if(complete&&evidence.size===1){resolved.set(row.source_table+'|'+row.source_key,[...evidence.values()][0]);report.verified++}else report.unresolved++;
 }
 return{resolved,report};
}

export async function recoverEuropeMatchProfiles(query,{publicPage=europePublicPages(),onProgress=()=>{}}={}){
 let examined=0,repaired=0,unresolved=0,requests=0;
 // Use exactly the production missing-person scope. A legacy source without an
 // ID does not require HTTP recovery if its canonical person already has one.
 const targets=await recoveryReadQuery(query,europeMissingIdDetailsSql,'identity_invalid_europe');
 for(let offset=0;offset<targets.length;offset+=100){
  const keys=targets.slice(offset,offset+100).map(r=>sqlString(r.source_key)).join(',');
  const rows=(await query(`SELECT s.*,l.nationality,l.birth_year FROM search_acquired_players s LEFT JOIN player_circuit_identities l ON l.source_key=s.source_key WHERE s.circuit='tennis-europe' AND s.source_key IN (${keys}) AND COALESCE(s.official_id,'')='' ORDER BY s.source_key`)).map(r=>({...r,source_table:'search_acquired_players'}));
  if(!rows.length)continue;
  const evidence=await europeMatchProfileEvidence(rows,query,publicPage);
  const delta=await applyArchiveEvidence(query,rows,{resolve:r=>evidence.resolved.get(r.source_table+'|'+r.source_key)});
  examined+=rows.length;repaired+=delta.repaired;unresolved+=rows.length-delta.repaired;requests+=evidence.report.requests;
  onProgress({examined,repaired,unresolved,requests});
 }
 return{examined,repaired,unresolved,requests};
}
