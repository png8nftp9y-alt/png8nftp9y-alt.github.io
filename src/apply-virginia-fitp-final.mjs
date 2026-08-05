import fs from 'node:fs/promises';
const PLAYER_ID='virginia-cereghini';
const final=JSON.parse(await fs.readFile('virginia-fitp-final.json','utf8'));
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const now=new Date().toISOString();
data.tournaments=(data.tournaments||[]).filter(t=>!(t.playerId===PLAYER_ID&&t.sourceId==='fitp-puc'));
for(const t of final.tournaments){
  data.tournaments.push({
    key:`fitp-${(t.competitionId||t.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}|${PLAYER_ID}`,
    playerId:PLAYER_ID,
    playerName:'Virginia Cereghini',
    name:t.name,
    location:t.location||'',
    sourceId:'fitp-puc',
    sourceName:'P.U.C. FITP',
    url:t.competitionId?'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(t.competitionId):(t.sourceEvidence||[]).join(' | '),
    startDate:t.startDate,
    endDate:t.endDate,
    status:t.endDate&&t.endDate<now.slice(0,10)?'finished':t.startDate&&t.startDate>now.slice(0,10)?'upcoming':'active',
    competitionId:t.competitionId||'',
    draws:t.draws||[],
    membershipCard:'3987201066',
    lastSeen:now,
    searchScope:'virginia-fitp-final-8',
    validationStatus:t.status,
    sourceEvidence:t.sourceEvidence||[]
  });
}
data.generatedAt=now;
data.virginiaFitpFinalApplied={lastRun:now,status:final.status,finalCount:final.finalCount,expectedCountUsed:false};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data.virginiaFitpFinalApplied,null,2));
