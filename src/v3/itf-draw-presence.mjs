// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from '../../cloudflare/app-api/lib/d1-incremental-sync.mjs';
// Presence is independent of scores, results, and the list of observed players.
export function itfDrawPresence(doc){
 const people=new Map(),unidentified=[];
 const add=p=>{
  const id=String(p?.id||p?.playerId||''),name=String(p?.name||[p?.givenName,p?.familyName].filter(Boolean).join(' ')).trim();
  if(!id&&!name)return;
  if(!/^800\d{6}$/.test(id)){unidentified.push({id,name});return;}
  if(!people.has(id)||!people.get(id).name)people.set(id,{id,name});
 };
 for(const p of doc.players||[])add(p);
 for(const m of doc.matches||[])for(const t of m.teams||[])for(const p of t.players||[])add(p);
 return {players:[...people.values()].sort((a,b)=>a.id.localeCompare(b.id)),unidentified};
}
export function itfPresenceSQL(doc,row,tournamentId){
 if(row.acquisitionState!=='complete')return [];
 const q=v=>"'"+String(v).replaceAll("'","''")+"'";
 const plan=buildIncrementalSyncPlan({current:[],incoming:itfDrawPresence(doc).players,keyOf:p=>p.id,sourceComplete:true});
 return plan.inserts.map(p=>`INSERT INTO itf_draw_participations(source_player_id,draw_key,content_sha256,tournament_id,display_name) SELECT ${[p.id,row.drawKey,row.sha256,tournamentId,p.name].map(q).join(',')} WHERE EXISTS(SELECT 1 FROM itf_draw_documents WHERE draw_key=${q(row.drawKey)} AND content_sha256=${q(row.sha256)}) ON CONFLICT(source_player_id,draw_key,content_sha256) DO NOTHING;`);
}
