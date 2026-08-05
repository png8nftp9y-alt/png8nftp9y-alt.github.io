import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const ids=['gregorio-puccio','carlo-ghislotti','virginia-cereghini','aila-zennaro','filippo-vitali','daniele-gelli','noemi-paganini'];
function isD(m){return /doppio/i.test(`${m.eventType||''} ${m.draw||''} ${m.category||''} ${m.round||''}`)||!!m.partner}
const out={at:new Date().toISOString(),players:{}};
for(const id of ids){out.players[id]=(data.matches||[]).filter(m=>m.competitionId===BRALLO&&m.playerId===id).map(m=>({date:m.date,time:m.time,playerName:m.playerName,opponent:m.opponent,partner:m.partner,result:m.result,status:m.status,isDouble:isD(m),round:m.round,draw:m.draw,eventType:m.eventType,category:m.category,orderOfPlayFile:m.orderOfPlayFile,source:m.todayAgendaSource}));}
await fs.writeFile('verify-aug5-corrections.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
