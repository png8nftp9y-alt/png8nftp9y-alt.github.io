import {readD1Rows} from './d1-read-retry.mjs';
import {mappedPlayerId,storedIdentity,storedIdentities} from './player-identity-lookup.mjs';
import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {personalPlayerMetadata,officialFitpClub} from './personal-player-metadata.mjs';
// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {playerListGroup,playerMembershipTable,playerMembershipGuard} from './player-list-group.mjs';

const nameKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase().split(' ').sort().join(' ');
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const parse=value=>{try{return JSON.parse(value||'{}')}catch{return{}}};

export async function hydratePersonalCircuitIdentity(db,player,identity=undefined){
 if(identity===undefined)identity=await storedIdentity(db,player.sourceKey||player.id);
 const result=personalPlayerMetadata({...player,circuitProfiles:identity?.circuitProfiles||player.circuitProfiles||[]},identity||{});
 for(const link of playerCircuitIdentities(result)){
  if(link.circuit==='fitp')result.membershipCard=link.profileId;
  if(link.circuit==='itf')result.worldTennisId=link.profileId;
  if(link.circuit==='tennis-europe')result.profileSync={...result.profileSync,tennisEurope:{...result.profileSync?.tennisEurope,profileId:link.profileId}};
 }
 result.circuits=[...new Set([...(result.circuits||[]),...playerCircuitIdentities(result).map(p=>p.circuit)])];
 return result;
}

