import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {storedIdentities} from './player-identity-lookup.mjs';
import {participantSourceKey,participantAliases,historyFromSources} from './personal-tennis-europe-history.mjs';

const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const PAGE=250, GROUP=32;
const requested=`SELECT json_extract(j.value,'$.slot') AS slot,json_extract(j.value,'$.circuit') AS circuit,json_extract(j.value,'$.native') AS native,json_extract(j.value,'$.names') AS names,json_extract(j.value,'$.aliases') AS aliases,json_extract(j.value,'$.after') AS after FROM json_each(?) j`;
async function read(db,sql,values,state){
 if(state.error)throw state.error;
 try{
  const result=await db.prepare(sql).bind(...values).all();
  if(result.success===false||!Array.isArray(result.results))throw Error('shared_history_incomplete');
  return result.results;
 }catch(error){state.error??=error;throw error}
}
async function candidates(db,group,state){
 const result=group.map(()=>[]);let slot=-1,match='',participant='';
 const sql=`WITH requested AS MATERIALIZED (${requested})
 SELECT q.slot AS history_slot,p.match_id,p.participant_key,p.source_player_id,p.display_name,p.normalized_name,p.nationality,p.payload
 FROM requested q CROSS JOIN json_each(q.names) n CROSS JOIN match_participants p CROSS JOIN matches m ON m.id=p.match_id
 WHERE q.native IS NOT NULL AND q.slot>=? AND p.normalized_name=n.value
 AND (p.source_player_id IS NULL OR p.source_player_id<>q.native) AND m.circuit=q.circuit
 AND (q.slot,+p.match_id,p.participant_key)>(?,?,?)
 ORDER BY q.slot,p.match_id,p.participant_key LIMIT ${PAGE}`;
 const input=JSON.stringify(group.map((d,slot)=>({slot,circuit:d.circuit,native:d.native,names:[...new Set(d.names.flatMap(n=>[n,n.toUpperCase()]))]})));
 while(true){
  const page=await read(db,sql,[input,slot,slot,match,participant],state);
  for(const {history_slot,...row} of page){if(!result[history_slot])throw Error('shared_history_incomplete');result[history_slot].push(row)}
  if(page.length<PAGE)return result;
  const end=page.at(-1);if(end.history_slot<slot||end.history_slot===slot&&(end.match_id<match||end.match_id===match&&end.participant_key<=participant))throw Error('personal_history_pagination_failed');
  slot=end.history_slot;match=end.match_id;participant=end.participant_key;
 }
}
async function sources(db,group,state,{aliasesOnly=false}={}){
 const result=group.map(()=>[]);
 let pending=group.map(({circuit,native,names,aliases},slot)=>({slot,circuit,native,names,aliases,after:''}));
 while(pending.length){
  // Divide a bounded response among active identities. Completed identities
  // disappear from the next page; a lone long history gets the whole page.
  // Each seek starts after that identity's last row, without rereading the
  // future histories in the group or materializing their full candidate sets.
  const pageSize=Math.floor(PAGE/pending.length);
  const native=`SELECT DISTINCT p.match_id AS id FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id WHERE p.source_player_id=q.native AND p.match_id>q.after AND m.circuit=q.circuit ORDER BY p.match_id LIMIT ${pageSize}`;
  const names=`SELECT DISTINCT p.match_id AS id FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id WHERE lower(p.normalized_name) IN (SELECT value FROM json_each(q.names)) AND p.match_id>q.after AND m.circuit=q.circuit ORDER BY p.match_id LIMIT ${pageSize}`;
  const aliases=`SELECT value AS id FROM json_each(q.aliases) WHERE value>q.after ORDER BY value LIMIT ${pageSize}`;
  const ids=aliasesOnly?`(SELECT json_group_array(id) FROM (${aliases}))`:
   `CASE WHEN q.native IS NOT NULL THEN (SELECT json_group_array(id) FROM (${native})) ELSE (SELECT json_group_array(id) FROM (${names})) END`;
  const sql=`WITH candidate_matches AS MATERIALIZED (
   WITH requested AS MATERIALIZED (${requested})
   SELECT q.slot,a.value AS match_id FROM requested q CROSS JOIN json_each(${ids}) a
  ) SELECT ids.slot AS history_slot,m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id,
  (SELECT json_group_array(json_object('match_id',hp.match_id,'participant_key',hp.participant_key,'source_player_id',hp.source_player_id,'display_name',hp.display_name,'normalized_name',hp.normalized_name,'nationality',hp.nationality,'team_index',hp.team_index,'is_winner',hp.is_winner,'payload',hp.payload))
  FROM (SELECT match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload FROM match_participants WHERE match_id=m.id ORDER BY team_index,participant_key) hp) AS history_participants
  FROM candidate_matches ids CROSS JOIN matches m ON m.id=ids.match_id
  LEFT JOIN tournaments t ON t.id=m.tournament_id ORDER BY ids.slot,m.id`;
  const page=await read(db,sql,[JSON.stringify(pending)],state),bySlot=new Map(pending.map(d=>[d.slot,[]]));
  for(const {history_slot,...row} of page){
   if(!bySlot.has(history_slot))throw Error('shared_history_incomplete');bySlot.get(history_slot).push(row);
  }
  const next=[];
  for(const d of pending){const batch=bySlot.get(d.slot);
   if(batch.length>pageSize)throw Error('shared_history_incomplete');
   let last=d.after;for(const row of batch){if(row.match_id<=last)throw Error('personal_history_pagination_failed');last=row.match_id}
   result[d.slot].push(...batch);
   if(batch.length===pageSize)next.push({...d,after:last});
  }
  pending=next;
 }
 return result;
}

