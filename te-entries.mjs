import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const cfg=JSON.parse(await fs.readFile('players.json','utf8'));
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const players=(cfg.players||[]).filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='TENNIS EUROPE'));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const decode=s=>String(s||'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const abs=(h,b)=>{try{return new URL(h,b).href}catch{return null}};
const parseDate=s=>{let m=String(s).match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);if(m)return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;m=String(s).match(/(20\d{2})-(\d{2})-(\d{2})/);return m?m[0]:null};
const from=new Date('2026-06-20T00:00:00Z'),to=new Date(Date.now()+240*864e5),today=new Date().toISOString().slice(0,10),now=new Date().toISOString(),errors=[],hits=[],pages=new Set(),tournamentUrls=new Set();
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({locale:'en-GB',timezoneId:'Europe/Rome'});
const page=await ctx.newPage();
async function acceptCookies(){const b=page.getByText(/^ACCEPT$/i,{exact:true});if(await b.count())await b.first().click({force:true}).catch(()=>{})}
async function collect(url){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await acceptCookies();await page.waitForTimeout(250);pages.add(url);const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.href));for(const u of links)if(/\/sport\/tournament(?:\/|\?|$)|\/tournament\?id=/i.test(u))tournamentUrls.add(u)}catch(e){errors.push(`${url}: ${e.message}`)}}
await collect('https://te.tournamentsoftware.com/tournaments');
for(let d=new Date(from);d<=to;d=new Date(d.getTime()+14*864e5)){
  const e=new Date(Math.min(to.getTime(),d.getTime()+13*864e5));
  const url=`https://te.tournamentsoftware.com/find?DateFilterType=0&StartDate=${d.toISOString().slice(0,10)}&EndDate=${e.toISOString().slice(0,10)}&StatusFilterID=0&page=1`;
  await collect(url);
}
for(const p of players){const u=p.profileSync?.tennisEurope?.url||(p.officialUrls?.tennisEurope||[]).find(x=>/profile/i.test(x));if(u)await collect(u)}
async function get(url){const r=await ctx.request.get(url,{headers:{accept:'text/html','user-agent':'Mozilla/5.0 CourtWatchTE/2.0'}});if(!r.ok())throw Error(`${r.status()} ${url}`);return r.text()}
const urls=[...tournamentUrls];let idx=0;
async function worker(){while(idx<urls.length){const tournamentUrl=urls[idx++];try{
  const root=await get(tournamentUrl);pages.add(tournamentUrl);const candidates=new Set([tournamentUrl]);
  for(const m of root.matchAll(/href=["']([^"']+)["']/gi)){const u=abs(m[1],tournamentUrl);if(u&&u.includes('te.tournamentsoftware.com')&&/sport\/(players|draws?|events?|matches|tournament)|accept|entry/i.test(u))candidates.add(u)}
  for(const u of [...candidates].slice(0,60)){let html;try{html=u===tournamentUrl?root:await get(u);pages.add(u)}catch(e){errors.push(e.message);continue}const text=decode(html),upper=norm(text);
    for(const p of players){const aliases=[p.name,...(p.aliases||[])].filter(a=>norm(a).split(' ').length>1);const alias=aliases.find(a=>upper.includes(norm(a)));if(!alias)continue;const at=upper.indexOf(norm(alias)),context=text.slice(Math.max(0,at-1500),at+3000),rawAt=norm(html).indexOf(norm(alias)),raw=rawAt>=0?html.slice(Math.max(0,rawAt-1800),rawAt+3200):html;const entryStatus=/MAIN DRAW|DIRECT ACCEPTANCE|ACCEPTED/i.test(context)?'Main Draw':/QUALIFYING|QUALIFICATION/i.test(context)?'Qualifying':/ALTERNATE|ALTERNATES/i.test(context)?'Alternates':'Iscrizione verificata';const pos=(context.match(/(?:alternate|position|list|order|number)[^0-9]{0,30}(\d{1,3})/i)||[])[1];const nation=(raw.match(/flags?\/([A-Z]{3})\.(?:svg|png)/i)||[])[1]||null;const dates=[...text.matchAll(/(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})/g)].map(x=>parseDate(x[0])).filter(Boolean).sort();const title=decode((root.match(/<title[^>]*>([^<]+)/i)||[])[1])||'Torneo Tennis Europe';const id=(tournamentUrl.match(/[?&]id=([0-9A-F-]{36})/i)||tournamentUrl.match(/tournament\/([0-9A-F-]{36})/i)||[])[1]||tournamentUrl;if(!hits.some(h=>h.playerId===p.id&&h.id===id))hits.push({playerId:p.id,playerName:p.name,id,name:title.replace(/\s*[-|].*Tennis Europe.*$/i,'').trim(),location:'',startDate:dates[0]||null,endDate:dates.at(-1)||dates[0]||null,status:entryStatus,position:pos?Number(pos):null,nation,url:u})}
  }
}catch(e){errors.push(`${tournamentUrl}: ${e.message}`)}}}
await Promise.all(Array.from({length:8},worker));await browser.close();
for(const h of hits){const key=`te-${h.id}|${h.playerId}`,old=(data.tournaments||[]).find(t=>t.playerId===h.playerId&&String(t.teTournamentId)===String(h.id)),value={key,playerId:h.playerId,playerName:h.playerName,name:h.name,location:h.location,sourceId:'tennis-europe',sourceName:'Tennis Europe',url:h.url,startDate:h.startDate,endDate:h.endDate,status:h.endDate&&h.endDate<today?'finished':h.startDate&&h.startDate>today?'upcoming':'active',entryStatus:h.status,entryPosition:h.position,playerNationality:h.nation,teTournamentId:h.id,lastSeen:now};if(old)Object.assign(old,value);else(data.tournaments||=[]).push(value);data.entryStatuses=(data.entryStatuses||[]).filter(x=>!(x.playerId===h.playerId&&x.tournamentKey===key));data.entryStatuses.push({playerId:h.playerId,playerName:h.playerName,tournamentKey:key,tournamentName:h.name,sourceId:'tennis-europe',status:h.status,position:h.position,url:h.url,observedAt:now})}
data.generatedAt=now;data.teEntryDiscovery={lastRun:now,status:tournamentUrls.size?(errors.length?'partial':'complete'):'failed',coverageFrom:'2026-06-20',coverageUntil:to.toISOString().slice(0,10),profilesChecked:players.length,tournamentsChecked:tournamentUrls.size,pagesChecked:pages.size,entriesFound:hits.length,errors:errors.slice(0,100)};await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');await fs.writeFile('te-entries.json',JSON.stringify({...data.teEntryDiscovery,hits},null,2)+'\n');console.log(JSON.stringify(data.teEntryDiscovery,null,2));if(!tournamentUrls.size)process.exitCode=2;
