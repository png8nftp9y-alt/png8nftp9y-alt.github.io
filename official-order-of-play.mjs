import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const cfg=JSON.parse(await fs.readFile('players.json','utf8'));
let former={players:[]};try{former=JSON.parse(await fs.readFile('former-players.json','utf8'))}catch{}
const players=[...(cfg.players||[]),...(former.players||[])];
const now=new Date().toISOString(),from='2025-12-18';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const aliases=new Map;for(const p of players)for(const a of[p.name,...(p.aliases||[])])if(norm(a).split(' ').length>1)aliases.set(norm(a),p);
const parseDate=s=>{let m=String(s).match(/(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=String(s).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null};
const parseTime=s=>{const m=String(s).match(/(?:not before|nb|ore|at)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)/i);return m?`${m[1].padStart(2,'0')}:${m[2]}`:null};
function upsertMatch(m){data.matches||=[];if(!m.date||m.date<from)return;const key=m.key||`${m.sourceId}|${m.playerId}|${m.date}|${m.time||''}|${norm(m.tournamentName)}|${norm(m.opponent||'')}`;const i=data.matches.findIndex(x=>x.key===key|| (x.playerId===m.playerId&&x.date===m.date&&x.time===m.time&&norm(x.tournamentName)===norm(m.tournamentName)&&norm(x.opponent||'')===norm(m.opponent||'')) );
const value={...m,key,status:m.status||'scheduled',lastSeen:now}; if(i>=0)data.matches[i]={...data.matches[i],...value}; else data.matches.push(value);
}
const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({locale:'en-GB',timezoneId:'Europe/Rome',userAgent:'Mozilla/5.0 CourtWatchOrderOfPlay/1.0'});
let pages=0,found=0,errors=[];
async function scanUrl(url,tournament){const page=await ctx.newPage();try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(2500);const title=await page.title().catch(()=>tournament.name||url);const text=await page.locator('body').innerText({timeout:15000}).catch(()=> '');pages++;const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);for(let i=0;i<lines.length;i++){const chunk=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+4)).join(' · ');const hay=norm(chunk);for(const [alias,p] of aliases){if(!hay.includes(alias))continue;const date=parseDate(chunk)||tournament.startDate||tournament.endDate;const time=parseTime(chunk);const court=(chunk.match(/(?:court|campo)\s*([A-Za-z0-9-]+)/i)||[])[1]||null;let opponent=null;const parts=chunk.split(/\s+(?:vs\.?|v\.?|contro)\s+/i);if(parts.length>1)opponent=parts[1].split(/ · |,|\s{2,}/)[0].trim();upsertMatch({playerId:p.id,playerName:p.name,tournamentName:tournament.name||title,location:tournament.location||'',date,time,court,opponent,sourceId:tournament.sourceId,sourceName:tournament.sourceName,url,eventType:/doubles|doppio/i.test(chunk)?'doubles':'singles',orderOfPlaySource:url});found++;}}
}}catch(e){errors.push(`${url}: ${e.message}`)}finally{await page.close().catch(()=>{})}}
for(const t of (data.tournaments||[]).filter(t=>['tennis-europe','itf'].includes(t.sourceId)&&t.url)){const base=t.url.replace(/\/?$/,'/');const urls=[base,base+'order-of-play/',base+'matches/',base+'draws/',base+'acceptance-list/'];for(const u of urls)await scanUrl(u,t)}
await browser.close();data.generatedAt=now;data.officialOrderOfPlaySync={lastRun:now,status:errors.length?'partial':'complete',pagesChecked:pages,matchesFoundOrUpdated:found,coverageFrom:from,errors:errors.slice(0,50)};await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');await fs.writeFile('official-order-of-play.json',JSON.stringify(data.officialOrderOfPlaySync,null,2)+'\n');console.log(JSON.stringify(data.officialOrderOfPlaySync,null,2));