// Snapshot-local reads shared by players. No persisted cache, retry or timer.
export async function sharedPlayerHistories(db,players,{configuredIds=new Set()}={}){
 const descriptors=players.flatMap((player,playerIndex)=>{
  const identities=playerCircuitIdentities(player),name=normalize(player.name);
  let circuits=configuredIds.has(player.id)?['itf']:identities.map(p=>p.circuit);
  if(!circuits.length&&['fitp','tennis-europe','itf'].includes(player.sourceCircuit))circuits=[player.sourceCircuit];
  const names=[...new Set([name,name.split(' ').reverse().join(' ')])];
  return name?circuits.map(circuit=>({player,playerIndex,circuit,native:identities.find(p=>p.circuit===circuit)?.profileId||null,names,aliases:[]})):[];
 });
 const groups=[];for(let i=0;i<descriptors.length;i+=GROUP)groups.push(descriptors.slice(i,i+GROUP));
 const nativeRows=new Map(),aliasRows=new Map();let next=0;const state={};
 // At most two groups and four source requests in flight. A slow group
 // cannot hold the other group's next page behind a global batch barrier.
 async function worker(){while(next<groups.length&&!state.error){const group=groups[next++];
  const pair=await Promise.allSettled([sources(db,group,state),candidates(db,group,state)]);
  const rejected=pair.find(r=>r.status==='rejected');if(rejected){state.error??=rejected.reason;throw rejected.reason}
  const [native,aliases]=pair.map(r=>r.value);
  group.forEach((d,i)=>{nativeRows.set(d,native[i]);aliasRows.set(d,aliases[i])});
 }}
 const settled=await Promise.allSettled([worker(),worker()]);if(state.error)throw state.error;
 for(const r of settled)if(r.status==='rejected')throw r.reason;
 const keyed=new Map();
 for(const d of descriptors)keyed.set(d,await Promise.all(aliasRows.get(d).map(async p=>({p,key:await participantSourceKey(d.circuit,p)}))));
 const lookup=descriptors.filter(d=>keyed.get(d).length).flatMap(d=>[d.player.sourceKey,d.player.canonicalId,d.player.id,...keyed.get(d).map(x=>x.key)]);
 const people=lookup.length?await storedIdentities(db,lookup):new Map();
 const proofs=new Map();
 for(const d of descriptors){
  const aliases=participantAliases(d.player,d.circuit,d.native,keyed.get(d),people);proofs.set(d,aliases);
  const known=new Set(nativeRows.get(d).map(row=>row.match_id));
  d.aliases=[...new Set([...aliases].map(key=>JSON.parse(key)[0]))].filter(id=>!known.has(id));
 }
 // Only authorized local-ID matches absent from native results need this read.
 for(const group of groups){if(!group.some(d=>d.aliases.length))continue;
  const extra=await sources(db,group,state,{aliasesOnly:true});group.forEach((d,i)=>nativeRows.get(d).push(...extra[i]));
 }
 const byPlayer=players.map(()=>[]);
 for(const d of descriptors){const rows=nativeRows.get(d).sort((a,b)=>a.match_id<b.match_id?-1:a.match_id>b.match_id?1:0);
  byPlayer[d.playerIndex].push(historyFromSources(d.player,d.circuit,d.native,proofs.get(d),rows));
 }
 return players.map((player,i)=>({player:byPlayer[i].reduce((p,h)=>({...p,...h.player}),player),tournaments:byPlayer[i].flatMap(h=>h.tournaments),matches:byPlayer[i].flatMap(h=>h.matches)}));
}
