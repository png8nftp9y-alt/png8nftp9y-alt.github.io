import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function profileId(url){return (String(url).match(/player-profile\/([0-9A-F-]{36})/i)||[])[1]||''}
function clean(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function hrefs(html,base){const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push({url:u,text:clean(m[2]).slice(0,160)})}return out}
function scripts(html,base){const out=[];const re=/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push(u)}return out}
async function get(url,headers={},attempt=0){try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 CourtWatch-v3-te-route-diagnostic/2.0','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8','accept-language':'en-GB,en;q=0.9,it;q=0.8',...headers}});const text=await r.text();return {url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type')||'',setCookie:r.headers.get('set-cookie')||'',location:r.headers.get('location')||'',text};}catch(e){if(attempt<2){await sleep(500*(attempt+1));return get(url,headers,attempt+1)}return {url,status:0,ok:false,error:e.message,text:''}}}
function pageSummary(r,url){const hs=hrefs(r.text,url);const body=(r.text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||r.text;const visible=clean(body);return {url,status:r.status,contentType:r.contentType,setCookie:r.setCookie.slice(0,500),location:r.location,length:r.text.length,title:clean((r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''),visibleText:visible.slice(0,3000),scripts:scripts(r.text,url),links:hs.filter(x=>/tournament|match|player|profile|sport|calendar|result|ranking|cookie|login|account/i.test(x.url+' '+x.text)).slice(0,120),rawSignals:{hasMessagePage:/message-page/.test(r.text),hasLogin:/login|account|sign in/i.test(r.text),hasCookie:/cookie|consent|privacy/i.test(r.text),hasTournamentId:/sport\/tournament/i.test(r.text),hasPlayerName:/Aila|Daniele|Edoardo|Filippo|Renzulli|Scozzafava/i.test(r.text)}}}
const players=(await readJson('players.json',{players:[]})).players||[];
const profiles=[];for(const p of players.filter(p=>(p.circuits||[]).some(c=>/tennis europe/i.test(String(c))))){for(const url of [...new Set([p.profileSync?.tennisEurope?.url,...(p.officialUrls?.tennisEurope||[])].filter(Boolean))]){const id=profileId(url);if(id)profiles.push({playerId:p.id,playerName:p.name,id,url})}}
const sample=profiles.slice(0,3);
const results=[];
for(const p of sample){
 const candidates=[
  p.url,
  `https://te.tournamentsoftware.com/player-profile/${p.id}`,
  `https://www.tournamentsoftware.com/player-profile/${p.id}`,
  `https://te.tournamentsoftware.com/player-profile/${p.id}/tournaments`,
  `https://te.tournamentsoftware.com/player-profile/${p.id}/matches`,
  `https://te.tournamentsoftware.com/sport/player.aspx?id=${p.id}`,
  `https://te.tournamentsoftware.com/sport/player.aspx?player=${p.id}`,
  `https://te.tournamentsoftware.com/find/player?q=${encodeURIComponent(p.playerName)}`,
  `https://te.tournamentsoftware.com/api/player-profile/${p.id}`,
  `https://te.tournamentsoftware.com/api/players/${p.id}`,
  `https://te.tournamentsoftware.com/api/player/${p.id}/matches`,
  `https://te.tournamentsoftware.com/api/player/${p.id}/tournaments`
 ];
 const pages=[];
 for(const url of [...new Set(candidates)]){const r=await get(url);pages.push(pageSummary(r,url));await sleep(200)}
 results.push({player:p,pages})
}
const out={generatedAt:NOW,status:'tennis_europe_access_route_diagnostic_complete',profiles:profiles.length,sampled:sample.length,results};
await writeJson('dist/v3/tennis_europe_route_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:out.generatedAt,status:out.status,profiles:out.profiles,sampled:out.sampled,summary:results.map(r=>({player:r.player,pages:r.pages.map(p=>({url:p.url,status:p.status,title:p.title,length:p.length,signals:p.rawSignals,visibleText:p.visibleText.slice(0,400),links:p.links.slice(0,5),scripts:p.scripts.slice(0,5)}))}))},null,2));
