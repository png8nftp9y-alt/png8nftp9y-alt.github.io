import fs from 'node:fs/promises';
const INPUT=process.env.TE_OOP_INPUT||'dist/v3/tennis_europe_oop_live.json';
const OUTPUT=process.env.TE_OOP_COURTWATCH_OUTPUT||'dist/v3/tennis_europe_courtwatch_matches.json';
const source=JSON.parse(await fs.readFile(INPUT,'utf8')),registry=JSON.parse(await fs.readFile('players.json','utf8'));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const monitored=(registry.players||[]).filter(p=>(p.circuits||[]).some(c=>normalize(c)==='tennis europe'));
const names=new Map(monitored.map(p=>[normalize(p.name),p])),occurrences=[],matchIds=new Set(),ambiguous=[];
const sourceNames=new Map();
for(const match of source.matches||[])for(const player of match.players||[]){const key=normalize(player.name);if(!sourceNames.has(key))sourceNames.set(key,new Set());sourceNames.get(key).add((player.nationality||'')+'|'+player.name)}
for(const match of source.matches||[])for(const player of match.players||[]){const owner=names.get(normalize(player.name));if(!owner)continue;const variants=sourceNames.get(normalize(player.name))?.size||0;if(variants>1)ambiguous.push({courtwatchId:owner.id,name:owner.name,variants});occurrences.push({courtwatchId:owner.id,playerName:owner.name,sourcePlayerName:player.name,matchId:match.id,competitionId:match.competitionId,date:match.date,status:match.status,event:match.event,round:match.round,time:match.time,court:match.court,courtMatchNumber:match.courtMatchNumber,score:match.score,sourceUrl:match.sourceUrl,linkMethod:'exact_normalized_full_name'});matchIds.add(match.id)}
const result={version:'te-courtwatch-match-projection-v1',generatedAt:new Date().toISOString(),status:source.status==='green'&&ambiguous.length===0?'green':'red',counts:{monitoredEuropePlayers:monitored.length,uniqueMatches:matchIds.size,playerMatchOccurrences:occurrences.length,ambiguous:ambiguous.length},ambiguous,occurrences};
await fs.writeFile(OUTPUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,counts:result.counts},null,2));if(result.status!=='green')throw new Error('Court Watch Europe match projection ambiguous');
