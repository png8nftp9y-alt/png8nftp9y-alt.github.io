import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const inbox = path.resolve(arg('--inbox', 'puc-inbox'));
const dataFile = path.resolve(arg('--data', 'data.json'));
const playersFile = path.resolve(arg('--players', 'players.json'));
const alertsFile = path.resolve(arg('--alerts', 'alerts.json'));
const now = new Date().toISOString();
const months = { gennaio:'01', febbraio:'02', marzo:'03', aprile:'04', maggio:'05', giugno:'06', luglio:'07', agosto:'08', settembre:'09', ottobre:'10', novembre:'11', dicembre:'12' };
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slug = value => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function listPdfs(dir) { const out=[]; try { for (const entry of await fs.readdir(dir,{withFileTypes:true})) { const full=path.join(dir,entry.name); if(entry.isDirectory()) out.push(...await listPdfs(full)); else if(/\.pdf$/i.test(entry.name)) out.push(full); } } catch {} return out.sort(); }
async function extractText(pdf) { const out=path.join(os.tmpdir(),`courtwatch-${crypto.randomUUID()}.txt`); await exec('pdftotext',['-layout',pdf,out]); return fs.readFile(out,'utf8'); }
function documentDate(text) { const m=text.match(/(?:Data:\s*)?(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)?\s*(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})/i); return m?`${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`:null; }
function issuedAt(text) { const m=text.match(/Ordine di gioco rilasciato\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\s+h\s+(\d{1,2})[:.]([0-5]\d)/i); return m?`${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00+02:00`:null; }
function tournamentName(text) { const raw=text.match(/^\s*(TORNEO[^\n\r]+)/im)?.[1]||'Torneo FITP'; return clean(raw.replace(/\s+Giudice Arbitro.*$/i,'')); }
function referee(text) { const lines=text.split(/\r?\n/),i=lines.findIndex(line=>/Giudice Arbitro/i.test(line)); for(let n=i+1;n>=0&&n<Math.min(lines.length,i+5);n++){const v=clean(lines[n]);if(v&&!/Giudice Arbitro/i.test(v))return v;} return null; }
function titleNames(value) { return clean(value).toLowerCase().replace(/(^|[\s,.'-])([a-zà-ÿ])/g,(_,a,b)=>a+b.toUpperCase()); }
function opponentFor(text,player) { const surname=normalize(player.name).split(' ').at(-1); const normalizedText=text.normalize('NFD').replace(/[\u0300-\u036f]/g,''); const m=normalizedText.match(new RegExp(`${escapeRe(surname)}\\s+incontra\\s+([^;\\n.]+)`,'i')); if(!m)return null; const raw=clean(m[1]),q=raw.match(/^Q(\d+)\s+vincente\s+tra\s+(.+)$/i); return q?`Q${q[1]} — vincente tra ${titleNames(q[2])}`:titleNames(raw); }
function parsePlayers(text,players) {
  const lines=text.split(/\r?\n/),infoIndex=lines.findIndex(line=>/INFORMAZIONI SUI QUALIFICATI/i.test(line)),scheduleEnd=infoIndex>=0?infoIndex:lines.length;
  const header=lines.slice(0,scheduleEnd).map((line,i)=>({line,i,courts:[...line.matchAll(/CAMPO\s+(\d+)/gi)]})).filter(x=>x.courts.length>=2).sort((a,b)=>b.courts.length-a.courts.length)[0];
  if(!header)throw new Error('Intestazione dei campi non trovata');
  const courts=header.courts.map(m=>({court:m[1],x:m.index+m[0].length/2})),results=[];
  for(const player of players){
    const variants=new Set([player.name,...(player.aliases||[]),player.name.split(/\s+/).reverse().join(' ')].map(normalize)); let hit=null;
    for(let i=header.i+1;i<scheduleEnd;i++){const nline=String(lines[i]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();for(const alias of variants){const x=nline.indexOf(alias);if(x>=0&&(!hit||x>hit.x))hit={i,x,alias};}}
    if(!hit)continue; const candidates=[];
    for(let i=Math.max(header.i+1,hit.i-12);i<=Math.min(scheduleEnd-1,hit.i+12);i++){const m=lines[i].match(/^\s{0,24}([01]?\d|2[0-3])[:.]([0-5]\d)\b/);if(m)candidates.push({i,time:`${m[1].padStart(2,'0')}:${m[2]}`,distance:Math.abs(i-hit.i)+(i<hit.i?.35:0)});}
    candidates.sort((a,b)=>a.distance-b.distance); if(!candidates[0])continue;
    const center=hit.x+hit.alias.length/2,court=[...courts].sort((a,b)=>Math.abs(a.x-center)-Math.abs(b.x-center))[0]?.court||null;
    results.push({player,time:candidates[0].time,court,opponent:opponentFor(text,player)});
  }
  return results;
}
function similarity(a,b){const aa=new Set(normalize(a).split(/\s+/).filter(w=>w.length>3)),bb=new Set(normalize(b).split(/\s+/).filter(w=>w.length>3));return[...aa].filter(w=>bb.has(w)).length;}
function chooseTournament(data,playerId,date,docName){return(data.tournaments||[]).filter(t=>t.playerId===playerId&&(!t.startDate||t.startDate<=date)&&(!t.endDate||t.endDate>=date)).sort((a,b)=>similarity(b.name,docName)-similarity(a.name,docName))[0]||null;}
const snapshot=match=>[match.date,match.time,match.court,match.opponent].join('|');
const data=await readJson(dataFile,{players:[],tournaments:[],matches:[],officialDocuments:[]}),playerConfig=await readJson(playersFile,{players:data.players||[]}),pdfs=await listPdfs(inbox),previous=new Map((data.matches||[]).map(m=>[m.key,snapshot(m)])),changed=[],reports=[];
for(const pdf of pdfs){
  const bytes=await fs.readFile(pdf),hash=crypto.createHash('sha256').update(bytes).digest('hex'); let text;
  try{text=await extractText(pdf);}catch(error){reports.push({file:path.basename(pdf),status:'error',error:error.message});continue;}
  if(!/(?:orario|ordine) di gioco/i.test(text)||!/CAMPO\s+\d+/i.test(text)){reports.push({file:path.basename(pdf),status:'ignored',reason:'Non è un ordine di gioco P.U.C.'});continue;}
  const date=documentDate(text);if(!date){reports.push({file:path.basename(pdf),status:'error',error:'Data non trovata'});continue;}
  const docName=tournamentName(text),parsed=parsePlayers(text,playerConfig.players||[]);
  for(const item of parsed){
    let tournament=chooseTournament(data,item.player.id,date,docName);
    if(!tournament){tournament={key:`${slug(docName)}|${item.player.id}`,playerId:item.player.id,playerName:item.player.name,name:docName,location:'Luogo indicato dal P.U.C.',sourceId:'fitp-puc',sourceName:'P.U.C. FITP',url:path.basename(pdf),startDate:date,endDate:date,status:'active'};(data.tournaments||=[]).push(tournament);}
    let match=(data.matches||[]).find(m=>m.playerId===item.player.id&&m.date===date&&(m.tournamentName===tournament.name||m.sourceId==='fitp-puc'));
    if(!match){match={key:`${tournament.key.split('|')[0]}|${date}|${item.player.id}`,playerId:item.player.id,playerName:item.player.name,tournamentName:tournament.name,location:tournament.location,date,time:null,court:null,opponent:null,url:path.basename(pdf),sourceId:'fitp-puc',sourceName:'P.U.C. FITP',status:'scheduled'};(data.matches||=[]).push(match);}
    match.time=item.time;match.court=item.court||match.court;match.opponent=item.opponent||match.opponent;match.url=path.basename(pdf);match.sourceId='fitp-puc';match.sourceName='P.U.C. FITP';match.verifiedAt=now;if(previous.get(match.key)!==snapshot(match))changed.push(match);
  }
  const document={name:path.basename(pdf),sha256:hash,competition:docName,date,issuedAt:issuedAt(text),referee:referee(text),parsedAt:now},index=(data.officialDocuments||=[]).findIndex(d=>d.sha256===hash||(d.name===document.name&&d.date===document.date));
  if(index>=0)data.officialDocuments[index]={...data.officialDocuments[index],...document};else data.officialDocuments.push(document);
  reports.push({file:path.basename(pdf),status:'imported',date,competition:docName,players:parsed.map(x=>({name:x.player.name,time:x.time,court:x.court,opponent:x.opponent}))});
}
data.generatedAt=now;data.pucImporter={lastRun:now,inbox:path.relative(process.cwd(),inbox)||'.',files:reports};
const notifications=[...new Map(changed.map(m=>[m.key,m])).values()].map(m=>({type:'match',playerName:m.playerName,message:`${m.tournamentName}: ${m.date} alle ${m.time}${m.court?` · campo ${m.court}`:''}${m.opponent?` · ${m.opponent}`:''}`,url:m.url}));
await fs.writeFile(dataFile,JSON.stringify(data,null,2)+'\n');await fs.writeFile(alertsFile,JSON.stringify({generatedAt:now,notifications},null,2)+'\n');console.log(JSON.stringify({importedFiles:reports.filter(r=>r.status==='imported').length,changedMatches:notifications.length,reports},null,2));
