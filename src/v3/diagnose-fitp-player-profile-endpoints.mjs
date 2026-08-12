import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const CARDS=['3876473411','7578095942'];
const SCRIPT='https://www.fitp.it/Areas/Federtennis/Scripts/SearchPlayers/player-details_v7.2.2.js';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function req(method,url,body,card){const r=await fetch(url,{method,headers:{'content-type':'application/json','accept':'text/html,application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-fitp-profile-endpoint-diagnostic/1.3-exact-stats','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(Buffer.from(card||CARDS[0]).toString('base64'))},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return {url,method,status:r.status,contentType:r.headers.get('content-type')||'',text,json};}
function windows(text,terms){const out=[];for(const term of terms){let idx=0;while((idx=text.toLowerCase().indexOf(term.toLowerCase(),idx))!==-1){out.push({term,index:idx,context:text.slice(Math.max(0,idx-1800),Math.min(text.length,idx+2600))});idx+=term.length}}return out}
const script=await req('GET',SCRIPT);
const terms=['player/sheet','player/stats','player/stats/career','player/stats/focus','player/ranking','baseStat','Activity','Attività','Tournament','tornei','competition','year','idDiscipline','membershipCard','cardNumber','guid'];
const endpointWindows=windows(script.text,terms);
const endpoints=[...new Set([...script.text.matchAll(/https?:\/\/[^"'`\s<>]+|\/api\/[^"'`\s<>]+|api\/[A-Za-z0-9_?=&/.:\-]+/gi)].map(m=>m[0]))];
const bases=['https://dp-fit-prod-function.azurewebsites.net'];
const paths=['/api/v6/player/sheet','/api/v6/player/sheet/simple','/api/v6/player/stats','/api/v6/player/stats/career','/api/v6/player/stats/focus','/api/v6/player/ranking'];
const calls=[];
for(const card of CARDS){const b64=Buffer.from(card).toString('base64');const bodies=[{cardNumber:b64},{cardNumber:b64,idDiscipline:4332},{cardNumber:b64,discipline:4332},{cardNumber:b64,year:2026},{cardNumber:b64,season:2026},{membershipCard:b64},{membershipCard:b64,idDiscipline:4332},{card:b64},{tessera:b64}];for(const base of bases)for(const path of paths)for(const body of bodies){try{const r=await req('POST',base+path,body,card);calls.push({card,path,body,status:r.status,contentType:r.contentType,text:r.text.slice(0,2000),json:r.json});}catch(e){calls.push({card,path,body,error:e.message})}}}
const useful=calls.filter(c=>c.status===200 && (c.json || (c.text||'').trim()));
const out={generatedAt:NOW,status:'fitp_player_exact_stats_probe_complete',script:{url:SCRIPT,status:script.status,contentType:script.contentType,length:script.text.length,endpoints,endpointWindows:endpointWindows.slice(0,250)},calls,useful};
await writeJson('dist/v3/fitp_player_profile_endpoint_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,scriptLength:script.text.length,endpoints,windowCount:endpointWindows.length,useful:useful.map(u=>({card:u.card,path:u.path,body:u.body,status:u.status,text:u.text?.slice(0,500),json:u.json}))},null,2));
