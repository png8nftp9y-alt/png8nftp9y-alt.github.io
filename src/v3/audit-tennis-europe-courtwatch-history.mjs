import fs from 'node:fs/promises';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [historical,live,registry]=await Promise.all([
  read('dist/v3/tennis_europe_oop_historical.json'),
  read('dist/v3/tennis_europe_oop_live.json'),
  read('players.json')
]);
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const monitored=(registry.players||[]).filter(p=>(p.circuits||[]).some(c=>normalize(c)==='tennis europe'));
const ownersByName=new Map();
for(const p of monitored){const key=normalize(p.name);if(!ownersByName.has(key))ownersByName.set(key,[]);ownersByName.get(key).push(p)}
const tournamentMap=new Map((historical.tournaments||[]).map(t=>[t.competitionId,t]));
for(const t of live.tournaments||[])tournamentMap.set(t.competitionId,t);
const matchMap=new Map((historical.matches||[]).map(m=>[m.id,m]));
for(const m of live.matches||[])matchMap.set(m.id,m);
const sourceIdentities=new Map();
for(const match of matchMap.values())for(const player of match.players||[]){const key=normalize(player.name),identity=(player.nationality||'')+'|'+key;if(!sourceIdentities.has(key))sourceIdentities.set(key,new Set());sourceIdentities.get(key).add(identity)}
const ambiguous=[],occurrenceMap=new Map();
for(const [key,owners] of ownersByName)if(owners.length>1)ambiguous.push({type:'courtwatch_name_collision',normalizedName:key,courtwatchIds:owners.map(x=>x.id)});
for(const match of matchMap.values())for(const player of match.players||[]){const key=normalize(player.name),owners=ownersByName.get(key)||[];if(!owners.length)continue;const variants=[...(sourceIdentities.get(key)||[])];if(variants.length>1){ambiguous.push({type:'source_identity_collision',normalizedName:key,variants,courtwatchIds:owners.map(x=>x.id)});continue}for(const owner of owners){const tournament=tournamentMap.get(match.competitionId)||{};occurrenceMap.set(owner.id+'|'+match.id,{courtwatchId:owner.id,playerName:owner.name,sourcePlayerName:player.name,sourceNationality:player.nationality||'',matchId:match.id,competitionId:match.competitionId,tournamentName:tournament.tournamentName||tournament.name||'',location:tournament.location||'',date:match.date,time:match.time||'',court:match.court||'',event:match.event||'',round:match.round||'',status:match.status,score:match.score||'',winnerPlayerIds:match.winnerPlayerIds||[],sourceUrl:match.sourceUrl,linkMethod:'exact_normalized_full_name'});}}
const occurrences=[...occurrenceMap.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.playerName.localeCompare(b.playerName)||a.matchId.localeCompare(b.matchId));
const uniqueMatches=new Set(occurrences.map(x=>x.matchId)),playersWithMatches=new Set(occurrences.map(x=>x.courtwatchId));
const completed=occurrences.filter(x=>x.status==='completed').length,scheduled=occurrences.filter(x=>x.status==='scheduled').length;
const dedupAmbiguous=[...new Map(ambiguous.map(x=>[JSON.stringify(x),x])).values()];
const result={version:'te-courtwatch-complete-audit-v1',generatedAt:new Date().toISOString(),status:historical.status==='green'&&live.status==='green'&&dedupAmbiguous.length===0?'green':'red',rules:{historyLiveMerge:'live_overwrites_same_match_id',playerLink:'exact_normalized_full_name',aliases:false,agendaPublished:false},counts:{monitoredEuropePlayers:monitored.length,playersWithMatches:playersWithMatches.size,uniqueMatches:uniqueMatches.size,playerMatchOccurrences:occurrences.length,completed,scheduled,ambiguous:dedupAmbiguous.length},ambiguous:dedupAmbiguous,occurrences};
await fs.writeFile('dist/v3/tennis_europe_courtwatch_complete_audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,counts:result.counts},null,2));
if(result.status!=='green')throw new Error('Court Watch complete Europe match audit is ambiguous');