export async function addCourtWatchPlayer(env,user,body,{fetchClub=officialFitpClub}={}){
 const group=playerListGroup(body?.group??'main'),membership=playerMembershipTable(group);
 let sourceKey=String(body?.sourceKey||'').trim(),courtwatchId=String(body?.courtwatchId||'').trim(),identity=String(body?.identity||'').trim(),name=String(body?.name||'').trim();
 if((!sourceKey&&!courtwatchId&&!identity)||sourceKey.length>240||courtwatchId.length>160||identity.length>160||name.length>160)throw failure('invalid_player');
 // The opponent page submits identity even for a configured app player.
 // Resolve that exact app identity before looking in circuit source tables.
 if(!sourceKey&&!courtwatchId&&identity){
  const configured=await env.DB.prepare('SELECT id,payload FROM app_players WHERE id=?').bind(identity).first();
  if(configured){if(name&&nameKey(parse(configured.payload).name)!==nameKey(name))throw failure('player_identity_ambiguous',409);courtwatchId=configured.id;}
  else if(await env.DB.prepare('SELECT courtwatch_id FROM user_app_player_additions WHERE user_id=? AND courtwatch_id=?').bind(user.id,identity).first())courtwatchId=identity;
 }
 let player,observedSourceKey;
 if(courtwatchId&&!sourceKey){
  let row=await env.DB.prepare('SELECT id,payload FROM app_players WHERE id=?').bind(courtwatchId).first();
  if(!row){const personal=await env.DB.prepare('SELECT courtwatch_id AS id,observed_source_key,payload FROM user_app_player_additions WHERE user_id=? AND courtwatch_id=?').bind(user.id,courtwatchId).first();if(personal)row=personal;}
  if(!row)throw failure('player_not_found',404);
  if(name&&nameKey(parse(row.payload).name)!==nameKey(name))throw failure('player_identity_ambiguous',409);
  player={...parse(row.payload),id:row.id,userAdded:true};observedSourceKey=row.observed_source_key||'courtwatch|'+row.id;
 }else{
  const sourceTable=(sourceKey||identity).startsWith('acquired|')?'search_acquired_players':'observed_players';
  let rows=(await env.DB.prepare(`SELECT source_key,circuit,official_id,display_name,payload FROM ${sourceTable} WHERE source_key=? OR official_id=? LIMIT 20`).bind(sourceKey||identity,sourceKey?'':identity).all()).results||[];
  if(!rows.length&&!sourceKey&&identity){try{rows=(await env.DB.prepare('SELECT source_key,circuit,official_id,display_name,payload FROM search_acquired_players WHERE source_key=? OR official_id=? LIMIT 20').bind(identity,identity).all()).results||[]}catch(error){if(!/no such table/i.test(error.message))throw error}}
  // Search may return a retained canonical identity after an upstream rebuild,
  // or its verified current name may differ from the original circuit spelling.
  // Resolve the exact server-side identity; never replace a selected source by name.
  if(!rows.some(row=>(!sourceKey||row.source_key===sourceKey)&&(!name||nameKey(row.display_name)===nameKey(name)))){
   const selected=await storedIdentity(env.DB,sourceKey||identity);
   if(selected&&(!name||nameKey(selected.name)===nameKey(name))){
    const retainedKey=sourceKey||selected.sourceKey;
    if(retainedKey){
     const link=await env.DB.prepare('SELECT source_key,circuit,official_id,display_name,nationality,birth_year,profile_url FROM player_circuit_identities WHERE source_key=? AND canonical_id=?').bind(retainedKey,selected.canonicalId).first();
     if(link&&['fitp','tennis-europe','itf'].includes(link.circuit)){
      const original=rows.find(r=>r.source_key===retainedKey);
      rows=[{...link,display_name:selected.name,payload:JSON.stringify({...selected,...parse(original?.payload),birthYear:link.birth_year||selected.birthYear,nationality:link.nationality||selected.nationality,profileUrl:link.profile_url||parse(original?.payload).profileUrl||''})}];
     }
    }
   }
  }
  if(!rows.length&&!sourceKey&&name){
   const normalized=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim(),reverse=normalized.split(' ').reverse().join(' '),variants=[...new Set([normalized.toUpperCase(),reverse.toUpperCase(),normalized.toLowerCase(),reverse.toLowerCase()])];
   rows=(await env.DB.prepare(`SELECT source_key,circuit,official_id,display_name,payload FROM observed_players WHERE normalized_name IN (${variants.map(()=>'?').join(',')}) LIMIT 20`).bind(...variants).all()).results||[];
  }
  const candidates=rows.filter(row=>(!sourceKey||row.source_key===sourceKey)&&(!name||nameKey(row.display_name)===nameKey(name)));
  if(candidates.length!==1)throw failure(candidates.length?'player_identity_ambiguous':'player_not_found',candidates.length?409:404);
  const row=candidates[0],payload=parse(row.payload),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.source_key));
  const id='cw-'+Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
  player={id,name:row.display_name,circuits:[row.circuit],nationality:payload.nationality||'',club:payload.club||'',sourceCircuit:row.circuit,sourceKey:row.source_key,sourcePlayerId:row.official_id||'',userAdded:true,profileUrl:payload.profileUrl||''};
  if(row.circuit==='fitp'){player.membershipCard=row.official_id||'';player.ranking=payload.ranking||'';}
  if(row.circuit==='itf')player.worldTennisId=row.official_id||'';
  if(row.circuit==='tennis-europe')player.profileSync={tennisEurope:{profileId:row.official_id||''}};
  // Reuse a configured player only with a matching official circuit identity.
  const identityPaths={fitp:'$.membershipCard',itf:'$.worldTennisId','tennis-europe':'$.profileSync.tennisEurope.profileId'};
  const identityPath=identityPaths[row.circuit];
  if(row.official_id&&identityPath){
   const existing=(await env.DB.prepare('SELECT id,payload FROM app_players WHERE CAST(json_extract(payload,?) AS TEXT)=? LIMIT 2').bind(identityPath,String(row.official_id)).all()).results||[];
   if(existing.length>1)throw failure('player_identity_ambiguous',409);
   if(existing.length===1)player={...parse(existing[0].payload),id:existing[0].id,userAdded:true,sourceCircuit:row.circuit,sourceKey:row.source_key,sourcePlayerId:row.official_id};
  }
  player=personalPlayerMetadata(player,payload);
  observedSourceKey=row.source_key;
 }
 const mapped=await mappedPlayerId(env.DB,observedSourceKey,user.id);if(mapped){player.id=mapped.playerId;player.canonicalId=mapped.canonicalId;}
 player=await hydratePersonalCircuitIdentity(env.DB,player);
 let [previous,linked,removed]=await Promise.all([
  env.DB.prepare('SELECT courtwatch_id,observed_source_key,payload FROM user_app_player_additions WHERE user_id=? AND observed_source_key=?').bind(user.id,observedSourceKey).first(),
  env.DB.prepare(`SELECT courtwatch_id FROM ${membership} WHERE user_id=? AND courtwatch_id=?`).bind(user.id,player.id).first(),
  group==='main'?env.DB.prepare('SELECT courtwatch_id FROM user_app_player_removals WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id).first():null
 ]);
 if(previous&&previous.courtwatch_id!==player.id){if(mapped){player.id=previous.courtwatch_id;[linked,removed]=await Promise.all([env.DB.prepare(`SELECT courtwatch_id FROM ${membership} WHERE user_id=? AND courtwatch_id=?`).bind(user.id,player.id).first(),group==='main'?env.DB.prepare('SELECT courtwatch_id FROM user_app_player_removals WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id).first():null]);}else throw failure('player_identity_conflict',409);}
 if(!player.club&&previous)player.club=personalPlayerMetadata(parse(previous.payload)).club||'';
 if(player.membershipCard&&!player.club){
  try{player.club=await fetchClub(player.membershipCard)||''}catch{player.club=''}
 }
 player=personalPlayerMetadata(player);
 const incoming={courtwatch_id:player.id,observed_source_key:observedSourceKey,payload:JSON.stringify(player)};
 const plan=buildIncrementalSyncPlan({current:previous?[previous]:[],incoming:[incoming],keyOf:row=>row.courtwatch_id,sourceComplete:Boolean(player.id&&player.name)});
 const now=new Date().toISOString(),statements=[];
 if(plan.inserts.length||plan.updates.length)statements.push(env.DB.prepare('INSERT INTO user_app_player_additions(user_id,courtwatch_id,observed_source_key,payload,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,courtwatch_id) DO UPDATE SET payload=excluded.payload WHERE user_app_player_additions.payload<>excluded.payload').bind(user.id,player.id,observedSourceKey,incoming.payload,now));
 if(!linked)statements.push(env.DB.prepare(`INSERT INTO ${membership}(user_id,courtwatch_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,courtwatch_id) DO NOTHING`).bind(user.id,player.id,now));
 if(removed)statements.push(env.DB.prepare('DELETE FROM user_app_player_removals WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id));
 if(statements.length)await env.DB.batch(statements);
 return{added:true,playerId:player.id,player,group,changed:statements.length>0};
}

export async function linkedFitpMetadata(db,players){
 const cards=[...new Set(players.map(p=>String(p.membershipCard||'')).filter(v=>/^\d{6,12}$/.test(v)))];if(!cards.length)return players;
 let rows;try{rows=(await db.prepare("SELECT official_id,payload FROM observed_players WHERE circuit='fitp' AND official_id IN (SELECT value FROM json_each(?)) UNION ALL SELECT official_id,payload FROM search_acquired_players WHERE circuit='fitp' AND official_id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(cards),JSON.stringify(cards)).all()).results||[]}catch(e){if(/no such table/i.test(e.message))return players;throw e}
 const metadata=new Map();for(const row of rows){const p=parse(row.payload),old=metadata.get(String(row.official_id))||{};metadata.set(String(row.official_id),{...old,...p,club:p.club||p.raw?.tennis_club_name||old.club||'',ranking:p.fitpRanking||p.ranking||old.ranking||''});}
 return players.map(p=>{const acquired=metadata.get(String(p.membershipCard));if(!acquired)return p;return personalPlayerMetadata({...p,club:acquired.club||p.club},acquired);});
}

export async function personalPlayerAdditions(env,userId,group='main',playerId=''){
 const rows=(await env.DB.prepare(`SELECT a.payload,o.payload AS observed_payload FROM user_app_player_additions a JOIN ${playerMembershipTable(group)} u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id LEFT JOIN observed_players o ON o.source_key=a.observed_source_key WHERE a.user_id=? AND ${playerMembershipGuard(group)}${playerId?' AND a.courtwatch_id=?':''} ORDER BY a.created_at,a.courtwatch_id`).bind(userId,...(playerId?[playerId]:[])).all()).results||[];
 const acquired=rows.filter(row=>String(parse(row.payload).sourceKey||'').startsWith('acquired|')),metadata=new Map();for(let i=0;i<acquired.length;i+=40){const keys=acquired.slice(i,i+40).map(row=>parse(row.payload).sourceKey);try{for(const row of await readD1Rows(env.DB,`SELECT source_key,payload FROM search_acquired_players WHERE source_key IN (${keys.map(()=>'?').join(',')})`,keys))metadata.set(row.source_key,parse(row.payload))}catch(error){if(!/no such table/i.test(error.message))throw error}}
 const identities=await storedIdentities(env.DB,rows.map(row=>{const p=parse(row.payload);return p.sourceKey||p.id}));
 const players=[];
 for(const row of rows){const p=parse(row.payload);
  const player=await hydratePersonalCircuitIdentity(env.DB,personalPlayerMetadata(p,metadata.get(p.sourceKey)||parse(row.observed_payload)),identities.get(p.sourceKey||p.id)||null);
  if(player.id&&player.name)players.push(player);
 }
 return linkedFitpMetadata(env.DB,players);
}
