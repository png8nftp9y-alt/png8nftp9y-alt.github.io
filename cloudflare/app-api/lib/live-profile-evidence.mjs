import {validOfficialId,profileEvidence} from './player-profile-evidence.mjs';
const direct=(o,names)=>Object.entries(o||{}).find(([k])=>names.includes(k.toLowerCase()))?.[1];
export function itfSearchEvidence(payload,expectedId){
 const out=[];
 function walk(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}
  const id=String(direct(v,['playerid','personid','worldtennisid','id'])||'');
  if(validOfficialId('itf',id)&&id===String(expectedId)){
   const name=direct(v,['playername','fullname','displayname','name'])||[direct(v,['givenname','firstname']),direct(v,['familyname','lastname'])].filter(Boolean).join(' ');
   const nationality=String(direct(v,['nationalitycode','countrycode','nationality'])||'').toUpperCase();
   const profileUrl=direct(v,['profileurl','playerprofileurl','profilelink','url']);
   const e=profileEvidence('itf',{name,officialId:id,nationality,...(typeof profileUrl==='string'?{profileUrl}: {})});
   if(e?.profileUrl)out.push({...e,name,circuit:'itf'});
  }
  Object.values(v).forEach(walk);
 }walk(payload);return out;
}
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
const clean=s=>decode(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
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
