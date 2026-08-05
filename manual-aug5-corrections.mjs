import fs from 'node:fs/promises';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const DATE='2026-08-05';
const now=new Date().toISOString();
const data=JSON.parse(await fs.readFile('data.json','utf8'));
function isBrallo(m){return m.competitionId===BRALLO || String(m.tournamentName||'').toUpperCase().includes('BRALLO')}
function isDouble(m){return /doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''} ${m.round||''}`)||!!m.partner}
function setOfficial(m,time,line){m.date=DATE;m.time=time;m.status='scheduled';m.result='';m.todayAgendaSource='manual-user-confirmed-aug5';m.orderOfPlayFile='oraridigioco_20260805.pdf';m.orderOfPlayLine=line;m.orderOfPlayCheckedAt=now;}
function removeToday(m,reason){if(m.date===DATE) delete m.date; delete m.time; delete m.todayAgendaSource; delete m.orderOfPlayFile; delete m.orderOfPlayLine; m.orderOfPlayCheckedAt=now; m.status=m.result?'completed':'not_today'; m.cancellationReason=reason;}
let puccioRemoved=0, ghislotti=0, cereghini=0, zennaro=0, vitali=0, gelli=0, paganini=0;
for(const m of data.matches||[]){
  if(!isBrallo(m)) continue;
  const dbl=isDouble(m);
  if(m.playerId==='gregorio-puccio'){removeToday(m,'Non gioca il 05/08: ha perso.');puccioRemoved++;continue;}
  if(m.playerId==='carlo-ghislotti' && !dbl){setOfficial(m,'08:00','Conferma manuale 05/08: Ghislotti singolare ore 08:00');ghislotti++;}
  if(m.playerId==='virginia-cereghini' && !dbl){setOfficial(m,'13:00','Conferma manuale 05/08: Cereghini singolare ore 13:00');cereghini++;}
  if(m.playerId==='aila-zennaro' && !dbl){setOfficial(m,'13:00','Conferma manuale 05/08: Zennaro singolare ore 13:00');zennaro++;}
  if(m.playerId==='filippo-vitali'){setOfficial(m,'16:00','Conferma manuale 05/08: Vitali ore 16:00');vitali++;}
  if(m.playerId==='daniele-gelli'){setOfficial(m,m.time||'12:30','Conferma manuale 05/08: Gelli vs Greco');m.opponent='Greco Giovanni';gelli++;}
  if(m.playerId==='noemi-paganini'){setOfficial(m,m.time||'11:30','Conferma manuale 05/08: Paganini vs Panizzi');m.opponent='Panizzi Greta';paganini++;}
}
data.generatedAt=now;
const todayRows=(data.matches||[]).filter(m=>isBrallo(m)&&m.date===DATE);
data.manualAug5Corrections={lastRun:now,status:'complete',puccioRemoved,ghislotti,cereghini,zennaro,vitali,gelli,paganini,bralloToday:todayRows.length,bralloTodayWithTime:todayRows.filter(m=>m.time).length};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('manual-aug5-corrections.json',JSON.stringify(data.manualAug5Corrections,null,2)+'\n');
console.log(JSON.stringify(data.manualAug5Corrections,null,2));
