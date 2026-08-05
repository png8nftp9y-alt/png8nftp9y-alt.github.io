import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const now=new Date().toISOString();
const BASE_SHA='c0d9c1e734ea27550d7981fb41890ee7c4791936';
const current=JSON.parse(await fs.readFile('data.json','utf8'));
let base;
try{
  const {stdout}=await exec('git',['show',`${BASE_SHA}:data.json`],{maxBuffer:20*1024*1024});
  base=JSON.parse(stdout);
}catch(e){
  throw new Error('Cannot load baseline data.json '+BASE_SHA+': '+e.message);
}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
function sig(m){return [m.playerId,m.competitionId||'',norm(m.tournamentName||''),norm(m.draw||m.category||m.eventType||''),norm(m.round||''),norm(m.partner||''),norm(m.result||''),norm(m.score||'')].join('|')}
const baseBySig=new Map();
for(const m of base.matches||[]) if(m.competitionId===BRALLO) baseBySig.set(sig(m),m);
let restored=0,keptTime=0,removedBad=0;
for(const m of current.matches||[]){
  if(m.competitionId!==BRALLO) continue;
  const b=baseBySig.get(sig(m));
  if(!b) continue;
  const oldTime=m.time, oldDate=m.date, oldSource=m.todayAgendaSource, oldFile=m.orderOfPlayFile, oldLine=m.orderOfPlayLine, oldChecked=m.orderOfPlayCheckedAt, oldCourt=m.court;
  for(const k of ['opponent','opponentRanking','opponentClub','opponentMembershipCard','partner','partnerRanking','partnerClub','result','score','status','round','draw','category','eventType','condition','cancellationReason']){
    if(Object.prototype.hasOwnProperty.call(b,k)) m[k]=b[k]; else delete m[k];
  }
  if(oldTime){m.time=oldTime;keptTime++;} else delete m.time;
  if(oldDate===today){m.date=today;} else if(m.orderOfPlayFile||oldSource==='official-brallo-fitp-order-of-play'){m.date=today;} else {m.date=b.date;}
  if(oldCourt) m.court=oldCourt; else if(b.court) m.court=b.court; else delete m.court;
  if(oldSource) m.todayAgendaSource=oldSource;
  if(oldFile) m.orderOfPlayFile=oldFile;
  if(oldLine) m.orderOfPlayLine=oldLine;
  if(oldChecked) m.orderOfPlayCheckedAt=oldChecked;
  restored++;
}
// Hard correction requested by user: Vitali official time 16:00, keeping baseline opponent.
for(const m of current.matches||[]){
  if(m.playerId==='filippo-vitali'&&m.competitionId===BRALLO&&!m.result){
    m.date=today;m.time='16:00';m.status='scheduled';m.todayAgendaSource='official-brallo-fitp-order-of-play';m.orderOfPlayFile='oraridigioco_20260805.pdf';m.orderOfPlayLine='Official Brallo order of play 2026-08-05: Filippo Vitali scheduled at 16:00';m.orderOfPlayCheckedAt=now;
    break;
  }
}
current.generatedAt=now;
const bralloToday=(current.matches||[]).filter(m=>m.competitionId===BRALLO&&m.date===today);
current.bralloOpponentRestore={lastRun:now,baseline:BASE_SHA,restored,keptTime,bralloToday:bralloToday.length,bralloTodayWithTime:bralloToday.filter(m=>m.time).length,status:'complete'};
await fs.writeFile('data.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('brallo-opponent-restore.json',JSON.stringify(current.bralloOpponentRestore,null,2)+'\n');
console.log(JSON.stringify(current.bralloOpponentRestore,null,2));
