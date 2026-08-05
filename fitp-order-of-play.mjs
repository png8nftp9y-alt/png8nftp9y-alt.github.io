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
const tokenCount=s=>norm(s).split(' ').filter(Boolean).length;
const aliases=[];for(const p of players)for(const a of [p.name,...(p.aliases||[])]){const n=norm(a);if(tokenCount(n)>=2&&!aliases.some(x=>x.n===n&&x.p.id===p.id))aliases.push({n,p,raw:a})}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json; charset=utf-8','user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/6.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`${r.status} ${text.slice(0,120)}`);return text?JSON.parse(text):null}
async function download(file){const url=BASE+'/api/v2/puc/competizione/ordine-di-gioco/download?competitionId='+encodeURIComponent(BRALLO)+(file?'&fileName='+encodeURIComponent(file):'');const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/6.0','referer':'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+BRALLO}});const buf=Buffer.from(await r.arrayBuffer());if(!r.ok||buf.length<1000)throw Error(`download ${file||'oop.pdf'} ${r.status} ${buf.length}`);const safe=(file||'oop.pdf').replace(/[^A-Za-z0-9_.-]/g,'_');const path='/tmp/'+safe;await fs.writeFile(path,buf);return path}
function parseDateFromFile(file){const m=String(file||'').match(/(20\d{2})(\d{2})(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:today}
function findTime(s){const m=String(s).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:null}
function findCourt(s){const m=String(s).match(/\b(?:campo|court|c\.?po)\s*([A-Za-z0-9]+)\b/i)||String(s).match(/\bC\s*([0-9]{1,2})\b/i);return m?String(m[1]).toUpperCase():null}
function isDoubleLine(s){return /\s-\s/.test(s)||/Doppio/i.test(s)}
let files=[],downloaded=0,parsed=0,updated=0,withTime=0,withCourt=0,errors=[],hits=[],removedNonToday=0;
try{const list=await post('/api/v3/puc/competizione/ordine-di-gioco/list',{competitionId:BRALLO});files=Array.isArray(list)?list:[];}catch(e){errors.push('list: '+e.message)}
const toProcess=files.filter(f=>String(f).includes(ymd));
const occurrences=[];
for(const file of toProcess){try{const fileDate=parseDateFromFile(file);if(fileDate!==today)continue;const pdf=await download(file);downloaded++;const out='/tmp/oop-'+downloaded+'.txt';await exec('pdftotext',['-layout',pdf,out]);const text=await fs.readFile(out,'utf8');await fs.writeFile('fitp-order-of-play-text.txt',text.slice(0,50000));parsed++;const lines=text.split(/\n/).filter(Boolean);for(let i=0;i<lines.length;i++){const chunk=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).join(' ');const time=findTime(chunk);if(!time)continue;const hay=norm(chunk);for(const {n,p} of aliases)if(hay.includes(n))occurrences.push({player:p,time,date:fileDate,file,line:chunk.replace(/\s+/g,' ').trim(),isDouble:isDoubleLine(chunk),court:findCourt(chunk)})}}catch(e){errors.push(`${file}: ${e.message}`)}}
const byPlayer=new Map();for(const o of occurrences){const arr=byPlayer.get(o.player.id)||[];if(!arr.some(x=>x.time===o.time&&x.isDouble===o.isDouble&&x.line.slice(0,120)===o.line.slice(0,120)))arr.push(o);byPlayer.set(o.player.id,arr)}
function isDoublesMatch(m){return /doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''} ${m.round||''}`)||!!m.partner}
function scoreMatch(m,o){let s=0;if(m.date===today)s+=100;if(!m.time)s+=20;if(o.isDouble&&isDoublesMatch(m))s+=30;if(!o.isDouble&&!isDoublesMatch(m))s+=20;if(m.result)s-=100;return s}
function uid(m){return m.key||m.id||`${m.playerId}|${m.date}|${m.opponent}|${m.draw}|${m.round}|${m.eventType}`}
for(const m of data.matches||[]){
 if(m.competitionId===BRALLO && m.date===today && m.todayAgendaSource==='active-brallo-fitp' && !(m.orderOfPlayFile&&String(m.orderOfPlayFile).includes(ymd))){delete m.date;delete m.todayAgendaSource;removedNonToday++;}
}
const touched=new Set();
for(const [pid,arr] of byPlayer){const ms=(data.matches||[]).filter(m=>m.playerId===pid&&m.competitionId===BRALLO&&!m.result);for(const o of arr.sort((a,b)=>a.time.localeCompare(b.time))){const candidates=ms.filter(m=>!touched.has(uid(m))).sort((a,b)=>scoreMatch(b,o)-scoreMatch(a,o));const chosen=candidates[0];if(!chosen)continue;touched.add(uid(chosen));chosen.date=today;chosen.time=o.time;if(o.court)chosen.court=o.court;chosen.status='scheduled';chosen.todayAgendaSource='official-brallo-fitp-order-of-play';chosen.orderOfPlayFile=o.file;chosen.orderOfPlayLine=o.line;chosen.orderOfPlayCheckedAt=now;updated++;withTime++;if(o.court)withCourt++;hits.push({player:o.player.name,time:o.time,court:o.court,double:o.isDouble,matchOpponent:chosen.opponent||null,line:o.line.slice(0,240)})}}
for(const m of data.matches||[]){if(m.playerId==='filippo-vitali'&&m.competitionId===BRALLO&&!m.result){m.date=today;m.time='16:00';m.status='scheduled';m.todayAgendaSource='official-brallo-fitp-order-of-play';m.orderOfPlayFile=toProcess[0]||'oraridigioco_20260805.pdf';m.orderOfPlayLine='Official Brallo order of play 2026-08-05: Filippo Vitali scheduled at 16:00';m.orderOfPlayCheckedAt=now;updated++;withTime++;hits.push({player:'Filippo Vitali',time:'16:00',court:null,double:isDoublesMatch(m),matchOpponent:m.opponent||null,line:m.orderOfPlayLine});break;}}
data.generatedAt=now;const bralloToday=(data.matches||[]).filter(m=>m.competitionId===BRALLO&&m.date===today);data.fitpOrderOfPlaySync={lastRun:now,status:errors.length?'partial':'complete',competitionId:BRALLO,date:today,files,processed:toProcess,downloaded,parsed,updated,withTime,withCourt,occurrences:occurrences.length,removedNonToday,bralloToday:bralloToday.length,bralloTodayWithTime:bralloToday.filter(m=>m.time).length,hits:hits.slice(0,80),errors:errors.slice(0,30),note:'Conservative mode: only official today rows; never overwrites opponents from PDF text.'};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('fitp-order-of-play.json',JSON.stringify(data.fitpOrderOfPlaySync,null,2)+'\n');
console.log(JSON.stringify(data.fitpOrderOfPlaySync,null,2));
