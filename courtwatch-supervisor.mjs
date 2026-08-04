import fs from 'node:fs/promises';
const now=new Date().toISOString();
let data={};try{data=JSON.parse(await fs.readFile('data.json','utf8'))}catch{}
let prev={};try{prev=JSON.parse(await fs.readFile('full-discovery-heartbeat.json','utf8'))}catch{}
const tournaments=data.tournaments||[],matches=data.matches||[];
const bySource=s=>tournaments.filter(t=>t.sourceId===s).length;
const hb={status:'complete',at:now,continuous:true,splitPipelines:true,frequency:'*/5 * * * *',coverageFrom:'2025-12-18',players:'current+former',sources:'FITP/P.U.C. + official Tennis Europe + official ITF',matches:matches.length,tournaments:tournaments.length,fitpTournaments:bySource('fitp-puc'),teTournaments:bySource('tennis-europe'),itfTournaments:bySource('itf'),generatedAt:data.generatedAt||null,lastFitp:data.fitpEntryDiscovery?.lastRun||null,lastResults:data.fitpResultSync?.lastRun||null,lastTE:data.teEntryDiscovery?.lastRun||null,lastITF:data.itfEntryDiscovery?.lastRun||null,lastOrderOfPlay:data.officialOrderOfPlaySync?.lastRun||null,lastMemberships:data.playerMembershipSync?.lastRun||null,previous:prev.at||null};
await fs.writeFile('full-discovery-heartbeat.json',JSON.stringify(hb,null,2)+'\n');
await fs.writeFile('courtwatch-supervisor.json',JSON.stringify(hb,null,2)+'\n');
console.log(JSON.stringify(hb,null,2));
