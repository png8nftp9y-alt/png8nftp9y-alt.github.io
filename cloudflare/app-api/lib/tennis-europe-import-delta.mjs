// D1_WRITE_POLICY: incremental; verified fingerprints filter existing atomic batches.
import {createHash} from 'node:crypto';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {statements} from '../scripts/import-tennis-europe-query.mjs';
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const prefix='te-import-receipt-v1:';
const lit="('(?:''|[^'])*')",unquote=s=>s.slice(1,-1).replaceAll("''","'"),esc=s=>"'"+s.replaceAll("'","''")+"'";
const reset='DELETE FROM tennis_europe_changed_matches;';
const cleanup=['app_match_candidates','match_participants','results','schedules'].map(t=>`DELETE FROM ${t} WHERE match_id IN (SELECT id FROM tennis_europe_changed_matches);`);
const guard=new RegExp('SELECT '+lit+' WHERE NOT EXISTS \\(SELECT 1 FROM matches WHERE id='+lit+' AND tournament_id='+lit+" AND circuit='tennis-europe' AND played_date IS "+lit+' AND payload='+lit+'(.*)\\);$','s');
const link=new RegExp('WHERE EXISTS \\(SELECT 1 FROM tennis_europe_changed_matches WHERE id='+lit+'\\)');
const pk={tournaments:'id',tennis_europe_players:'identity_key',app_state:'key'};
function rowUnit(s){
 const m=s.match(/^INSERT INTO (tournaments|tennis_europe_players|app_state)\(([^)]+)\) VALUES\((.*)\) ON CONFLICT\(/s);
 if(!m)throw Error('TE_DELTA_ROW_UNSUPPORTED');
 const cols=m[2].split(','),parts=m[3].match(/'(?:''|[^'])*'|[^,']+/gs)?.map(x=>x.trim());
 if(!parts||cols.length!==parts.length||cols.some(c=>!/^[a-z_]+$/.test(c)))throw Error('TE_DELTA_ROW_COLUMNS');
 const row={};for(const [i,c]of cols.entries()){if(c==='updated_at')continue;const v=parts[i];if(v.startsWith("'"))row[c]=unquote(v);else if(v==='NULL')row[c]=null;else if(/^-?\d+$/.test(v))row[c]=Number(v);else throw Error('TE_DELTA_ROW_VALUE');}
 if(typeof row[pk[m[1]]]!=='string')throw Error('TE_DELTA_ROW_KEY');
 return {key:digest(m[1]+'|'+row[pk[m[1]]]),fingerprint:digest(s),kind:'row',sql:[s],table:m[1],row};
}
export function sourceUnits(files){
 const out=[];
 for(const [name,text]of Object.entries(files).sort(([a],[b])=>a.localeCompare(b))){
  const sql=statements(text).map(s=>s.trim()).filter(s=>s!=='PRAGMA foreign_keys=ON;');if(!sql.length)continue;
  if(/^03-matches-/.test(name)){
   const matches=new Map();
   for(const s of sql){if(s===reset||cleanup.includes(s))continue;
    if(s.startsWith('INSERT OR IGNORE INTO tennis_europe_changed_matches(id) SELECT ')){
     const m=s.match(guard),tail=m?.[6],count=tail?.match(/COUNT\(\*\) FROM match_participants WHERE match_id=.*\)=(\d+)/s);
     if(!m||m[1]!==m[2]||!count)throw Error('TE_DELTA_MATCH_GUARD');
     const id=unquote(m[1]);if(matches.has(id))throw Error('TE_DELTA_DUPLICATE_MATCH');
     matches.set(id,{key:digest('match|'+id),kind:'match',sql:[s],row:{id,tournament:unquote(m[3]),date:unquote(m[4]),payload:unquote(m[5]),schedule:!tail.includes('NOT EXISTS (SELECT 1 FROM schedules'),result:tail.includes('EXISTS (SELECT 1 FROM results'),participants:Number(count[1])}});
    }else{const m=s.match(link),unit=m&&matches.get(unquote(m[1]));if(!unit)throw Error('TE_DELTA_ORPHAN_WRITE');unit.sql.push(s)}
   }
   for(const u of matches.values()){if(u.sql.length<2)throw Error('TE_DELTA_MATCH_WRITE');u.fingerprint=digest(u.sql.join('\n'));out.push(u)}
  }else if(/^(01-tournaments-|02-players-|06-draw-walkover-audit-|07-agenda-advancements)/.test(name))out.push(...sql.map(rowUnit));
  else if(/^0[45]-app-match/.test(name))out.push({key:digest('file|'+name),fingerprint:digest(sql.join('\n')),kind:'projection',name,sql});
  else throw Error('TE_DELTA_UNKNOWN_FILE: '+name);
 }
 if(new Set(out.map(u=>u.key)).size!==out.length)throw Error('TE_DELTA_DUPLICATE_UNIT');return out;
}
export function decodeReceipts(rows){const map=new Map();for(const {key,value}of rows){
 if(!key.startsWith(prefix)||!/^[a-f0-9]{2}$/.test(key.slice(prefix.length)))throw Error('TE_DELTA_RECEIPT_KEY');
 const entries=JSON.parse(value);if(!entries||Array.isArray(entries)||typeof entries!=='object')throw Error('TE_DELTA_RECEIPT');
 for(const [id,f]of Object.entries(entries)){if(!/^[a-f0-9]{64}$/.test(id)||typeof f!=='string'||!/^[a-f0-9]{64}$/.test(f)||!key.endsWith(id.slice(0,2))||map.has(id))throw Error('TE_DELTA_RECEIPT');map.set(id,f)}
}return map;}
function chunks(items,count,bytes,encode=JSON.stringify){const out=[];let list=[],size=0;for(const item of items){const n=Buffer.byteLength(encode(item))+1;if(n>bytes)throw Error('TE_DELTA_UNIT_TOO_LARGE');if(list.length&&(list.length>=count||size+n>bytes)){out.push(list);list=[];size=0}list.push(item);size+=n}if(list.length)out.push(list);return out;}
const matchProbe=`WITH wanted AS (SELECT value AS e FROM json_each(?)) SELECT json_extract(e,'$.key') AS key FROM wanted WHERE NOT EXISTS (
 SELECT 1 FROM matches m WHERE m.id=json_extract(e,'$.row.id') AND m.circuit='tennis-europe' AND m.tournament_id IS json_extract(e,'$.row.tournament') AND m.played_date IS json_extract(e,'$.row.date') AND m.payload IS json_extract(e,'$.row.payload')
 AND (CASE WHEN json_extract(e,'$.row.schedule') THEN EXISTS(SELECT 1 FROM schedules WHERE id='oop:'||m.id) ELSE NOT EXISTS(SELECT 1 FROM schedules WHERE id='oop:'||m.id) END)
 AND (NOT json_extract(e,'$.row.result') OR EXISTS(SELECT 1 FROM results WHERE id='result:'||m.id))
 AND (SELECT COUNT(*) FROM match_participants WHERE match_id=m.id)=json_extract(e,'$.row.participants'))`;
