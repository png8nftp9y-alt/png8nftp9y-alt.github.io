import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {NOW,aliases,norm,readJson,writeJson} from './itf-common.mjs';

const dir='dist/v3/shards/itf';
const sourceFile='dist/v3/source_itf_entries.json';
const source=await readJson(sourceFile,{entries:[]});
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const byTournament=new Map((map.tournaments||[]).map(t=>[t.competitionId,t]));
const former=new Set(((await readJson('former-players.json',{players:[]})).players||[]).map(p=>p.id));
const players=((await readJson('players.json',{players:[]})).players||[]).filter(p=>!former.has(p.id));
const discovered=new Map(),files=[],errors=[];

let namesRead=0,matchesRead=0;
try{files.push(...(await fs.readdir(dir)).filter(f=>/^results-\d+\.json\.gz$/.test(f)).sort())}catch{}
for(const file of files){
 let shard;
 try{shard=JSON.parse(gunzipSync(await fs.readFile(`${dir}/${file}`)))}catch(error){errors.push({file,error:error.message});continue}
 for(const match of shard.matches||[]){
  matchesRead++;
  for(const team of match.teams||[])for(const raw of team.players||[]){
   const name=String(raw.name||[raw.givenName,raw.familyName].filter(Boolean).join(' ')).trim();
   if(!name)continue;
   namesRead++;
   const player=players.find(p=>aliases(p).some(alias=>norm(name)===alias));
   if(!player)continue;
   const tournament=byTournament.get(match.competitionId)||match;
   const key=`${player.id}|${match.competitionId}`;
   discovered.set(key,{playerId:player.id,playerName:player.name,worldTennisId:String(raw.id||''),circuit:'itf',competitionId:match.competitionId,tournamentName:tournament.tournamentName||match.tournamentName||'',location:tournament.location||'',startDate:tournament.startDate||match.startDate||'',endDate:tournament.endDate||match.endDate||'',category:tournament.category||'',sourceUrl:tournament.sourceUrl||match.sourceUrl||'',entryStatus:'draw_confirmed',calendarState:'draw_confirmed',acceptanceCode:'',acceptancePosition:null,calendarListLabel:'',lastSeen:NOW,drawDiscoverySource:file});
  }
 }
}

const merged=new Map((source.entries||[]).map(e=>[`${e.playerId}|${e.competitionId}`,e]));
for(const [key,entry] of discovered)merged.set(key,entry);
const entries=[...merged.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.playerName).localeCompare(String(b.playerName)));
await writeJson(sourceFile,{...source,version:3,generatedAt:NOW,entriesFound:entries.length,drawEntriesDiscovered:discovered.size,entries});
await writeJson('dist/v3/source_itf_draw_entry_discovery_audit.json',{version:1,generatedAt:NOW,status:errors.length?'itf_draw_entry_discovery_with_errors':'itf_draw_entry_discovery_complete',resultShardFiles:files.length,matchesRead,namesRead,trackedPlayersFound:discovered.size,entries:[...discovered.values()],errors});
console.log(JSON.stringify({resultShardFiles:files.length,matchesRead,namesRead,trackedPlayersFound:discovered.size,errors:errors.length},null,2));
if(errors.length)process.exitCode=2;
