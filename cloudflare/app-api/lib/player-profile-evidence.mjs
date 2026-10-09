import {officialPlayerUrl,playerNameKey} from './player-circuit-profiles.mjs';
export const validOfficialId=(c,id)=>c==='fitp'?/^\d{6,12}$/.test(String(id)):c==='itf'?/^800\d{6}$/.test(String(id)):c==='tennis-europe'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(id)):false;
const nation=p=>String(p.nationality||p.country||'').toUpperCase();
const year=p=>Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4))||0;
export function profileEvidence(circuit,p={}){
 const sync=p.profileSync?.[circuit==='tennis-europe'?'tennisEurope':circuit]||{};
 const ids=[p.officialId,p.official_id,circuit==='fitp'?p.membershipCard:circuit==='itf'?p.worldTennisId:p.profileId,sync.profileId,sync.worldTennisId,p.source_player_id,p.sourcePlayerId,p.id].filter(v=>v!=null).map(String);
 let id=ids.find(id=>validOfficialId(circuit,id))||'';
 const url=officialPlayerUrl(circuit,{...p,officialId:id});
 if(url){const u=new URL(url);let fromUrl='';if(circuit==='itf')fromUrl=u.pathname.match(/\/(800\d{6})\//)?.[1]||'';if(circuit==='tennis-europe')fromUrl=u.pathname.split('/').filter(Boolean).at(-1)||'';if(circuit==='fitp')try{fromUrl=atob(u.searchParams.get('cardNumber')||'')}catch{}
  if(validOfficialId(circuit,fromUrl)){if(id&&id.toLowerCase()!==fromUrl.toLowerCase())return null;id=fromUrl;}
 }
 if(!id)return null;
 return{...p,officialId:id,profileUrl:url};
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
