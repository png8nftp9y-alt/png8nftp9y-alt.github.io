import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.TE_OOP_SHARDS_DIR||'dist/v3/downloaded-tennis-europe-oop';
const OUTPUT=process.env.TE_OOP_MERGED_OUTPUT||'dist/v3/tennis_europe_oop_historical.json';
const EXPECTED_SHARDS=Number(process.env.TE_OOP_EXPECTED_SHARDS||16);

async function files(dir){const out=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await files(full));else if(entry.isFile()&&entry.name.endsWith('.json'))out.push(full)}return out}
function normalizedName(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase()}

const inputs=await files(ROOT),shards=[];
for(const file of inputs){const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.version==='te-oop-backfill-shard-v1')shards.push(value)}
shards.sort((a,b)=>a.shard-b.shard);
const shardIds=shards.map(x=>x.shard),missing=[...Array(EXPECTED_SHARDS).keys()].filter(x=>!shardIds.includes(x));
const tournamentMap=new Map(),matchMap=new Map(),conflicts=[];
for(const shard of shards){for(const tournament of shard.tournaments||[]){const old=tournamentMap.get(tournament.competitionId);if(old&&JSON.stringify(old)!==JSON.stringify(tournament))conflicts.push({type:'tournament',id:tournament.competitionId});else tournamentMap.set(tournament.competitionId,tournament)}for(const match of shard.matches||[]){const old=matchMap.get(match.id);if(old&&JSON.stringify(old)!==JSON.stringify(match))conflicts.push({type:'match',id:match.id});else matchMap.set(match.id,match)}}
const tournaments=[...tournamentMap.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||a.competitionId.localeCompare(b.competitionId)),matches=[...matchMap.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const identityMap=new Map();
for(const match of matches)for(const player of match.players||[]){const identityKey=(player.nationality||'')+'|'+normalizedName(player.name);const old=identityMap.get(identityKey)||{identityKey,name:player.name,nationality:player.nationality||'',occurrences:0,tournaments:new Set()};old.occurrences++;old.tournaments.add(match.competitionId);identityMap.set(identityKey,old)}
const identities=[...identityMap.values()].map(x=>({...x,tournaments:[...x.tournaments].sort()})).sort((a,b)=>a.identityKey.localeCompare(b.identityKey));
const completed=matches.filter(x=>x.status==='completed'),scheduled=matches.filter(x=>x.status==='scheduled'),winnerUnresolved=completed.filter(x=>!x.winnerPlayerIds?.length).length,withoutOop=tournaments.filter(x=>(x.dates||[]).length===0).length,sourceFailures=shards.reduce((n,x)=>n+(x.failures||[]).length,0);
const MIN_TOURNAMENTS=Number(process.env.TE_OOP_MIN_TOURNAMENTS||453);
const result={version:'te-oop-historical-v1',generatedAt:new Date().toISOString(),status:shards.length===EXPECTED_SHARDS&&missing.length===0&&tournaments.length>=MIN_TOURNAMENTS&&conflicts.length===0&&sourceFailures===0&&winnerUnresolved===0?'green':'red',sourceRunId:process.env.TE_OOP_SOURCE_RUN_ID||null,minimumTournamentCount:MIN_TOURNAMENTS,counts:{shards:shards.length,tournaments:tournaments.length,withoutOop,matches:matches.length,completed:completed.length,scheduled:scheduled.length,singles:matches.filter(x=>x.players.length===2).length,doubles:matches.filter(x=>x.players.length===4).length,uniqueNominalIdentities:identities.length,winnerUnresolved,sourceFailures,conflicts:conflicts.length},missingShards:missing,conflicts,tournaments,matches,identities};
await fs.mkdir(path.dirname(OUTPUT),{recursive:true});await fs.writeFile(OUTPUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,counts:result.counts,missingShards:missing},null,2));if(result.status!=='green')throw new Error('Tennis Europe OOP merge incomplete');
