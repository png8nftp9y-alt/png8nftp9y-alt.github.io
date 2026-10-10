import fs from 'node:fs/promises';
import {unresolvedSources} from '../../cloudflare/app-api/scripts/repair-archived-player-profiles.mjs';
import {normalizePlayerName} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
import {sqlString} from './itf-draw-document-d1.mjs';
const base='https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database';
const headers={Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'};
const list=await fetch(base+'?name=courtwatch-app&per_page=100',{headers}),body=await list.json();
if(!list.ok||!body.success)throw Error('lineage_database_list_failed');
const database=body.result.find(d=>d.name==='courtwatch-app'),id=database?.uuid||database?.id;
if(!id)throw Error('lineage_existing_database_missing');
async function query(sql){
 if(!/^SELECT\b/i.test(sql))throw Error('lineage_read_only_guard');
 const r=await fetch(base+'/'+id+'/query',{method:'POST',headers,body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();
 if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('lineage_query_failed');
 return j.result[0].results||[];
}
const rows=(await unresolvedSources(query)).filter(r=>r.circuit==='tennis-europe'&&!r.official_id),groups=new Map();
for(const r of rows){const n=normalizePlayerName(r.display_name),group=groups.get(n)||[];group.push(r);groups.set(n,group);}
const results=[];let index=0;
for(const [name,sources]of groups){
 const variants=[name,name.toLowerCase(),name.split(' ').reverse().join(' '),name.split(' ').reverse().join(' ').toLowerCase()];
 const participants=await query('SELECT p.source_player_id,p.participant_key,p.payload,m.payload AS match_payload,t.source_tournament_id FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=\'tennis-europe\' AND p.normalized_name IN ('+variants.map(sqlString).join(',')+') LIMIT 1000');
 const refs=new Map();
 for(const p of participants){
  const raw=JSON.parse(p.payload||'{}'),match=JSON.parse(p.match_payload||'{}');
  const ids=Object.fromEntries(Object.entries(raw).filter(([k,v])=>/^(id|playerId|sourcePlayerId|source_player_id|participantId|teProfileId|profileId|membershipCode)$/i.test(k)&&['string','number'].includes(typeof v)));
  const urls=Object.values(raw).filter(v=>typeof v==='string'&&/^(https:\/\/te\.tournamentsoftware\.com)?\/(sport\/player|player-profile)/i.test(v));
  const reference={sourcePlayerId:p.source_player_id,participantKey:p.participant_key,sourceTournamentId:p.source_tournament_id,fields:Object.keys(raw),ids,urls,matchFields:Object.keys(match),competitionId:match.competitionId||null};
  refs.set(JSON.stringify(reference),reference);
 }
 const result={index:index++,sourceKeys:sources.map(r=>r.source_key),links:sources.length,matches:participants.length,references:[...refs.values()]};results.push(result);
 console.log(JSON.stringify({index:result.index,links:result.links,matches:result.matches,referenceShapes:[...new Set(result.references.map(r=>r.fields.join(',')))]}));
}
await fs.mkdir('tmp/residual-player-lineage',{recursive:true});
await fs.writeFile('tmp/residual-player-lineage/lineage.json',JSON.stringify({generatedAt:new Date().toISOString(),rows:rows.length,names:groups.size,results}));
console.log(JSON.stringify({readOnly:true,rows:rows.length,names:groups.size}));
