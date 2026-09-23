import fs from 'node:fs/promises';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [historical,live,registry,tournamentCatalog,tournamentHistory]=await Promise.all([
  read('dist/v3/tennis_europe_oop_historical.json'),
  read('dist/v3/tennis_europe_oop_live.json'),
  read('players.json'),
  read('dist/v3/source_tennis_europe_tournaments_sharded.json'),
  read('history/tennis_europe_tournament_catalog.json')
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
const officialPlayers=new Map(),invalidMatches=[],invalidPlayers=[];
for(const match of matchMap.values()){
  const players=match.players||[],expectedPlayers=match.opponentPending?[1]:[2,4];
  if(!match.id||!match.competitionId||!match.date||!match.event||!match.round||!expectedPlayers.includes(players.length))invalidMatches.push({matchId:match.id||'',competitionId:match.competitionId||'',date:match.date||'',event:match.event||'',round:match.round||'',players:players.length,opponentPending:Boolean(match.opponentPending)});
  for(const player of players){
    const key=normalize(player.name),sourceId=String(player.id||'').trim(),identity=(player.nationality||'')+'|'+key;
    if(!sourceIdentities.has(key))sourceIdentities.set(key,new Set());sourceIdentities.get(key).add(identity);
    if(!sourceId||!key)invalidPlayers.push({matchId:match.id||'',sourceId,name:player.name||'',nationality:player.nationality||''});
    // The draw feed's numeric player id is local to a draw, not a global TE profile id.
    // Scope it to competition + event so reuse in another draw is not reported as a
    // false identity collision, while conflicting identities inside one draw still fail.
    if(sourceId){const scopedSourceId=[match.competitionId,normalize(match.event),sourceId].join('|'),known=officialPlayers.get(scopedSourceId)||new Set(),officialIdentity=(player.nationality||'')+'|'+key.split(' ').filter(Boolean).sort().join(' ');known.add(officialIdentity);officialPlayers.set(scopedSourceId,known)}
  }
}
const identityCollisions=[...officialPlayers].filter(([,identities])=>identities.size>1).map(([scopedSourceId,identities])=>({scopedSourceId,identities:[...identities]}));
const metadataByTournament=new Map((tournamentCatalog.tournaments||[]).map(t=>[String(t.competitionId||''),t]));
const archivedMetadataByTournament=new Map(Object.values(tournamentHistory.tournaments||{}).map(t=>[String(t.competitionId||''),t]));
const recentTournamentIds=new Set([...matchMap.values()].filter(match=>String(match.date||'')>='2026-01-25').map(match=>String(match.competitionId||'')));
const tournamentMetadata=competitionId=>{const current=metadataByTournament.get(competitionId)||{},catalogArchive=archivedMetadataByTournament.get(competitionId)||{},oopArchive=tournamentMap.get(competitionId)||{},sources=[current,catalogArchive,oopArchive],first=(...fields)=>{for(const source of sources)for(const field of fields)if(source[field])return source[field];return''},flag=field=>sources.some(source=>source[field]===true);return{tournamentName:first('tournamentName','name'),startDate:first('startDate','officialStartDate'),endDate:first('endDate'),surface:first('surface','courtSurface','playingSurface'),environment:first('environment','courtEnvironment','indoorOutdoor')||(flag('indoor')?'Indoor':flag('outdoor')?'Outdoor':'')}};
const incompleteTournamentMetadata=[...recentTournamentIds].filter(Boolean).map(competitionId=>({competitionId,...tournamentMetadata(competitionId)})).filter(item=>!item.tournamentName||!item.startDate||!item.endDate||!item.surface||!item.environment);
const ambiguous=[],occurrenceMap=new Map();
for(const [key,owners] of ownersByName)if(owners.length>1)ambiguous.push({type:'courtwatch_name_collision',normalizedName:key,courtwatchIds:owners.map(x=>x.id)});
for(const match of matchMap.values())for(const player of match.players||[]){const key=normalize(player.name),owners=ownersByName.get(key)||[];if(!owners.length)continue;const variants=[...(sourceIdentities.get(key)||[])];if(variants.length>1){ambiguous.push({type:'source_identity_collision',normalizedName:key,variants,courtwatchIds:owners.map(x=>x.id)});continue}for(const owner of owners){const tournament=tournamentMap.get(match.competitionId)||{};occurrenceMap.set(owner.id+'|'+match.id,{courtwatchId:owner.id,playerName:owner.name,sourcePlayerName:player.name,sourceNationality:player.nationality||'',matchId:match.id,competitionId:match.competitionId,tournamentName:tournament.tournamentName||tournament.name||'',location:tournament.location||'',date:match.date,time:match.time||'',court:match.court||'',event:match.event||'',round:match.round||'',status:match.status,score:match.score||'',winnerPlayerIds:match.winnerPlayerIds||[],sourceUrl:match.sourceUrl,linkMethod:'exact_normalized_full_name'});}}
const occurrences=[...occurrenceMap.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.playerName.localeCompare(b.playerName)||a.matchId.localeCompare(b.matchId));
const uniqueMatches=new Set(occurrences.map(x=>x.matchId)),playersWithMatches=new Set(occurrences.map(x=>x.courtwatchId));
const completed=occurrences.filter(x=>x.status==='completed').length,scheduled=occurrences.filter(x=>x.status==='scheduled').length;
const dedupAmbiguous=[...new Map(ambiguous.map(x=>[JSON.stringify(x),x])).values()];
const result={version:'te-courtwatch-complete-audit-v3',generatedAt:new Date().toISOString(),status:historical.status==='green'&&live.status==='green'&&dedupAmbiguous.length===0&&invalidMatches.length===0&&invalidPlayers.length===0&&identityCollisions.length===0&&incompleteTournamentMetadata.length===0?'green':'red',rules:{historyLiveMerge:'live_overwrites_same_match_id',playerLink:'draw_scoped_source_id_with_exact_normalized_courtwatch_projection',sourceIdScope:'competition_and_event',aliases:false,agendaPublished:false,recentMetadataCoverageFrom:'2026-01-25',tournamentMetadata:'current_catalog_then_historical_catalog_then_oop_archive'},counts:{monitoredEuropePlayers:monitored.length,playersWithMatches:playersWithMatches.size,uniqueMatches:uniqueMatches.size,playerMatchOccurrences:occurrences.length,completed,scheduled,officialPlayerIds:officialPlayers.size,ambiguous:dedupAmbiguous.length,invalidMatches:invalidMatches.length,invalidPlayers:invalidPlayers.length,identityCollisions:identityCollisions.length,incompleteTournamentMetadata:incompleteTournamentMetadata.length},ambiguous:dedupAmbiguous,invalidMatches,invalidPlayers,identityCollisions,incompleteTournamentMetadata,occurrences};
await fs.writeFile('dist/v3/tennis_europe_courtwatch_complete_audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,counts:result.counts},null,2));
if(result.status!=='green')throw new Error('Court Watch complete Europe match audit is ambiguous');
