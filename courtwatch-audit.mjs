import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const current=JSON.parse(await fs.readFile('players.json','utf8'));
let former={players:[]};try{former=JSON.parse(await fs.readFile('former-players.json','utf8'))}catch{}
const from='2025-12-18';
const tournaments=data.tournaments||[],matches=data.matches||[];
const countBy=arr=>arr.reduce((a,x)=>{const k=x.sourceId||'unknown';a[k]=(a[k]||0)+1;return a},{});
const keys=new Set(),dups=[];for(const t of tournaments){const k=[t.sourceId,t.playerId,t.name,t.startDate,t.endDate,t.url].join('|');if(keys.has(k))dups.push(k);keys.add(k)}
const formerIds=former.players.map(p=>p.id);const currentIds=current.players.map(p=>p.id);
const audit={generatedAt:new Date().toISOString(),currentPlayers:current.players.length,formerPlayers:former.players.length,duplicateFormerPlayers:formerIds.length-new Set(formerIds).size,currentFormerOverlap:currentIds.filter(id=>formerIds.includes(id)),tournaments:tournaments.length,tournamentsBySource:countBy(tournaments),matches:matches.length,matchesSinceCoverage:matches.filter(m=>!m.date||m.date>=from).length,matchesWithTime:matches.filter(m=>m.time).length,matchesWithOpponentClub:matches.filter(m=>m.opponentClub).length,losses:matches.filter(m=>m.advances===false).length,bralloMatches:matches.filter(m=>m.competitionId==='8E872D3D-3E4E-4014-9606-ACADE6000B3F').length,bralloTimedMatches:matches.filter(m=>m.competitionId==='8E872D3D-3E4E-4014-9606-ACADE6000B3F'&&m.time).length,te:data.teEntryDiscovery||null,fitp:data.fitpResultSync||data.bralloAgendaSync||null,duplicateTournamentRows:dups.length};
await fs.writeFile('courtwatch-data-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