export async function planDelta(units,verified,query,{fullCheck=false}={}){
 const selected=new Set(),groups=new Map();let checked=0;
 const incoming=units.map(({key,fingerprint})=>({key,fingerprint})),keys=new Set(incoming.map(x=>x.key));
 const current=[...verified].filter(([key])=>keys.has(key)).map(([key,fingerprint])=>({key,fingerprint}));
 const delta=buildIncrementalSyncPlan({current,incoming,keyOf:x=>x.key,sourceComplete:units.length>0});
 const modified=new Set(delta.updates.map(({after})=>after.key)),unverified=new Set(delta.inserts.map(x=>x.key));
 for(const u of units){if(modified.has(u.key)){selected.add(u.key);continue;}if(!unverified.has(u.key)&&!fullCheck)continue;
  if(u.kind==='projection'){selected.add(u.key);continue;}
  const signature=u.kind==='match'?'match':JSON.stringify([u.table,Object.keys(u.row)]),group=groups.get(signature)||[];group.push({key:u.key,row:u.row});groups.set(signature,group);
 }
 for(const [signature,items]of groups){let sql=matchProbe;
  if(signature!=='match'){const [table,columns]=JSON.parse(signature);sql=`WITH wanted AS (SELECT value AS e FROM json_each(?)) SELECT json_extract(e,'$.key') AS key FROM wanted WHERE NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.${pk[table]} IS json_extract(e,'$.row.${pk[table]}') AND ${columns.map(c=>`t.${c} IS json_extract(e,'$.row.${c}')`).join(' AND ')})`;}
  for(const batch of chunks(items,150,450000)){
   const rows=await query(sql,[JSON.stringify(batch)]),keys=new Set(batch.map(x=>x.key));
   if(!Array.isArray(rows)||rows.some(r=>!keys.has(r.key)))throw Error('TE_DELTA_INVALID_PROBE');
   checked+=batch.length;for(const r of rows)selected.add(r.key);
  }
 }
 const matches=units.filter(u=>u.kind==='match'&&selected.has(u.key));
 if(matches.length)for(const u of units)if(u.name==='04-app-match-candidates.sql')selected.add(u.key);
 const files={},write=(name,sql)=>{files[name]=['PRAGMA foreign_keys=ON;',...sql].join('\n')+'\n';};
 chunks(units.filter(u=>u.kind==='row'&&selected.has(u.key)).flatMap(u=>u.sql),100,500000,s=>s).forEach((s,i)=>write('01-delta-'+String(i).padStart(5,'0')+'.sql',s));
 chunks(matches,25,1_000_000,u=>u.sql.join('\n')).forEach((items,i)=>write('03-delta-'+String(i).padStart(5,'0')+'.sql',[
  reset,...items.map(u=>`INSERT OR IGNORE INTO tennis_europe_changed_matches(id) VALUES(${esc(u.row.id)});`),...cleanup,...items.flatMap(u=>u.sql.slice(1))
 ]));
 for(const u of units)if(u.kind==='projection'&&selected.has(u.key))write(u.name,u.sql);
 const invalidated=new Map(verified),next=new Map(verified);for(const key of selected)invalidated.delete(key);for(const u of units)next.set(u.key,u.fingerprint);
 return {files,invalidated,next,stats:{sourceUnits:units.length,comparedD1:checked,selectedUnits:selected.size,selectedMatches:matches.length,importFiles:Object.keys(files).length,fullCheck}};
}
function buckets(receipts){const rows=new Map();for(const [id,f]of [...receipts].sort(([a],[b])=>a.localeCompare(b))){const key=prefix+id.slice(0,2),bucket=rows.get(key)||{};bucket[id]=f;rows.set(key,bucket)}return rows;}
export function receiptFiles(old,next){const before=buckets(old),after=buckets(next),sql=[];
 for(const key of new Set([...before.keys(),...after.keys()])){const oldValue=JSON.stringify(before.get(key)||{}),value=JSON.stringify(after.get(key)||{});if(value===oldValue)continue;
  const s=`INSERT INTO app_state(key,value,updated_at) VALUES(${esc(key)},${esc(value)},CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE app_state.value IS NOT excluded.value;`;
  if(Buffer.byteLength(s)>95000)throw Error('TE_DELTA_RECEIPT_TOO_LARGE');sql.push(s);
 }
 return Object.fromEntries(chunks(sql,30,500000,s=>s).map((rows,i)=>['receipt-'+String(i).padStart(4,'0')+'.sql',rows.join('\n')+'\n']));
}
