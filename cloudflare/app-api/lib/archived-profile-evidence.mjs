import {profileEvidence,recoverProfileEvidence,validOfficialId} from './player-profile-evidence.mjs';
import {playerNameKey} from './player-circuit-profiles.mjs';

// Equivalent federation codes, not inferred nationalities.
export const canonicalNation=value=>({ROM:'ROU',MGO:'MNE'}[String(value||'').toUpperCase()]||String(value||'').toUpperCase());
export function archivedCandidates(circuit,payload){
 const out=[];
 function walk(v,depth=0){
  if(!v||typeof v!=='object'||depth>12)return;
  if(Array.isArray(v)){for(const p of v)walk(p,depth+1);return;}
  const name=v.name||v.playerName||v.display_name||v.displayName||[v.givenName||v.firstName,v.familyName||v.lastName].filter(Boolean).join(' ');
  if(name){
   const p={...v,name,nationality:canonicalNation(v.nationality||v.nationalityCode||v.countryCode||v.country)};
   // A sport/player.aspx id is a tournament ID, not a global player GUID.
   if(circuit==='tennis-europe'&&/\/sport\/player/i.test(String(p.profileUrl||p.href||''))){delete p.participantId;delete p.officialId;delete p.id;}
   for(const k of ['profileUrl','profileLink','href'])if(typeof p[k]==='string'&&p[k].startsWith('/'))p[k]=new URL(p[k],circuit==='itf'?'https://www.itftennis.com':'https://te.tournamentsoftware.com').href;
   const e=profileEvidence(circuit,p);if(e?.profileUrl)out.push({...e,name,circuit});
  }
  for(const [k,p]of Object.entries(v))if(p&&typeof p==='object'&&k!=='rawHtml')walk(p,depth+1);
 }
 walk(payload);return out;
}
export function evidenceCatalog(){
 const byName=new Map(),byId=new Map();let entries=0;
 return {add(candidates){for(const candidate of candidates){const p={...candidate,nationality:canonicalNation(candidate.nationality)};const nk=p.circuit+'|'+playerNameKey(p.name),ik=p.circuit+'|'+String(p.officialId).toLowerCase();for(const [map,key]of [[byName,nk],[byId,ik]]){const values=map.get(key)||new Map();values.set(JSON.stringify([p.officialId,p.profileUrl,p.nationality,p.birthYear]),p);map.set(key,values);}entries++;}},get entries(){return entries;},resolve(row){
  const payload=JSON.parse(row.payload||'{}'),source={...payload,name:row.display_name,officialId:row.official_id,birthYear:row.birth_year||payload.birthYear,nationality:canonicalNation(row.nationality||payload.nationality||payload.country)};
  const exact=validOfficialId(row.circuit,row.official_id)?[...(byId.get(row.circuit+'|'+row.official_id.toLowerCase())?.values()||[])]:[];
  const years=new Set(exact.map(p=>Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4))).filter(Boolean)),nations=new Set(exact.map(p=>canonicalNation(p.nationality)).filter(Boolean));
  if(exact.length&&(nations.size>1||years.size>1||source.nationality&&nations.size&&!nations.has(source.nationality)||source.birthYear&&years.size&&!years.has(Number(source.birthYear))))return null;
  // Official-ID equality permits corrected names; country/year checks still apply.
  const candidates=exact.length?exact.map(p=>({...p,name:source.name})):[...(byName.get(row.circuit+'|'+playerNameKey(source.name))?.values()||[])];
  return recoverProfileEvidence(row.circuit,source,candidates);
 }};
}
