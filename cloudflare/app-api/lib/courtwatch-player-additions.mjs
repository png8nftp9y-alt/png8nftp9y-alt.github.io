import {personalPlayerMetadata,officialFitpClub} from './personal-player-metadata.mjs';
// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';

const nameKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase().split(' ').sort().join(' ');
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const parse=value=>{try{return JSON.parse(value||'{}')}catch{return{}}};

export async function addCourtWatchPlayer(env,user,body,{fetchClub=officialFitpClub}={}){
 const sourceKey=String(body?.sourceKey||'').trim(),courtwatchId=String(body?.courtwatchId||'').trim(),identity=String(body?.identity||'').trim(),name=String(body?.name||'').trim();
 if((!sourceKey&&!courtwatchId&&!identity)||sourceKey.length>240||courtwatchId.length>160||identity.length>160||name.length>160)throw failure('invalid_player');
 let player,observedSourceKey;
 if(courtwatchId&&!sourceKey){
  const row=await env.DB.prepare('SELECT id,payload FROM app_players WHERE id=?').bind(courtwatchId).first();
  if(!row)throw failure('player_not_found',404);
  player={...parse(row.payload),id:row.id,userAdded:true};observedSourceKey='courtwatch|'+row.id;
 }else{
  const sourceTable=(sourceKey||identity).startsWith('acquired|')?'search_acquired_players':'observed_players';
  let rows=(await env.DB.prepare(`SELECT source_key,circuit,official_id,display_name,payload FROM ${sourceTable} WHERE source_key=? OR official_id=? LIMIT 20`).bind(sourceKey||identity,sourceKey?'':identity).all()).results||[];
  if(!rows.length&&!sourceKey&&identity){try{rows=(await env.DB.prepare('SELECT source_key,circuit,official_id,display_name,payload FROM search_acquired_players WHERE source_key=? OR official_id=? LIMIT 20').bind(identity,identity).all()).results||[]}catch(error){if(!/no such table/i.test(error.message))throw error}}
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
 player=personalPlayerMetadata(player);
 const [previous,linked,removed]=await Promise.all([
  env.DB.prepare('SELECT courtwatch_id,observed_source_key,payload FROM user_app_player_additions WHERE user_id=? AND observed_source_key=?').bind(user.id,observedSourceKey).first(),
  env.DB.prepare('SELECT courtwatch_id FROM user_app_players WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id).first(),
  env.DB.prepare('SELECT courtwatch_id FROM user_app_player_removals WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id).first()
 ]);
 if(previous&&previous.courtwatch_id!==player.id)throw failure('player_identity_conflict',409);
 if(!player.club&&previous)player.club=personalPlayerMetadata(parse(previous.payload)).club||'';
 if(player.membershipCard&&!player.club){
  try{player.club=await fetchClub(player.membershipCard)}catch{throw failure('player_club_unavailable',503)}
  if(!player.club)throw failure('player_club_unavailable',503);
 }
 player=personalPlayerMetadata(player);
 const incoming={courtwatch_id:player.id,observed_source_key:observedSourceKey,payload:JSON.stringify(player)};
 const plan=buildIncrementalSyncPlan({current:previous?[previous]:[],incoming:[incoming],keyOf:row=>row.courtwatch_id,sourceComplete:Boolean(player.id&&player.name)});
 const now=new Date().toISOString(),statements=[];
 if(plan.inserts.length||plan.updates.length)statements.push(env.DB.prepare('INSERT INTO user_app_player_additions(user_id,courtwatch_id,observed_source_key,payload,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,courtwatch_id) DO UPDATE SET payload=excluded.payload WHERE user_app_player_additions.payload<>excluded.payload').bind(user.id,player.id,observedSourceKey,incoming.payload,now));
 if(!linked)statements.push(env.DB.prepare('INSERT INTO user_app_players(user_id,courtwatch_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,courtwatch_id) DO NOTHING').bind(user.id,player.id,now));
 if(removed)statements.push(env.DB.prepare('DELETE FROM user_app_player_removals WHERE user_id=? AND courtwatch_id=?').bind(user.id,player.id));
 if(statements.length)await env.DB.batch(statements);
 return{added:true,playerId:player.id,player,changed:statements.length>0};
}

export async function personalPlayerAdditions(env,userId){
 const rows=(await env.DB.prepare('SELECT a.payload,o.payload AS observed_payload FROM user_app_player_additions a JOIN user_app_players u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id LEFT JOIN observed_players o ON o.source_key=a.observed_source_key WHERE a.user_id=? AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=a.user_id AND r.courtwatch_id=a.courtwatch_id) ORDER BY a.created_at,a.courtwatch_id').bind(userId).all()).results||[];
 const acquired=rows.filter(row=>String(parse(row.payload).sourceKey||'').startsWith('acquired|')),metadata=new Map();for(let i=0;i<acquired.length;i+=40){const keys=acquired.slice(i,i+40).map(row=>parse(row.payload).sourceKey);try{for(const row of (await env.DB.prepare(`SELECT source_key,payload FROM search_acquired_players WHERE source_key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all()).results||[])metadata.set(row.source_key,parse(row.payload))}catch(error){if(!/no such table/i.test(error.message))throw error}}
 return rows.map(row=>{const p=parse(row.payload);return personalPlayerMetadata(p,metadata.get(p.sourceKey)||parse(row.observed_payload))}).filter(player=>player.id&&player.name);
}
