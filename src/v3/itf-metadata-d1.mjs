import crypto from 'node:crypto';
import {buildIncrementalSyncPlan} from '../../cloudflare/app-api/lib/d1-incremental-sync.mjs';
// D1_WRITE_POLICY: incremental; preserve all existing payload fields and unrelated rows.
export const tournamentId=id=>'tournament_itf_'+crypto.createHash('sha256').update('itf|'+id).digest('hex').slice(0,24);
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
export function metadataRows(catalogues,metadata){
 const byId=new Map();
 for(const doc of catalogues){
  if(doc.status!=='itf_global_tournament_map_complete'||!Array.isArray(doc.tournaments)||!doc.tournaments.length)throw Error('ITF metadata catalogue incomplete');
  for(const t of doc.tournaments){const id=String(t.competitionId||'').toUpperCase();if(!/^J-[A-Z0-9]+-[A-Z]{3}-(?:\d{4}-\d{3}|[A-Z0-9]{3}-\d{4})$/.test(id))throw Error('Invalid ITF competition key');byId.set(id,{...(byId.get(id)||{}),...t});}
 }
 return [...byId].sort(([a],[b])=>a.localeCompare(b)).map(([id,t])=>{
  const m=metadata.tournaments?.[id]||{},facts={};
  for(const [k,v]of Object.entries({name:t.tournamentName||t.name,location:t.location,surface:t.surface,environment:t.indoorOutdoor||t.environment,startDate:t.startDate,endDate:t.endDate,officialStartDate:t.officialStartDate||t.startDate,sourceUrl:t.sourceUrl,category:t.category,hostNationCode:t.hostNationCode,venueName:m.venueName||t.venueName,address:m.address||t.address,qualificationStartDate:m.qualificationStartDate||t.qualificationStartDate}))if(nonempty(v))facts[k]=v.trim();
  if(!facts.startDate||!facts.endDate||!facts.sourceUrl)throw Error('ITF tournament missing calendar metadata');
  return {id:tournamentId(id),sourceTournamentId:id,facts};
 });
}
export function metadataPlan(rows,current){
 const byId=new Map(current.map(x=>[x.id,x]));
 const incoming=rows.map(row=>{
  const old=byId.get(row.id);
  if(old&&(old.circuit!=='itf'||old.source_tournament_id!==row.sourceTournamentId))throw Error('ITF tournament identity conflict');
  const previous=old?JSON.parse(old.payload):{};
  const value={...previous,...row.facts,id:row.id,circuit:'itf',sourceTournamentId:row.sourceTournamentId};
  if(!previous.source)value.source={circuit:'itf',sourceId:row.sourceTournamentId,sourceUrl:row.facts.sourceUrl};
  return {id:row.id,circuit:'itf',source_tournament_id:row.sourceTournamentId,start_date:value.startDate,end_date:value.endDate,payload:JSON.stringify(value)};
 });
 const plan=buildIncrementalSyncPlan({current,incoming,keyOf:x=>x.id,sourceComplete:true});
 if(plan.deletes.length)throw Error('ITF metadata sync must not delete records');
 return plan;
}
export function metadataSQL(plan){
 const q=v=>"'"+String(v??'').replaceAll("'","''")+"'";
 const columns=['id','circuit','source_tournament_id','start_date','end_date','payload'];
 return [...plan.inserts.map(r=>`INSERT INTO tournaments(${columns.join(',')}) VALUES(${columns.map(k=>q(r[k])).join(',')}) ON CONFLICT(id) DO NOTHING;`),...plan.updates.map(({before,after})=>`UPDATE tournaments SET start_date=${q(after.start_date)},end_date=${q(after.end_date)},payload=${q(after.payload)} WHERE id=${q(before.id)} AND circuit='itf' AND source_tournament_id=${q(before.source_tournament_id)} AND payload=${q(before.payload)};`)];
}
export function verifyMetadata(rows,stored){
 const byId=new Map(stored.map(x=>[x.id,x]));
 for(const row of rows){const saved=byId.get(row.id);if(!saved||saved.circuit!=='itf'||saved.source_tournament_id!==row.sourceTournamentId)throw Error('ITF metadata D1 identity missing');const data=JSON.parse(saved.payload);for(const [key,value]of Object.entries(row.facts))if(data[key]!==value)throw Error('ITF metadata D1 field mismatch: '+key);}
 return rows.length;
}
