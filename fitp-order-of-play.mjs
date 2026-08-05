import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ymd=today.replaceAll('-','');
const now=new Date().toISOString();
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const current=JSON.parse(await fs.readFile('players.json','utf8'));
let former={players:[]};try{former=JSON.parse(await fs.readFile('former-players.json','utf8'))}catch{}
const players=[...(current.players||[]),...(former.players||[])];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const aliases=[];for(const p of players)for(const a of [p.name,...(p.aliases||[])]){const n=norm(a);if(n.split(' ').length>1)aliases.push({n,p,raw:a})}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json; charset=utf-8','user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/4.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`${r.status} ${text.slice(0,120)}`);return text?JSON.parse(text):null}
async function download(file){const url=BASE+'/api/v2/puc/competizione/ordine-di-gioco/download?competitionId='+encodeURIComponent(BRALLO)+(file?'&fileName='+encodeURIComponent(file):'');const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/4.0','referer':'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+BRALLO}});const buf=Buffer.from(await r.arrayBuffer());if(!r.ok||buf.length<1000)throw Error(`download ${file||'oop.pdf'} ${r.status} ${buf.length}`);const safe=(file||'oop.pdf').replace(/[^A-Za-z0-9_.-]/g,'_');const path='/tmp/'+safe;await fs.writeFile(path,buf);return path}
function parseDateFromFile(file){const m=String(file||'').match(/(20\d{2})(\d{2})(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:today}
function findTime(s){const m=String(s).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:null}
function findCourt(s){const m=String(s).match(/\b(?:campo|court|c\.?po)\s*([A-Za-z0-9]+)\b/i)||String(s).match(/\bC\s*([0-9]{1,2})\b/i);return m?String(m[1]).toUpperCase():null}
function isDoubleLine(s){return /\s-\s/.test(s)||/Doppio/i.test(s)}
function opponentFromLine(line,playerName){let t=line.replace(/\s+/g,' ').trim();const pn=norm(playerName);const parts=t.split(/\s+(?:vs\.?|v\.?|contro|c\/|-)\s+/i);if(parts.length>1){const side=parts.map(x=>x.trim());const idx=side.findIndex(x=>norm(x).includes(pn)||pn.includes(norm(x)));const opp=side[idx===0?1:0]||side[1];return opp.replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,'').replace(/\b(?:campo|court|c\.?po)\s*[A-Za-z0-9]+\b/ig,'').trim()}return null}
let files=[],downloaded=0,parsed=0,updated=0,withTime=0,withCourt=0,errors=[],hits=[];
try{const list=await post('/api/v3/puc/competizione/ordine-di-gioco/list',{competitionId:BRALLO});files=Array.isArray(list)?list:[];}catch(e){errors.push('list: '+e.message)}
if(!files.length)files=['oop.pdf'];
const selected=files.filter(f=>String(f).includes(ymd));
const toProcess=(selected.length?selected:files).slice(-4);
const occurrences=[];
for(const file of toProcess){try{const pdf=await download(file==='oop.pdf'?null:file);downloaded++;const out='/tmp/oop-'+downloaded+'.txt';await exec('pdftotext',['-layout',pdf,out]);const text=await fs.readFile(out,'utf8');await fs.writeFile('fitp-order-of-play-text.txt',text.slice(0,50000));parsed++;const date=parseDateFromFile(file);const lines=text.split(/\n/).filter(Boolean);for(let i=0;i<lines.length;i++){const window=lines.slice(Math.max(0,i-4),Math.min(lines.length,i+5));const chunk=window.join(' ');const time=findTime(chunk);if(!time)continue;const hay=norm(chunk);for(const {n,p} of aliases){if(hay.includes(n)){occurrences.push({player:p,time,date,file,line:chunk.replace(/\s+/g,' ').trim(),isDouble:isDoubleLine(chunk),court:findCourt(chunk),opponent:opponentFromLine(chunk,p.name)})}}}}catch(e){errors.push(`${file}: ${e.message}`)}}
// Dedupe same player/time/type lines, preserving distinct singles+doubles slots.
const byPlayer=new Map();
for(const o of occurrences){const arr=byPlayer.get(o.player.id)||[];if(!arr.some(x=>x.time===o.time&&x.isDouble===o.isDouble&&x.line.slice(0,80)===o.line.slice(0,80)))arr.push(o);byPlayer.set(o.player.id,arr)}
function scoreMatch(m,o){let s=0;if(m.date===o.date)s+=20;if(m.date===today)s+=15;if(!m.time)s+=20;if(o.isDouble&&(/doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''}`)||m.partner))s+=30;if(!o.isDouble&&!(/doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''}`)||m.partner))s+=15;if(o.opponent){const on=norm(o.opponent),mn=norm(m.opponent||'');if(mn&&on&&mn.split(' ').some(x=>x.length>2&&on.includes(x)))s+=30;}if(m.result)s-=10;return s}
const touched=new Set();
for(const [pid,arr] of byPlayer){const ms=(data.matches||[]).filter(m=>m.playerId===pid&&m.competitionId===BRALLO);for(const o of arr.sort((a,b)=>a.time.localeCompare(b.time))){const candidates=ms.filter(m=>!touched.has(m.key||m.id||`${m.playerId}|${m.opponent}|${m.draw}|${m.round}|${m.eventType}`)).sort((a,b)=>scoreMatch(b,o)-scoreMatch(a,o));const chosen=candidates[0]||ms.sort((a,b)=>scoreMatch(b,o)-scoreMatch(a,o))[0];if(!chosen)continue;const uid=chosen.key||chosen.id||`${chosen.playerId}|${chosen.opponent}|${chosen.draw}|${chosen.round}|${chosen.eventType}`;touched.add(uid);chosen.date=o.date;chosen.time=o.time;if(o.court)chosen.court=o.court;if(o.opponent&&!/avversario da definire/i.test(o.opponent))chosen.opponent=o.opponent;chosen.status=chosen.result?'completed':'scheduled';chosen.orderOfPlayFile=o.file;chosen.orderOfPlayLine=o.line;chosen.orderOfPlayCheckedAt=now;updated++;withTime++;if(o.court)withCourt++;hits.push({player:o.player.name,time:o.time,court:o.court,double:o.isDouble,line:o.line.slice(0,240)})}}
// Mirror times to reciprocal monitored opponent rows, and if a monitored player has one untimed Brallo-today row, copy their official time.
for(const m of data.matches||[]){if(m.competitionId===BRALLO&&m.date===today&&m.time){for(const other of data.matches||[]){if(other===m||other.competitionId!==BRALLO||other.date!==today||other.time)continue;if(norm(m.opponent||'')&&norm(other.playerName||'')&&norm(m.opponent).includes(norm(other.playerName))){other.time=m.time;other.court=other.court||m.court;other.orderOfPlayFile=m.orderOfPlayFile;other.orderOfPlayLine=m.orderOfPlayLine;other.orderOfPlayCheckedAt=now;}}}}
for(const p of players){const occ=(byPlayer.get(p.id)||[]).sort((a,b)=>a.time.localeCompare(b.time));if(!occ.length)continue;const untimed=(data.matches||[]).filter(m=>m.playerId===p.id&&m.competitionId===BRALLO&&m.date===today&&!m.time);if(untimed.length===1){untimed[0].time=occ[0].time;untimed[0].orderOfPlayFile=occ[0].file;untimed[0].orderOfPlayLine=occ[0].line;untimed[0].orderOfPlayCheckedAt=now;}}
data.generatedAt=now;const bralloToday=(data.matches||[]).filter(m=>m.competitionId===BRALLO&&m.date===today);data.fitpOrderOfPlaySync={lastRun:now,status:errors.length?'partial':'complete',competitionId:BRALLO,date:today,files,processed:toProcess,downloaded,parsed,updated,withTime,withCourt,occurrences:occurrences.length,bralloToday:bralloToday.length,bralloTodayWithTime:bralloToday.filter(m=>m.time).length,hits:hits.slice(0,60),errors:errors.slice(0,30)};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('fitp-order-of-play.json',JSON.stringify(data.fitpOrderOfPlaySync,null,2)+'\n');
console.log(JSON.stringify(data.fitpOrderOfPlaySync,null,2));
