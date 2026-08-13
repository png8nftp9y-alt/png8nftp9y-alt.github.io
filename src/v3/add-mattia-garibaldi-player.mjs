import fs from 'node:fs/promises';
const path='players.json';
const doc=JSON.parse(await fs.readFile(path,'utf8'));
const players=Array.isArray(doc.players)?doc.players:[];
const id='mattia-garibaldi';
const newPlayer={
  id,
  name:'Mattia Garibaldi',
  aliases:['MATTIA GARIBALDI','GARIBALDI MATTIA','GARIBALDI'],
  club:'Tennis Club Lecco',
  circuits:['FITP'],
  officialUrls:{fitp:['https://www.fitp.it/Tornei/Ricerca-tornei'],tennisEurope:[],itf:[]},
  membershipCard:'1291969465',
  ranking:'4.NC'
};
const existing=players.findIndex(p=>p&&p.id===id);
if(existing>=0){players[existing]={...players[existing],...newPlayer};}
else{
  const insertAfter=players.findIndex(p=>p&&p.id==='matilde-mainetti');
  if(insertAfter>=0)players.splice(insertAfter+1,0,newPlayer); else players.push(newPlayer);
}
doc.players=players;
doc.profileSyncUpdatedAt='2026-08-13T01:05:00.000Z';
await fs.writeFile(path,JSON.stringify(doc,null,2)+'\n');
console.log(JSON.stringify({updated:true,id,players:players.length,existing:existing>=0},null,2));
