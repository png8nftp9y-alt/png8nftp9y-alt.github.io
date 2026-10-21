import {createHash} from 'node:crypto';
// Same expression in SQLite and JS. Key ranges never depend on player names.
export const bucketSql=(id='source_player_id')=>`((COALESCE(unicode(substr(${id},-1,1)),0)+17*COALESCE(unicode(substr(${id},-2,1)),0)+31*COALESCE(unicode(substr(${id},-3,1)),0)+43*COALESCE(unicode(substr(${id},-4,1)),0))%128)`;
export function entryBucket(id){const chars=Array.from(String(id)).slice(-4).reverse();return [1,17,31,43].reduce((n,w,i)=>n+w*(chars[i]?.codePointAt(0)||0),0)%128}
export const bucketKey=(circuit,bucket)=>JSON.stringify([circuit,bucket]);
export function desiredBucketHashes(rows){
 const grouped=new Map();
 // A legacy Europe name alias is retained when a native profile of that name
 // exists anywhere in the incoming state. Changes to that evidence invalidate
 // Europe buckets too, even if the native ID is in another bucket.
 const europeNames=[...new Set(rows.filter(r=>r.circuit==='tennis-europe'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.sourcePlayerId)).map(r=>r.normalizedName))].sort();
 for(const row of rows){const key=bucketKey(row.circuit,entryBucket(row.sourcePlayerId));const list=grouped.get(key)||[];list.push(row);grouped.set(key,list)}
 const result=new Map();
 for(const circuit of new Set(rows.map(r=>r.circuit)))for(let bucket=0;bucket<128;bucket++){
  const key=bucketKey(circuit,bucket),items=(grouped.get(key)||[]).sort((a,b)=>a.sourcePlayerId<b.sourcePlayerId?-1:a.sourcePlayerId>b.sourcePlayerId?1:0);
  result.set(key,createHash('sha256').update(JSON.stringify({version:1,rows:items,aliases:circuit==='tennis-europe'?europeNames:[]})).digest('hex'));
 }
 return result;
}
