// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import crypto from 'node:crypto';
import {normalizePlayerName,playerNameKey,officialPlayerUrl} from './player-circuit-profiles.mjs';
import {playerSourceMetadata} from './personal-player-metadata.mjs';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,24);
export function acquiredPlayer(circuit,source={}){
 const name=String(source.name||source.display_name||source.playerName||[source.firstName,source.lastName].filter(Boolean).join(' ')).trim();if(!normalizePlayerName(name))return null;
 const metadata=playerSourceMetadata(source),rawId=String(source.worldTennisId||source.membershipCard||source.profileId||source.source_player_id||source.id||''),officialId=circuit==='tennis-europe'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(rawId)?rawId:circuit==='itf'&&/^800\d{6}$/.test(rawId)?rawId:circuit==='fitp'&&source.membershipCard?String(source.membershipCard):'';
 const identity=officialId?'id:'+officialId:'name:'+hash(playerNameKey(name)+'|'+String(metadata.nationality||'').toUpperCase()+'|'+(metadata.birthYear||''));
 const sourceKey='acquired|'+circuit+'|'+identity;
 const payload={...metadata,displayName:name,officialId,circuit,profileUrl:officialPlayerUrl(circuit,{...source,...metadata,name,officialId})};
 return{sourceKey,circuit,officialId,normalizedName:normalizePlayerName(name),displayName:name,payload};
}
export function documentPlayers(doc){return[...(doc.players||[]),...(doc.matches||[]).flatMap(m=>(m.teams||[]).flatMap(t=>t.players||[]))]}
export const searchPlayerSql=row=>{
 const q=v=>`'${String(v??'').replaceAll("'","''")}'`,payload=JSON.stringify(row.payload);
 return `INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(${[row.sourceKey,row.circuit,row.officialId,row.normalizedName,row.displayName,payload].map(q).join(',')}) ON CONFLICT(source_key) DO UPDATE SET payload=excluded.payload,display_name=excluded.display_name,normalized_name=excluded.normalized_name WHERE payload IS NOT excluded.payload OR display_name IS NOT excluded.display_name OR normalized_name IS NOT excluded.normalized_name;`;
};
export function acquiredSearchPlan(current,incoming,{sourceComplete=true}={}) {
 const previous=new Map(current.map(r=>[r.source_key,{sourceKey:r.source_key,circuit:r.circuit,officialId:r.official_id||'',normalizedName:r.normalized_name,displayName:r.display_name,payload:JSON.parse(r.payload)}])),merged=new Map();
 for(const row of incoming.filter(Boolean)){const old=merged.get(row.sourceKey)||previous.get(row.sourceKey),payload=old?{...old.payload,...Object.fromEntries(Object.entries(row.payload).filter(([,v])=>v!==''&&v!=null))}:row.payload;merged.set(row.sourceKey,{...row,payload});}
 return buildIncrementalSyncPlan({current:[...previous.values()],incoming:[...previous.values()].map(r=>merged.get(r.sourceKey)||r).concat([...merged.values()].filter(r=>!previous.has(r.sourceKey))),keyOf:r=>r.sourceKey,sourceComplete});
}
