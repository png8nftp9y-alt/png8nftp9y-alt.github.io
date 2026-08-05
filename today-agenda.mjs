import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
let kept=0,removed=0;
for(const m of data.matches||[]){
  if(m.competitionId!==BRALLO || m.result || m.status==='cancelled') continue;
  const officialToday = m.orderOfPlayFile && String(m.orderOfPlayFile).includes(today.replaceAll('-',''));
  const explicitToday = m.date===today && m.orderOfPlayCheckedAt && (m.orderOfPlayLine||'').includes('Official Brallo order of play');
  if(officialToday || explicitToday){
    m.date=today;
    m.condition=m.condition||'In programma oggi al Brallo: orario da ordine di gioco ufficiale FITP';
    m.todayAgendaSource='official-brallo-fitp-order-of-play';
    kept++;
  }else if(m.todayAgendaSource==='active-brallo-fitp'){
    delete m.todayAgendaSource;
    if(m.date===today) delete m.date;
    removed++;
  }
}
data.generatedAt=new Date().toISOString();
data.todayAgendaSync={lastRun:data.generatedAt,date:today,competitionId:BRALLO,officialTodayMatches:kept,removedNonOfficialTodayRows:removed,status:'complete'};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('today-agenda.json',JSON.stringify(data.todayAgendaSync,null,2)+'\n');
console.log(JSON.stringify(data.todayAgendaSync,null,2));
