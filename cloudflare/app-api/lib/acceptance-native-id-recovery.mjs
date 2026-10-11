import {acceptanceSourceProfiles} from './acceptance-source-profile-provenance.mjs';
import {publicCookiePair} from './live-profile-evidence.mjs';
// Only exact original acceptance references are inspected, never a name-only directory lookup.
export function acceptanceNativeIdRecovery(doc,{fetchPage=fetch}={}){
 const cookies=new Map();let consent;
 async function publicPage(url,options={}){let method=options.method||'GET',body=options.body;
  for(let i=0;i<6;i++){
   const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='te.tournamentsoftware.com'||u.username||u.password)throw Error('acceptance_foreign_profile_url');
   const r=await fetchPage(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',...options.headers,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
   for(const v of r.headers.getSetCookie?.()||[]){const p=publicCookiePair(v);if(p)cookies.set(...p);}
   const location=r.headers.get('location');
   if(location&&r.status>=300&&r.status<400){url=new URL(location,url).href;method='GET';body=undefined;continue;}
   if(r.status!==200)throw Error('acceptance_native_profile_unavailable');return{url,text:await r.text()};
  }throw Error('acceptance_native_redirect_limit');
 }
 return async rows=>{
  const sources=rows.filter(r=>r.circuit==='tennis-europe').map(r=>({...r,source_table:'observed_players',nationality:r.payload?.nationality||'',birth_year:r.payload?.birthYear||null}));
  if(!sources.length)return new Map();
  // Lazy and cached: lists already containing all native IDs make no extra requests.
  consent??=(async()=>{const p=await publicPage('https://te.tournamentsoftware.com/find/player');if(/CookiePurposes|SettingsOpen/.test(p.text))await publicPage('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false',CookiePurposes:'1'}).toString()});})();
  try{await consent;const result=await acceptanceSourceProfiles(sources,doc,publicPage);return new Map([...result.resolved].map(([key,e])=>[key.slice('observed_players|'.length),e]));}catch{return new Map();}
 };
}
