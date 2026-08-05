import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const DATE='2026-08-05';
const BASE_SHA='c0d9c1e734ea27550d7981fb41890ee7c4791936';
const now=new Date().toISOString();
const current=JSON.parse(await fs.readFile('data.json','utf8'));
const {stdout}=await exec('git',['show',`${BASE_SHA}:data.json`],{maxBuffer:40*1024*1024});
const base=JSON.parse(stdout);
function isBrallo(m){return m.competitionId===BRALLO || String(m.tournamentName||'').toUpperCase().includes('BRALLO')}
function isDone(m){return !!m.result || m.status==='completed' || m.status==='cancelled'}
function isDouble(m){return /doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''} ${m.round||''}`)||!!m.partner}
function sig(m){return [m.playerId,m.competitionId||'',m.tournamentName||'',m.opponent||'',m.partner||'',m.round||'',m.draw||m.category||m.eventType||'',m.result||m.score||''].join('|').toUpperCase().replace(/\s+/g,' ')}
// Official times read from oraridigioco_20260805.pdf. Keep opponents/draws from the clean pre-OOP baseline.
const singlesTime={
  'carlo-ghislotti':'08:00',
  'noemi-paganini':'11:30',
  'daniele-gelli':'12:30',
  'niccolo-zanaga':'13:00',
  'aila-zennaro':'13:00',
  'virginia-cereghini':'13:00',
  'gregorio-puccio':'16:00',
  'filippo-vitali':'16:00',
  'virginia-rossoni':'17:30'
};
const doublesTime={
  'carlo-ghislotti':'11:30',
  'niccolo-zanaga':'19:00',
  'aila-zennaro':'19:00',
  'virginia-cereghini':'19:00'
};
// Start from current non-Brallo data, replace Brallo rows with clean baseline rows only.
const matches=[];
for(const m of current.matches||[]) if(!isBrallo(m)) matches.push(m);
let restored=0, todayRows=0, timed=0;
const addedKeys=new Set();
for(const b of base.matches||[]){
  if(!isBrallo(b)) continue;
  const m={...b};
  restored++;
  const d=isDouble(m);
  const t=(d?doublesTime[m.playerId]:singlesTime[m.playerId]) || null;
  // Only put active official 05/08 rows in agenda. Preserve completed historical rows as in baseline.
  if(!isDone(m) && t){
    m.date=DATE;
    m.time=t;
    m.status='scheduled';
    m.todayAgendaSource='rebuilt-official-brallo-20260805';
    m.orderOfPlayFile='oraridigioco_20260805.pdf';
    m.orderOfPlayLine=`Official Brallo order of play 2026-08-05: ${m.playerName||m.playerId} ${t}`;
    m.orderOfPlayCheckedAt=now;
    timed++;
  }
  if(m.date===DATE) todayRows++;
  const key=sig(m); if(!addedKeys.has(key)){matches.push(m);addedKeys.add(key)}
}
current.matches=matches;
current.generatedAt=now;
current.aug5AgendaRebuild={lastRun:now,baseline:BASE_SHA,restoredBralloRows:restored,agendaDate:DATE,todayRows,timedRows:timed,status:'complete',note:'Rebuilt from clean baseline. Opponents preserved from baseline; only official times were added.'};
await fs.writeFile('data.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('aug5-agenda-rebuild.json',JSON.stringify(current.aug5AgendaRebuild,null,2)+'\n');
console.log(JSON.stringify(current.aug5AgendaRebuild,null,2));
