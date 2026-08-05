import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const BASE_SHA='c0d9c1e734ea27550d7981fb41890ee7c4791936';
const DATE='2026-08-05';
const now=new Date().toISOString();
const current=JSON.parse(await fs.readFile('data.json','utf8'));
const {stdout}=await exec('git',['show',`${BASE_SHA}:data.json`],{maxBuffer:50*1024*1024});
const base=JSON.parse(stdout);
function isNextGenBrallo(m){return m.competitionId===BRALLO && /JUNIOR NEXT GEN/i.test(String(m.tournamentName||''));}
function isBrallo(m){return m.competitionId===BRALLO || /BRALLO/i.test(String(m.tournamentName||''));}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function isDouble(m){const txt=norm(`${m.eventType||''} ${m.draw||''} ${m.category||''} ${m.round||''}`); const p=norm(m.partner), name=norm(m.playerName); return txt.includes('DOPPIO') || (!!p && p!==name && p.includes('/'));}
function clearToday(m,reason){if(m.date===DATE) delete m.date; delete m.time; delete m.todayAgendaSource; delete m.orderOfPlayFile; delete m.orderOfPlayLine; m.orderOfPlayCheckedAt=now; if(reason) m.cancellationReason=reason; if(m.result) m.status='completed';}
function setToday(m,time,line){m.date=DATE;m.time=time;m.status='scheduled';m.todayAgendaSource='manual-user-confirmed-aug5-precise';m.orderOfPlayFile='oraridigioco_20260805.pdf';m.orderOfPlayLine=line;m.orderOfPlayCheckedAt=now; delete m.cancellationReason;}
const rebuilt=[];let removed=0, restored=0;
for(const m of current.matches||[]){if(isBrallo(m)) removed++; else rebuilt.push(m);}
for(const b of base.matches||[]){if(isBrallo(b)){const m={...b}; if(m.todayAgendaSource==='active-brallo-fitp'){delete m.todayAgendaSource; if(m.date===DATE) delete m.date;} rebuilt.push(m); restored++;}}
current.matches=rebuilt;
const counters={puccioRemoved:0,ghislotti:0,cereghini:0,zennaro:0,vitali:0,gelli:0,paganini:0};
for(const m of current.matches||[]){
  if(!isNextGenBrallo(m)) continue;
  if(m.playerId==='gregorio-puccio'){clearToday(m,'Non gioca il 05/08: ha perso.');counters.puccioRemoved++;continue;}
  const dbl=isDouble(m);
  const opp=norm(m.opponent);
  if(m.playerId==='carlo-ghislotti' && !dbl && !m.result){setToday(m,'08:00','05/08 ufficiale: Ghislotti singolare ore 08:00');counters.ghislotti++;}
  if(m.playerId==='virginia-cereghini' && !dbl && !m.result){setToday(m,'13:00','05/08 ufficiale: Cereghini singolare ore 13:00');counters.cereghini++;}
  if(m.playerId==='aila-zennaro' && !dbl && !m.result){setToday(m,'13:00','05/08 ufficiale: Zennaro singolare ore 13:00');counters.zennaro++;}
  if(m.playerId==='filippo-vitali' && !m.result){setToday(m,'16:00','05/08 ufficiale: Vitali ore 16:00');counters.vitali++;}
  if(m.playerId==='daniele-gelli' && !dbl && !m.result && (!m.opponent || opp.includes('GRECO'))){m.opponent='Greco Giovanni';setToday(m,'12:30','05/08 ufficiale: Gelli vs Greco');counters.gelli++;}
  if(m.playerId==='noemi-paganini' && !dbl && !m.result && (!m.opponent || opp.includes('PANIZZI'))){m.opponent='Panizzi Greta';setToday(m,'11:30','05/08 ufficiale: Paganini vs Panizzi');counters.paganini++;}
}
const today=(current.matches||[]).filter(m=>isNextGenBrallo(m)&&m.date===DATE).map(m=>({playerId:m.playerId,playerName:m.playerName,time:m.time,opponent:m.opponent,partner:m.partner,result:m.result,status:m.status,isDouble:isDouble(m),source:m.todayAgendaSource})).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.playerName).localeCompare(String(b.playerName)));
current.generatedAt=now;
current.preciseAug5Reset={lastRun:now,status:'complete',removedBralloRows:removed,restoredBralloRows:restored,...counters,bralloToday:today.length,bralloTodayWithTime:today.filter(x=>x.time).length,todayRows:today};
await fs.writeFile('data.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('precise-aug5-reset.json',JSON.stringify(current.preciseAug5Reset,null,2)+'\n');
console.log(JSON.stringify(current.preciseAug5Reset,null,2));
