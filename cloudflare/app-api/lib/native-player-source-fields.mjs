import {profileEvidence,validOfficialId} from './player-profile-evidence.mjs';
const name=p=>p.name||p.playerName||p.full1||p.full2||[p.givenName||p.firstName||p.Name||p.FirstName||p.Nome,p.familyName||p.lastName||p.Surname||p.LastName||p.Cognome].filter(Boolean).join(' ');
const country=p=>String(p.nationality||p.nationalityCode||p.countryCode||p.country||p.NationalityCode||p.CountryCode||'').toUpperCase();
function idClaims(circuit,p){
 const fields=circuit==='fitp'?['officialId','official_id','membershipCard','MembershipCard','Tessera','CardNumber','NumeroTessera','FitpCardNumber']:['officialId','official_id','worldTennisId','playerId','personId','PlayerId','PersonId','source_player_id','sourcePlayerId','id'];
 const ids=new Set(fields.map(k=>String(p[k]||'').trim()).filter(id=>validOfficialId(circuit,id)));
 for(let url of [p.profileUrl,p.playerProfileUrl,p.profileLink,p.PlayerProfileLink,p.href].filter(v=>typeof v==='string')){
  if(url.startsWith('/'))url=new URL(url,circuit==='fitp'?'https://www.fitp.it':'https://www.itftennis.com').href;
  const e=profileEvidence(circuit,{name:name(p),profileUrl:url});if(e)ids.add(e.officialId);
 }
 return ids;
}
export const hasConflictingNativeSource=(c,p)=>['fitp','itf'].includes(c)&&idClaims(c,p).size>1;
export function sourceNativeEvidence(circuit,p){
 if(!['fitp','itf'].includes(circuit))return null;
 const ids=idClaims(circuit,p);
 let url=p.profileUrl||p.playerProfileUrl||p.profileLink||p.PlayerProfileLink||p.href||'';
 if(typeof url==='string'&&url.startsWith('/'))url=new URL(url,circuit==='fitp'?'https://www.fitp.it':'https://www.itftennis.com').href;
 const e=profileEvidence(circuit,{...p,name:name(p),nationality:country(p),profileUrl:url,officialId:ids.size===1?[...ids][0]:''});
 if(!e||ids.size>1||ids.size&&![...ids].includes(e.officialId))return null;
 return{officialId:e.officialId,profileUrl:e.profileUrl,...(e.nationality?{nationality:e.nationality}:{})};
}
