import {validOfficialId,profileEvidence} from './player-profile-evidence.mjs';
import {playerNameKey} from './player-circuit-profiles.mjs';
const direct=(o,names)=>Object.entries(o||{}).find(([k])=>names.includes(k.toLowerCase()))?.[1];
export function itfSearchEvidence(payload,expectedId){
 const out=[];
 function walk(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}
  const id=String(direct(v,['playerid','personid','worldtennisid','id'])||'');
  if(validOfficialId('itf',id)&&id===String(expectedId)){
   const name=direct(v,['playername','fullname','displayname','name'])||[direct(v,['givenname','firstname']),direct(v,['familyname','lastname'])].filter(Boolean).join(' ');
   const nationality=String(direct(v,['playernationalitycode','nationalitycode','countrycode','nationality'])||'').toUpperCase();
   const nativeUrl=direct(v,['playerprofilelink','profileurl','playerprofileurl','profilelink','url']);
   const profileUrl=typeof nativeUrl==='string'?new URL(nativeUrl,'https://www.itftennis.com').href:'';
   const e=profileEvidence('itf',{name,officialId:id,nationality,...(typeof profileUrl==='string'?{profileUrl}: {})});
   if(e?.profileUrl)out.push({...e,name,circuit:'itf'});
  }
  Object.values(v).forEach(walk);
 }walk(payload);return out;
}
export function publicCookiePair(value){
 const pair=String(value).split(';')[0],i=pair.indexOf('=');
 return i>0?[pair.slice(0,i),pair.slice(i+1)]:null;
}
const decode=s=>String(s||'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(entity,value)=>{
 const code=value[0].toLowerCase()==='x'?parseInt(value.slice(1),16):Number(value);
 return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):entity;
}).replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export function teSearchCandidates(html){
 const out=new Map();
 // The official AJAX directory uses h5 cards; the icon anchor has no player name.
 for(const h of String(html).matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi))for(const a of h[1].matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const url=new URL(decode(a[1]),'https://te.tournamentsoftware.com'),id=url.pathname.match(/^\/player-profile\/([a-f0-9-]{36})\/?$/i)?.[1],name=clean(a[2]);
  if(url.hostname==='te.tournamentsoftware.com'&&validOfficialId('tennis-europe',id)&&name)out.set(id.toLowerCase(),{officialId:id.toLowerCase(),name,profileUrl:url.href});
 }return [...out.values()];
}
export function teProfileEvidence(html,candidate,finalUrl=candidate.profileUrl){
 const url=new URL(finalUrl),id=url.pathname.match(/^\/player-profile\/([a-f0-9-]{36})\/?$/i)?.[1];
 if(url.hostname!=='te.tournamentsoftware.com'||id?.toLowerCase()!==candidate.officialId.toLowerCase())return null;
 const title=/<h2\b[^>]*class=["'][^"']*media__title--large[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i.exec(String(html));
 if(!title||playerNameKey(clean(title[1]))!==playerNameKey(candidate.name))return null;
 // Only the main profile header flag: opponent and tournament flags are unrelated.
 const header=String(html).slice(Math.max(0,title.index-1500),title.index);
 const flag=[...header.matchAll(/<img\b[^>]*class=["'][^"']*profile-head__nat[^"']*["'][^>]*>/gi)].at(-1)?.[0];
 const country=flag?.match(/src=["'](?:https?:)?\/\/static\.tournamentsoftware\.com\/content\/images\/flags\/([A-Z]{3})\.svg["']/i)?.[1]?.toUpperCase();
 return country?{...candidate,circuit:'tennis-europe',nationality:country,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+id.toLowerCase()}:null;
}
export async function lookupTeDirectory(name,publicPage){
 const candidates=new Map(),seenPages=new Set();let complete=false;
 for(let page=1;page<=10;page++){
  const response=await publicPage('https://te.tournamentsoftware.com/find/player/DoSearch?'+new URLSearchParams({Query:name,Page:String(page),SportID:'0'}),{headers:{'X-Requested-With':'XMLHttpRequest'}});
  if(new URL(response.url).pathname!=='/find/player/DoSearch')throw Error('te_search_redirected');
  const found=teSearchCandidates(response.text);
  if(!found.length){if(/\/player-profile\//i.test(response.text))throw Error('te_search_unparsed');complete=true;break;}
  const signature=found.map(p=>p.officialId).sort().join('|');if(seenPages.has(signature))throw Error('te_search_pagination_repeated');seenPages.add(signature);
  for(const p of found)if(playerNameKey(p.name)===playerNameKey(name))candidates.set(p.officialId,p);
 }
 if(!complete)throw Error('te_search_incomplete');
 const evidence=[];
 // Validate every exact-name candidate; a failed candidate must not create false uniqueness.
 for(const p of candidates.values()){const page=await publicPage(p.profileUrl),e=teProfileEvidence(page.text,p,page.url);if(!e)throw Error('te_profile_unverified');evidence.push(e);}
 return evidence;
}
export function teDirectoryEvidence(html){
 const out=[];
 // Associate metadata within one result row, never from a neighbouring person.
 for(const tr of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const row=tr[1],country=row.match(/\[([A-Z]{3})\]/)?.[1]||row.match(/(?:data-country|data-nationality|alt)=["']([A-Z]{3})["']/i)?.[1]||'';
  if(!country)continue;
  for(const a of row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   const u=new URL(decode(a[1]),'https://te.tournamentsoftware.com'),id=u.pathname.match(/^\/player-profile\/([a-f0-9-]{36})\/?$/i)?.[1]||(u.pathname==='/profile/default.aspx'?u.searchParams.get('id'):'');
   if(u.hostname!=='te.tournamentsoftware.com'||!validOfficialId('tennis-europe',id))continue;
   const name=clean(a[2]);if(!name)continue;
   out.push({circuit:'tennis-europe',name,officialId:id,nationality:country.toUpperCase(),profileUrl:'https://te.tournamentsoftware.com/player-profile/'+id});
  }
 }return out;
}
