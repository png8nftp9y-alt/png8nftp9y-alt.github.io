import fs from 'node:fs/promises';
const cfg=JSON.parse(await fs.readFile('players.json','utf8'));
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const now=new Date().toISOString();
const today=now.slice(0,10);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const isOfficialTE=u=>/^https:\/\/(e|te)\.tournamentsoftware\.com\//i.test(String(u||''))||/^https:\/\/www\.tenniseurope\.org\//i.test(String(u||''));
const players=(cfg.players||[]).filter(p=>(p.circuits||[]).some(c=>/tennis europe/i.test(String(c))));
function idFromUrl(u){return (String(u).match(/(?:player-profile\/|id=)([0-9A-F-]{36})/i)||[])[1]?.toUpperCase()||null}
function status(start,end){if(end&&end<today)return 'finished'; if(start&&start>today)return 'upcoming'; return 'active'}
function upsertTournament(t){data.tournaments||=[];const i=data.tournaments.findIndex(x=>x.key===t.key||(x.playerId===t.playerId&&x.sourceId==='tennis-europe'&&x.teTournamentId===t.teTournamentId));if(i>=0)data.tournaments[i]={...data.tournaments[i],...t,lastSeen:now};else data.tournaments.push({...t,lastSeen:now})}
const hits=[];
for(const p of players){
  const urls=[p.profileSync?.tennisEurope?.url,...(p.officialUrls?.tennisEurope||[]),...(p.confirmedOfficialTournaments||[]).map(x=>x.url)].filter(Boolean).filter(isOfficialTE);
  const uniq=[...new Set(urls)];
  for(const url of uniq){
    const id=idFromUrl(url)||norm(p.name).replace(/\s+/g,'-');
    const confirmed=(p.confirmedOfficialTournaments||[]).filter(x=>isOfficialTE(x.url));
    if(confirmed.length){
      for(const c of confirmed){const tid=idFromUrl(c.url)||id;hits.push({playerId:p.id,playerName:p.name,teTournamentId:tid,name:c.name||'Torneo Tennis Europe',startDate:c.startDate||null,endDate:c.endDate||null,url:c.url,entryStatus:c.entryStatus||'Iscrizione verificata',entryPosition:c.entryPosition||null})}
    }else{
      hits.push({playerId:p.id,playerName:p.name,teTournamentId:id,name:'Profilo Tennis Europe verificato',startDate:null,endDate:null,url,entryStatus:'Profilo ufficiale monitorato',entryPosition:null})
    }
  }
}
for(const h of hits){const key=`te-${h.teTournamentId}-${h.playerId}`;upsertTournament({key,playerId:h.playerId,playerName:h.playerName,name:h.name,location:'',sourceId:'tennis-europe',sourceName:'Tennis Europe',url:h.url,startDate:h.startDate,endDate:h.endDate,status:status(h.startDate,h.endDate),entryStatus:h.entryStatus,entryPosition:h.entryPosition,teTournamentId:h.teTournamentId});data.entryStatuses=(data.entryStatuses||[]).filter(x=>!(x.playerId===h.playerId&&x.tournamentKey===key));data.entryStatuses.push({playerId:h.playerId,playerName:h.playerName,tournamentKey:key,tournamentName:h.name,sourceId:'tennis-europe',status:h.entryStatus,position:h.entryPosition,url:h.url,observedAt:now})}
data.generatedAt=now;data.teEntryDiscovery={lastRun:now,status:'complete',source:'official Tennis Europe only: player profiles and confirmed official TE tournament URLs',coverageFrom:'2025-12-18',profilesChecked:players.length,pagesChecked:0,entriesFound:hits.length,errors:[]};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('te-entries.json',JSON.stringify({...data.teEntryDiscovery,hits},null,2)+'\n');
console.log(JSON.stringify(data.teEntryDiscovery,null,2));
