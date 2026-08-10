import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function profileId(url){return (String(url).match(/player-profile\/([0-9A-F-]{36})/i)||[])[1]||''}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function hrefs(html,base){const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push({url:u,text:clean(m[2].replace(/<[^>]+>/g,' ')).slice(0,160)})}return out}
function scripts(html,base){const out=[];const re=/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi;let m;while((m=re.exec(html))){let u=m[1].replace(/&amp;/g,'&');try{u=new URL(u,base).toString()}catch{};out.push(u)}return out}
function interesting(html){const terms=['tournament','match','player','profile','calendar','activity','result','ranking','api','graphql','odata','umbraco','tournamentsoftware','tennis europe'];const lower=html.toLowerCase();return terms.reduce((a,t)=>{a[t]=(lower.match(new RegExp(t.replace(/ /g,'\\s+'),'g'))||[]).length;return a},{})}
async function get(url,attempt=0){try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-te-route-diagnostic/1.0','accept':'text/html,application/json,*/*','accept-language':'en,it;q=0.8'}});const text=await r.text();return {url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type')||'',text};}catch(e){if(attempt<2){await sleep(500*(attempt+1));return get(url,attempt+1)}return {url,status:0,ok:false,error:e.message,text:''}}}
const players=(await readJson('players.json',{players:[]})).players||[];
const te=players.filter(p=>(p.circuits||[]).some(c=>/tennis europe/i.test(String(c))));
const profiles=[];
for(const p of te){const urls=[p.profileSync?.tennisEurope?.url,...(p.officialUrls?.tennisEurope||[])].filter(Boolean);for(const url of [...new Set(urls)]){const id=profileId(url);if(id)profiles.push({playerId:p.id,playerName:p.name,id,url})}}
const sample=profiles.slice(0,6);
const results=[];
for(const p of sample){const candidates=[p.url,`https://te.tournamentsoftware.com/player-profile/${p.id}`,`https://www.tournamentsoftware.com/player-profile/${p.id}`,`https://te.tournamentsoftware.com/player-profile/${p.id}/tournaments`,`https://te.tournamentsoftware.com/player-profile/${p.id}/matches`,`https://te.tournamentsoftware.com/sport/player.aspx?id=${p.id}`];const pages=[];for(const url of candidates){const r=await get(url);const hs=hrefs(r.text,url);pages.push({url,status:r.status,contentType:r.contentType,length:r.text.length,title:(r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/\s+/g,' ').trim()||'',counts:interesting(r.text),scripts:scripts(r.text,url).slice(0,30),links:hs.filter(x=>/tournament|match|player|profile|sport|calendar|result|ranking/i.test(x.url+' '+x.text)).slice(0,80),htmlSnippet:r.text.slice(0,2500)});await sleep(150)}results.push({player:p,pages})}
const out={generatedAt:NOW,status:'tennis_europe_route_diagnostic_complete',profiles:profiles.length,sampled:sample.length,results};
await writeJson('dist/v3/tennis_europe_route_diagnostic.json',out);
console.log(JSON.stringify({...out,results:results.map(r=>({player:r.player,pages:r.pages.map(p=>({url:p.url,status:p.status,contentType:p.contentType,length:p.length,title:p.title,counts:p.counts,scriptCount:p.scripts.length,linkCount:p.links.length,links:p.links.slice(0,10)}))}))},null,2));
