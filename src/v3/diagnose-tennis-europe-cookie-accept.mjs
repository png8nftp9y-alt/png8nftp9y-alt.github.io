import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function clean(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function cookiePair(setCookie){return (setCookie||'').split(/,(?=\s*[^;]+=)/).map(x=>x.split(';')[0].trim()).filter(Boolean).join('; ')}
function hidden(html){const out={}; const re=/<input\b[^>]*type=["']hidden["'][^>]*>/gi; let m; while((m=re.exec(html))){const tag=m[0]; const n=(tag.match(/name=["']([^"']+)/i)||[])[1]; const v=(tag.match(/value=["']([^"']*)/i)||[])[1]||''; if(n) out[n]=v.replace(/&quot;/g,'"').replace(/&amp;/g,'&');} return out}
async function req(method,url,{cookie='',body=null,contentType='application/x-www-form-urlencoded'}={}){const r=await fetch(url,{method,redirect:'manual',headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-te-cookie-accept/1.0','accept':'text/html,application/json,*/*','accept-language':'en-GB,en;q=0.9,it;q=0.8','content-type':contentType,cookie},body}); const text=await r.text(); return {url,method,status:r.status,location:r.headers.get('location')||'',setCookie:r.headers.get('set-cookie')||'',contentType:r.headers.get('content-type')||'',text};}
const start='https://te.tournamentsoftware.com/tournaments';
const r1=await req('GET',start);
const c1=cookiePair(r1.setCookie);
const wall='https://te.tournamentsoftware.com'+r1.location;
const r2=await req('GET',wall,{cookie:c1});
const h=hidden(r2.text);
const forms=[...r2.text.matchAll(/<form[\s\S]*?<\/form>/gi)].map(m=>m[0].slice(0,3000));
const attempts=[];
const paths=['/cookiewall/Accept','/cookiewall/Save','/cookiewall','/cookiewall/Index'];
const bodies=[
 {...h,ReturnUrl:'/tournaments',SettingsOpen:'false',Basic:true,Analytics:true,PersonalizedAds:true,SocialMedia:true},
 {...h,returnurl:'/tournaments','purposes':'1,2,3,4','submit':'Accept'},
 {...h,'CookieConsent':'true','Accept':'true'},
 {...h,'SelectedCookieCategories':'Basic,Analytics,PersonalizedAds,SocialMedia'}
];
for(const path of paths){for(const b of bodies){const body=new URLSearchParams(); for(const [k,v] of Object.entries(b)) body.append(k,String(v)); try{const rp=await req('POST','https://te.tournamentsoftware.com'+path,{cookie:c1,body:body.toString()}); const ck=[c1,cookiePair(rp.setCookie)].filter(Boolean).join('; '); const after=await req('GET',start,{cookie:ck}); attempts.push({path,body:Object.fromEntries(body),post:{status:rp.status,location:rp.location,setCookie:rp.setCookie.slice(0,500),text:clean(rp.text).slice(0,500)},after:{status:after.status,location:after.location,title:clean((after.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''),text:clean(after.text).slice(0,1000),setCookie:after.setCookie.slice(0,500),cookieWall:/cookie|consent|Select all and save/i.test(after.text),hasTournament:/tournament/i.test(after.text)}})}catch(e){attempts.push({path,error:e.message})}}}
const out={generatedAt:NOW,start:{status:r1.status,location:r1.location,setCookie:r1.setCookie},wall:{url:wall,status:r2.status,setCookie:r2.setCookie,hidden:h,forms},attempts};
await writeJson('dist/v3/tennis_europe_cookie_accept_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:NOW,hidden:h,attempts:attempts.map(a=>({path:a.path,post:a.post,after:a.after,error:a.error}))},null,2));
