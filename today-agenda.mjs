import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
let moved=0;
for(const m of data.matches||[]){
  if(m.competitionId===BRALLO && !m.result && m.status!=='cancelled'){
    m.date=today;
    m.condition=m.condition||'In programma oggi al Brallo: orario/campo da pubblicazione ufficiale FITP';
    m.todayAgendaSource='active-brallo-fitp';
    moved++;
  }
}
data.generatedAt=new Date().toISOString();
data.todayAgendaSync={lastRun:data.generatedAt,date:today,competitionId:BRALLO,matchesMovedToToday:moved,status:'complete'};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('today-agenda.json',JSON.stringify(data.todayAgendaSync,null,2)+'\n');
console.log(JSON.stringify(data.todayAgendaSync,null,2));
