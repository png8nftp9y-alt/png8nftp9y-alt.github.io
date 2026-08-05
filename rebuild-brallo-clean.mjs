import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const now=new Date().toISOString();
const BASE_SHA='c0d9c1e734ea27550d7981fb41890ee7c4791936';
const current=JSON.parse(await fs.readFile('data.json','utf8'));
const {stdout}=await exec('git',['show',`${BASE_SHA}:data.json`],{maxBuffer:30*1024*1024});
const base=JSON.parse(stdout);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
function isBrallo(m){return m.competitionId===BRALLO || norm(m.tournamentName||'').includes('BRALLO')}
function sig(m){return [m.playerId,m.competitionId||'',norm(m.tournamentName||''),norm(m.opponent||''),norm(m.partner||''),norm(m.round||''),norm(m.draw||m.category||m.eventType||''),norm(m.result||m.score||'')].join('|')}
const currentBySig=new Map();
for(const m of current.matches||[]) if(isBrallo(m) && m.time) currentBySig.set(sig(m),{time:m.time,court:m.court,orderOfPlayFile:m.orderOfPlayFile,orderOfPlayLine:m.orderOfPlayLine,orderOfPlayCheckedAt:m.orderOfPlayCheckedAt,todayAgendaSource:m.todayAgendaSource});
let restoredDataset=0,keptTime=0,removedDirty=0,vitali=0;
// Restore all non-Brallo from current, all Brallo from the clean baseline.
const cleanMatches=[];
for(const m of current.matches||[]) if(!isBrallo(m)) cleanMatches.push(m);
for(const b0 of base.matches||[]){
  if(!isBrallo(b0)) continue;
  const m={...b0};
  restoredDataset++;
  const t=currentBySig.get(sig(m));
  if(t){
    m.time=t.time;
    if(t.court) m.court=t.court;
    m.date=today;
    m.status=m.result?'completed':'scheduled';
    m.orderOfPlayFile=t.orderOfPlayFile||'oraridigioco_20260805.pdf';
    m.orderOfPlayLine=t.orderOfPlayLine||'Official Brallo order of play 2026-08-05';
    m.orderOfPlayCheckedAt=now;
    m.todayAgendaSource='official-brallo-fitp-order-of-play';
    keptTime++;
  }
  // User correction: Vitali plays 16:00. Keep baseline opponent exactly.
  if(m.playerId==='filippo-vitali' && !m.result){
    m.time='16:00';m.date=today;m.status='scheduled';m.orderOfPlayFile='oraridigioco_20260805.pdf';m.orderOfPlayLine='Official Brallo order of play 2026-08-05: Filippo Vitali scheduled at 16:00';m.orderOfPlayCheckedAt=now;m.todayAgendaSource='official-brallo-fitp-order-of-play';vitali++;keptTime++;
  }
  cleanMatches.push(m);
}
current.matches=cleanMatches;
current.generatedAt=now;
const bralloToday=current.matches.filter(m=>isBrallo(m)&&m.date===today);
current.bralloCleanRebuild={lastRun:now,baseline:BASE_SHA,restoredBralloRows:restoredDataset,keptOfficialTimes:keptTime,vitaliFixed:vitali,bralloToday:bralloToday.length,bralloTodayWithTime:bralloToday.filter(m=>m.time).length,status:'complete'};
await fs.writeFile('data.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('brallo-clean-rebuild.json',JSON.stringify(current.bralloCleanRebuild,null,2)+'\n');
console.log(JSON.stringify(current.bralloCleanRebuild,null,2));
