import fs from 'node:fs/promises';
import {publicCookiePair} from '../../cloudflare/app-api/lib/live-profile-evidence.mjs';
const directory='tmp/official-player-directory';await fs.mkdir(directory,{recursive:true});
const jars=new Map();
async function page(url,{method='GET',body}={}){
 for(let i=0;i<6;i++){
  const host=new URL(url).hostname,jar=jars.get(host)||new Map();jars.set(host,jar);
  const r=await fetch(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded',Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}});
  for(const c of r.headers.getSetCookie()){const pair=publicCookiePair(c);if(pair)jar.set(...pair);}
  const text=await r.text(),next=r.headers.get('location');
  if(next&&r.status>=300&&r.status<400){url=new URL(next,url).href;method='GET';body=undefined;continue;}
  if(r.status!==200)throw Error('directory_http_'+r.status);return {url,text};
 }throw Error('directory_redirect_limit');
}
let p=await page('https://te.tournamentsoftware.com/find/player');
if(p.url.includes('/cookiewall')){
 await page('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false',CookiePurposes:'1'}).toString()});
 p=await page('https://te.tournamentsoftware.com/find/player');
}
const forms=[...p.text.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map(m=>m[0]);
const scripts=[...p.text.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],p.url).href).filter(u=>new URL(u).hostname==='static.tournamentsoftware.com');
const report={url:p.url,cookiewall:p.url.includes('/cookiewall'),forms,scripts,bytes:p.text.length};
await fs.writeFile(directory+'/directory.html',p.text);await fs.writeFile(directory+'/report.json',JSON.stringify(report));
for(const [i,url]of scripts.entries()){const s=await page(url);await fs.writeFile(directory+'/script-'+i+'.js',s.text);}
console.log(JSON.stringify(report));
if(report.cookiewall)throw Error('directory_consent_not_applied');
// Verified form action and parameter names from the official directory.
const result=await page('https://te.tournamentsoftware.com/find/player/DoSearch?'+new URLSearchParams({Query:'Richie Kennedy',Page:'1',SportID:'0'}));
// Publish structure only: no names, player identifiers, cookies or raw profile records.
const masked=result.text.replace(/>[\s\S]*?</g,m=>'>[text:'+m.slice(1,-1).trim().length+']<').replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,'PROFILE_ID');
await fs.writeFile(directory+'/search-structure.html',masked);
console.log(JSON.stringify({searchBytes:result.text.length,resultRows:(result.text.match(/<tr\b/gi)||[]).length,resultItems:(result.text.match(/<li\b/gi)||[]).length,profileLinks:(result.text.match(/player-profile/gi)||[]).length}));
