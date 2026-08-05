import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const BASE_SHA='c0d9c1e734ea27550d7981fb41890ee7c4791936';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const now=new Date().toISOString();
const current=JSON.parse(await fs.readFile('data.json','utf8'));
const {stdout}=await exec('git',['show',`${BASE_SHA}:data.json`],{maxBuffer:40*1024*1024});
const base=JSON.parse(stdout);
function isBrallo(m){return m.competitionId===BRALLO || String(m.tournamentName||'').toUpperCase().includes('BRALLO')}
const clean=[];
let removedDirty=0, restored=0, vitali=0;
for(const m of current.matches||[]){if(!isBrallo(m)) clean.push(m); else removedDirty++;}
for(const b of base.matches||[]){
  if(!isBrallo(b)) continue;
  const m={...b};
  // Keep only the single user-confirmed correction; do not infer opponents from the PDF.
  if(m.playerId==='filippo-vitali' && !m.result){
    m.date=today;
    m.time='16:00';
    m.status='scheduled';
    m.todayAgendaSource='manual-user-confirmed-brallo';
    m.orderOfPlayFile='oraridigioco_20260805.pdf';
    m.orderOfPlayLine='User-confirmed official Brallo order of play: Filippo Vitali 16:00';
    m.orderOfPlayCheckedAt=now;
    vitali++;
  }
  clean.push(m);
  restored++;
}
current.matches=clean;
current.generatedAt=now;
current.bralloEmergencyRollback={lastRun:now,baseline:BASE_SHA,removedDirtyRows:removedDirty,restoredBaselineRows:restored,vitaliFixed:vitali,status:'complete'};
await fs.writeFile('data.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('brallo-emergency-rollback.json',JSON.stringify(current.bralloEmergencyRollback,null,2)+'\n');
console.log(JSON.stringify(current.bralloEmergencyRollback,null,2));
