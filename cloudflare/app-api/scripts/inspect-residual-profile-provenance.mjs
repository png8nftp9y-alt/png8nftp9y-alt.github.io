import fs from 'node:fs/promises';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
import {unresolvedSources} from './repair-archived-player-profiles.mjs';
import {normalizePlayerName} from '../lib/player-circuit-profiles.mjs';

const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
let requests=0,rowsRead=0;
async function query(sql){if(!/^SELECT\b/i.test(sql))throw Error('read_only_diagnostic');const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||!j.success||!j.result.every(x=>x.success))throw Error('D1_read_failed_'+r.status);requests++;for(const x of j.result)rowsRead+=Number(x.meta?.rows_read||0);return j.result[0].results||[]}
const sources=await unresolvedSources(query),results=[];
for(const source of sources){
 const name=normalizePlayerName(source.display_name),variants=[name,name.toLowerCase(),name.split(' ').reverse().join(' '),name.split(' ').reverse().join(' ').toLowerCase()],names=variants.map(sqlString).join(',');
 const entries=await query(`SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles WHERE circuit='tennis-europe' AND normalized_name IN (${names}) LIMIT 101`);
 const participants=await query(`SELECT p.source_player_id,p.display_name,p.nationality,p.payload,t.source_tournament_id,json_extract(m.payload,'$.event') AS event FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit='tennis-europe' AND p.normalized_name IN (${names}) LIMIT 201`);
 const aliases=await query(`SELECT profile_id,normalized_name,nationality FROM tennis_europe_player_aliases WHERE normalized_name IN (${names}) LIMIT 101`);
 const payload=JSON.parse(source.payload||'{}');
 const competitions=new Set(entries.flatMap(r=>{try{return(JSON.parse(r.payload||'{}').tournaments||[]).map(t=>t.competitionId)}catch{return[]}}));
 results.push({index:results.length,sourceFields:Object.keys(payload).filter(k=>/^[a-zA-Z_]+$/.test(k)),entries:entries.length,entryTournaments:competitions.size,participants:participants.length,matchingCountryParticipants:participants.filter(p=>p.nationality===source.nationality).length,aliases:aliases.length,matchingCountryAliases:aliases.filter(a=>a.nationality===source.nationality).length});
}
console.log(JSON.stringify({status:'aggregate_only',requests,rowsRead,rowsWritten:0,results}));
