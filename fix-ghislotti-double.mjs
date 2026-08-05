import fs from 'node:fs/promises';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const DATE='2026-08-05';
const now=new Date().toISOString();
const data=JSON.parse(await fs.readFile('data.json','utf8'));
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
let removed=0;
data.matches=(data.matches||[]).filter(m=>{
  const isBad=m.competitionId===BRALLO&&m.date===DATE&&m.playerId==='carlo-ghislotti'&&norm(m.partner).includes('CASTELLANA')&&norm(m.partner).includes('GHISLOTTI')&&norm(m.opponent).includes('FERIOLI')&&norm(m.opponent).includes('BOSCO');
  if(isBad) removed++;
  return !isBad;
});
data.generatedAt=now;
const today=(data.matches||[]).filter(m=>m.competitionId===BRALLO&&m.date===DATE).map(m=>({playerId:m.playerId,playerName:m.playerName,time:m.time,opponent:m.opponent,partner:m.partner,status:m.status,source:m.todayAgendaSource})).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.playerName).localeCompare(String(b.playerName)));
data.fixGhislottiDouble={lastRun:now,status:'complete',removedDuplicateGhislotti:removed,bralloToday:today.length,bralloTodayWithTime:today.filter(x=>x.time).length,todayRows:today};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('fix-ghislotti-double.json',JSON.stringify(data.fixGhislottiDouble,null,2)+'\n');
console.log(JSON.stringify(data.fixGhislottiDouble,null,2));
