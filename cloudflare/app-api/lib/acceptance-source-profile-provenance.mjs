import {acquiredPlayer} from './acquired-player-index.mjs';
import {playerNameKey} from './player-circuit-profiles.mjs';
import {validOfficialId} from './player-profile-evidence.mjs';
import {participantIdentity} from '../../../src/v3/tennis-europe-participant-identity.mjs';
import {teProfileEvidence} from './live-profile-evidence.mjs';
import {tournamentProfileAnchor,retainedPlayerReference} from './retained-tournament-profile-evidence.mjs';
const host='https://te.tournamentsoftware.com';
const decode=s=>String(s).replaceAll('&amp;','&').replaceAll('&quot;','"').replace(/&#39;|&apos;/g,"'");
const clean=s=>String(s).replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replace(/\s+/g,' ').trim();
export function sourceAcceptanceReferences(source,doc){
 if(doc?.status!=='tennis_europe_participant_cache_complete'||!doc.tournaments||!Object.keys(doc.tournaments).length)throw Error('acceptance_provenance_incomplete');
 const refs=[];
 for(const t of Object.values(doc.tournaments)){if(!Array.isArray(t.participants)||!validOfficialId('tennis-europe',t.competitionId))throw Error('acceptance_provenance_incomplete');
  for(const p of t.participants){const legacy=acquiredPlayer('tennis-europe',{name:p.playerName,nationality:p.countryCode,birthYear:p.birthYear});
   if(!legacy||'acceptance|'+legacy.sourceKey!==source.source_key)continue;
   refs.push({competitionId:t.competitionId.toLowerCase(),event:p.event||'',participant:p});
  }
 }
 return refs;
}
export function acceptanceRowProfiles(html,name){
 const out=[];for(const row of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1]));const p=participantIdentity({cells,rowHtml:row[1]});if(p&&playerNameKey(p.playerName)===playerNameKey(name))out.push(p)}return out;
}
export async function originalAcceptancePage(ref,publicPage){
 const base=await publicPage(host+'/sport/acceptancelist.aspx?id='+ref.competitionId);if(!/Acceptance list/i.test(base.text))throw Error('acceptance_page_unavailable');
 if(!ref.event)return base;if(!/^(BS|GS)\d{2}$/.test(ref.event))throw Error('original_event_invalid');
 const selects=[...base.text.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
 const selected=selects.find(s=>new RegExp('>\\s*'+ref.event+'\\s*<','i').test(s[2]));if(!selected)throw Error('original_event_unavailable');
 const attr=(tag,key)=>decode(tag.match(new RegExp('\\b'+key+'=["\']([^"\']*)["\']','i'))?.[1]||'');
 const target=attr(selected[1],'name'),options=[...selected[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)],opt=options.find(o=>clean(o[2]).toUpperCase()===ref.event.toUpperCase());if(!target||!opt)throw Error('original_event_unavailable');if(/\bselected\b/i.test(opt[1]))return base;
 const body=new URLSearchParams();for(const input of base.text.matchAll(/<input\b[^>]*>/gi))if(/type=["']hidden["']/i.test(input[0])){const n=attr(input[0],'name');if(n)body.set(n,attr(input[0],'value'))}body.set('__EVENTTARGET',target);body.set('__EVENTARGUMENT','');body.set(target,attr(opt[1],'value'));
 const result=await publicPage(base.url,{method:'POST',body:body.toString()});if(!/Acceptance list/i.test(result.text)||!new RegExp('<option\\b[^>]*selected[^>]*>\\s*'+ref.event+'\\s*<','i').test(result.text))throw Error('original_event_switch_unverified');return result;
}
export async function acceptanceSourceProfiles(sources,doc,publicPage){
 const resolved=new Map(),report={examined:0,sourceBound:0,verified:0,noOriginalReferences:0,incompleteOrConflicting:0};
 for(const source of sources.filter(s=>s.circuit==='tennis-europe'&&!s.official_id)){report.examined++;const refs=sourceAcceptanceReferences(source,doc);if(!refs.length){report.noOriginalReferences++;continue}report.sourceBound++;if(refs.length>50){report.incompleteOrConflicting++;continue}
  const evidence=new Map();let complete=true;
  for(const ref of refs){try{let p=ref.participant,id=p.participantId;
   if(!validOfficialId('tennis-europe',id)){const original=await originalAcceptancePage(ref,publicPage),rows=acceptanceRowProfiles(original.text,source.display_name);if(rows.length!==1)throw Error('original_participant_ambiguous');p=rows[0];id=p.participantId;
    if(!validOfficialId('tennis-europe',id)){const u=new URL(p.profileUrl||host);const local=u.searchParams.get('player'),href=retainedPlayerReference(p,ref.competitionId,local);if(!href||!local)throw Error('original_native_profile_absent');const participantPage=await publicPage(href),anchor=tournamentProfileAnchor(participantPage.text,participantPage.url,ref.competitionId,local);if(!anchor)throw Error('original_native_profile_absent');id=anchor.officialId;}
   }
   const profileUrl=host+'/player-profile/'+id.toLowerCase(),profile=await publicPage(profileUrl),verified=teProfileEvidence(profile.text,{name:source.display_name,officialId:id.toLowerCase(),profileUrl},profile.url);if(!verified)throw Error('native_profile_unverified');if(source.birth_year&&Number(p.birthYear)!==Number(source.birth_year))throw Error('known_birth_not_proven');evidence.set(verified.officialId,{...verified,...(p.birthYear?{birthYear:Number(p.birthYear)}:{}),historicalNationality:source.nationality,profileEvidenceProvenance:{type:'exact_acceptance_source_hash_original_participant',originalCompetitions:new Set(refs.map(r=>r.competitionId)).size,cacheGeneratedAt:doc.generatedAt}});
  }catch{complete=false}}
  if(complete&&evidence.size===1){resolved.set(source.source_table+'|'+source.source_key,[...evidence.values()][0]);report.verified++}else report.incompleteOrConflicting++;
 }
 return{resolved,report};
}
