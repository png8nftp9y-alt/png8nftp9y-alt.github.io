import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function clean(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function links(html,base){const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push({url:u,text:clean(m[2]).slice(0,180)})}return out}
function scripts(html,base){const out=[];const re=/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push(u)}return out}
async function get(url){try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-te-tournament-route-diagnostic/1.0','accept':'text/html,application/json,*/*','accept-language':'en-GB,en;q=0.9,it;q=0.8'}});const text=await r.text();return {url,status:r.status,contentType:r.headers.get('content-type')||'',text}}catch(e){return {url,status:0,error:e.message,text:''}}}
function summarize(r){const l=links(r.text,r.url);const s=scripts(r.text,r.url);const body=(r.text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||r.text;const api=[...r.text.matchAll(/https?:\/\/[^"'`\s<>]+|\/api\/[^"'`\s<>]+|api\/[A-Za-z0-9_?=&/.: -]+|Tournament[A-Za-z0-9_]+|tournament[A-Za-z0-9_]+|calendar|acceptance|entry|ranking/gi)].map(m=>m[0]);return {url:r.url,status:r.status,contentType:r.contentType,length:r.text.length,title:clean((r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''),text:clean(body).slice(0,2500),links:l.filter(x=>/tournament|sport|calendar|acceptance|player|draw|match|category|events/i.test(x.url+' '+x.text)).slice(0,200),scripts:s.slice(0,80),apiHints:[...new Set(api)].slice(0,300),signals:{hasTournament:/tournament/i.test(r.text),hasSportTournament:/sport\/tournament/i.test(r.text),hasNextData:/__NEXT_DATA__|webpack|static\/js/i.test(r.text),hasCookie:/cookie|privacy|consent/i.test(r.text)}}}
const urls=[
 'https://te.tournamentsoftware.com/',
 'https://te.tournamentsoftware.com/tournaments',
 'https://te.tournamentsoftware.com/tournaments?from=2025-12-18',
 'https://te.tournamentsoftware.com/sport/tournaments.aspx',
 'https://te.tournamentsoftware.com/sport/tournaments.aspx?from=2025-12-18',
 'https://te.tournamentsoftware.com/tournamentcalendar',
 'https://www.tenniseurope.org/page/16383/Tournament-calendar',
 'https://www.tenniseurope.org/page/16452/Tournament-calendar',
 'https://www.tenniseurope.org/page/16356/Tournaments',
 'https://www.tournamentsoftware.com/',
 'https://www.tournamentsoftware.com/sport/tournaments.aspx',
 'https://e.tournamentsoftware.com/',
 'https://e.tournamentsoftware.com/tournaments',
 'https://e.tournamentsoftware.com/sport/tournaments.aspx'
];
const pages=[];for(const u of urls)pages.push(summarize(await get(u)));
const scriptDetails=[];
for(const p of pages){for(const s of p.scripts.filter(x=>/tournament|app|main|bundle|chunk|static|js/i.test(x)).slice(0,8)){const r=await get(s);scriptDetails.push({sourcePage:p.url,url:s,status:r.status,contentType:r.contentType,length:r.text.length,hints:[...new Set([...r.text.matchAll(/https?:\/\/[^"'`\s<>]+|\/api\/[^"'`\s<>]+|api\/[A-Za-z0-9_?=&/.: -]+|Tournament[A-Za-z0-9_]+|tournament[A-Za-z0-9_]+|calendar|acceptance|entry|player-profile|sport\/tournament/gi)].map(m=>m[0]))].slice(0,200),snippet:r.text.slice(0,1500)})}}
const out={generatedAt:NOW,status:'te_tournament_route_diagnostic_complete',pages,scriptDetails};
await writeJson('dist/v3/tennis_europe_tournament_route_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:NOW,pages:pages.map(p=>({url:p.url,status:p.status,title:p.title,length:p.length,signals:p.signals,links:p.links.slice(0,10),apiHints:p.apiHints.slice(0,20)})),scriptDetails:scriptDetails.map(s=>({url:s.url,status:s.status,length:s.length,hints:s.hints.slice(0,30)}))},null,2));
