import {officialPlayerUrl,playerNameKey} from './player-circuit-profiles.mjs';
export const validOfficialId=(c,id)=>c==='fitp'?/^\d{6,12}$/.test(String(id)):c==='itf'?/^800\d{6}$/.test(String(id)):c==='tennis-europe'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(id)):false;
const nation=p=>String(p.nationality||p.nationalityCode||p.countryCode||p.country||'').toUpperCase();
const year=p=>Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4))||0;
export function profileEvidence(circuit,p={}){
 const sync=p.profileSync?.[circuit==='tennis-europe'?'tennisEurope':circuit]||{};
 const ids=[p.officialId,p.official_id,circuit==='fitp'?p.membershipCard:circuit==='itf'?p.worldTennisId:p.profileId,sync.profileId,sync.worldTennisId,p.source_player_id,p.sourcePlayerId,p.playerId,p.participantId,p.teProfileId,p.id].filter(v=>v!=null).map(String);
 let id=ids.find(id=>validOfficialId(circuit,id))||'';
 const metadata={...p,nationality:nation(p)};const url=officialPlayerUrl(circuit,{...metadata,officialId:id});
 if(url){const u=new URL(url);let fromUrl='';if(circuit==='itf')fromUrl=u.pathname.match(/\/(800\d{6})\//)?.[1]||'';if(circuit==='tennis-europe')fromUrl=u.pathname.split('/').filter(Boolean).at(-1)||'';if(circuit==='fitp')try{fromUrl=atob(u.searchParams.get('cardNumber')||'')}catch{}
  if(validOfficialId(circuit,fromUrl)){if(id&&id.toLowerCase()!==fromUrl.toLowerCase())return null;id=fromUrl;}
 }
 if(!id)return null;
 return{...metadata,officialId:id,profileUrl:url};
}
export function recoverProfileEvidence(circuit,source,candidates=[]){
 const own=profileEvidence(circuit,source),expected=own?.officialId;
 const compatible=candidates.filter(p=>playerNameKey(p.name||p.display_name)===playerNameKey(source.name||source.display_name)&&(!year(source)||!year(p)||year(source)===year(p))&&(!nation(source)||!nation(p)||nation(source)===nation(p))).map(p=>profileEvidence(circuit,p)).filter(Boolean).filter(p=>!expected||p.officialId.toLowerCase()===expected.toLowerCase());
 const ids=new Set([...(own?[own]:[]),...compatible].map(p=>p.officialId.toLowerCase()));if(ids.size!==1)return null;
 const evidence=[...(own?[own]:[]),...compatible],countries=new Set(evidence.map(nation).filter(Boolean));
 const nationality=nation(source)||(countries.size===1?[...countries][0]:'');
 const id=evidence[0].officialId,knownUrls=[...new Set(evidence.map(p=>p.profileUrl).filter(Boolean))];
 const url=knownUrls[0]||officialPlayerUrl(circuit,{...source,officialId:id,nationality});if(!url)return null;
 return{officialId:id,profileUrl:url,...(!nation(source)&&nationality?{nationality}:{})};
}


// Recover native objects retained in canonical match payloads, including ITF
// nationalityCode/profileLink and TE participantId/profileUrl. No fabricated IDs.
export function matchProfileCandidates(circuit,payload){
 const out=[];function walk(value,depth=0){if(!value||typeof value!=='object'||depth>6)return;if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
 const name=value.name||value.display_name||value.playerName||[value.givenName||value.firstName,value.familyName||value.lastName].filter(Boolean).join(' ');if(name)out.push({...value,name,circuit});for(const [key,item]of Object.entries(value))if(item&&typeof item==='object'&&key!=='rawHtml')walk(item,depth+1);
 }walk(payload);return out;
}
