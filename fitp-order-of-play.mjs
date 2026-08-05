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
const aliases=[];for(const p of players)for(const a of [p.name,...(p.aliases||[])]){const n=norm(a);if(n.split(' ').length>1)aliases.push({n,p})}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json; charset=utf-8','user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/2.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`${r.status} ${text.slice(0,120)}`);return text?JSON.parse(text):null}
async function download(file){const url=BASE+'/api/v2/puc/competizione/ordine-di-gioco/download?competitionId='+encodeURIComponent(BRALLO)+(file?'&fileName='+encodeURIComponent(file):'');const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatchOrderOfPlay/2.0','referer':'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+BRALLO}});const buf=Buffer.from(await r.arrayBuffer());if(!r.ok||buf.length<1000)throw Error(`download ${file||'oop.pdf'} ${r.status} ${buf.length}`);const safe=(file||'oop.pdf').replace(/[^A-Za-z0-9_.-]/g,'_');const path='/tmp/'+safe;await fs.writeFile(path,buf);return path}
function parseDateFromFile(file){const m=String(file||'').match(/(20\d{2})(\d{2})(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:today}
function findTime(s){const m=String(s).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:null}
function findCourt(s){const m=String(s).match(/\b(?:campo|court|c\.?po)\s*([A-Za-z0-9]+)\b/i)||String(s).match(/\bC\s*([0-9]{1,2})\b/i);return m?String(m[1]).toUpperCase():null}
function opponentFromLine(line,playerName){let t=line.replace(/\s+/g,' ').trim();const pn=norm(playerName);const parts=t.split(/\s+(?:vs\.?|v\.?|contro|c\/|-)\s+/i);if(parts.length>1){const side=parts.map(x=>x.trim());const idx=side.findIndex(x=>norm(x).includes(pn)||pn.includes(norm(x)));const opp=side[idx===0?1:0]||side[1];return opp.replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,'').replace(/\b(?:campo|court|c\.?po)\s*[A-Za-z0-9]+\b/ig,'').trim()}
return null}
function updateMatch(p,line,date,file){const time=findTime(line),court=findCourt(line),opp=opponentFromLine(line,p.name);let candidates=(data.matches||[]).filter(m=>m.playerId===p.id&&m.competitionId===BRALLO&&(!m.result||m.date===date||m.date===today));if(!candidates.length)candidates=(data.matches||[]).filter(m=>m.playerId===p.id&&m.competitionId===BRALLO);if(!candidates.length)return false;let chosen=candidates.find(m=>opp&&norm(m.opponent||'').split(' ').some(x=>x&&norm(opp).includes(x)))||candidates.find(m=>m.date===date)||candidates[0];chosen.date=date; if(time)chosen.time=time; if(court)chosen.court=court; if(opp&&!/avversario da definire/i.test(opp))chosen.opponent=opp; chosen.status=chosen.result?'completed':'scheduled'; chosen.orderOfPlayFile=file; chosen.orderOfPlayLine=line; chosen.orderOfPlayCheckedAt=now; return Boolean(time||court)}
let files=[],downloaded=0,parsed=0,updated=0,withTime=0,withCourt=0,errors=[];
try{const list=await post('/api/v3/puc/competizione/ordine-di-gioco/list',{competitionId:BRALLO});files=Array.isArray(list)?list:[];}catch(e){errors.push('list: '+e.message)}
if(!files.length)files=['oop.pdf'];
const selected=files.filter(f=>String(f).includes(ymd));
const toProcess=(selected.length?selected:files).slice(-4);
for(const file of toProcess){try{const pdf=await download(file==='oop.pdf'?null:file);downloaded++;const out='/tmp/oop-'+downloaded+'.txt';await exec('pdftotext',['-layout',pdf,out]);const text=await fs.readFile(out,'utf8');parsed++;const date=parseDateFromFile(file);const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);for(let i=0;i<lines.length;i++){const chunk=lines.slice(Math.max(0,i-1),Math.min(lines.length,i+2)).join(' ');const hay=norm(chunk);for(const {n,p} of aliases){if(hay.includes(n)){if(updateMatch(p,chunk,date,file)){updated++; if(findTime(chunk))withTime++; if(findCourt(chunk))withCourt++;}}}}}catch(e){errors.push(`${file}: ${e.message}`)}}
data.generatedAt=now;data.fitpOrderOfPlaySync={lastRun:now,status:errors.length?'partial':'complete',competitionId:BRALLO,date:today,files,processed:toProcess,downloaded,parsed,updated,withTime,withCourt,errors:errors.slice(0,30)};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('fitp-order-of-play.json',JSON.stringify(data.fitpOrderOfPlaySync,null,2)+'\n');
console.log(JSON.stringify(data.fitpOrderOfPlaySync,null,2));
