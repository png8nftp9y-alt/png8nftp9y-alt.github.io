import {createHash} from 'node:crypto';
export const quote=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function publication(category,date,items,total,capturedAt){
 if(!['B','G'].includes(category)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(total)||total<1||items.length!==total)throw Error('incomplete_publication');
 const seen=new Set();
 const rows=items.map(p=>{
  if(!/^800\d{6}$/.test(String(p.playerId))||seen.has(String(p.playerId))||!Number.isInteger(p.rank)||p.rank<1||!Number.isFinite(p.points))throw Error('invalid_or_duplicate_ranking');
  seen.add(String(p.playerId));
  return {playerId:Number(p.playerId),rank:p.rank,points:p.points,playerGivenName:String(p.playerGivenName||''),playerFamilyName:String(p.playerFamilyName||''),playerNationalityCode:String(p.playerNationalityCode||''),gender:String(p.gender||'')};
 }).sort((a,b)=>a.playerId-b.playerId);
 // Same canonical content hash used by the app archive.
 const normalized=rows.map(p=>[category,date,String(p.playerId),p.rank,p.points,[p.playerGivenName,p.playerFamilyName].filter(Boolean).join(' '),p.playerNationalityCode,p.gender]);
 const hash=digest(JSON.stringify(normalized)),key=`category=${quote(category)} AND ranking_date=${quote(date)} AND content_hash=${quote(hash)}`;
 const statements=[`INSERT INTO itf_junior_ranking_publications VALUES (${[category,date,total,hash,capturedAt,0].map(quote).join(',')}) ON CONFLICT DO NOTHING;`];
 for(const row of normalized)statements.push(`INSERT INTO itf_junior_ranking_history SELECT ${[...row.slice(0,2),hash,...row.slice(2)].map(quote).join(',')} WHERE EXISTS(SELECT 1 FROM itf_junior_ranking_publications WHERE ${key} AND complete=0) ON CONFLICT DO NOTHING;`);
 statements.push(`UPDATE itf_junior_ranking_publications SET complete=1 WHERE ${key} AND complete=0 AND expected_count=(SELECT COUNT(*) FROM itf_junior_ranking_history WHERE ${key});`);
 return {category,rankingDate:date,total,items:rows,contentHash:hash,statements,key};
}
export function snapshotChunks(text,size=24000){
 const characters=Array.from(text),chunks=[];
 for(let offset=0;offset<characters.length;offset+=size)chunks.push(characters.slice(offset,offset+size).join(''));
 return chunks;
}
export function sqlBatches(statements,maxBytes=1000000,maxStatements=400){
 const batches=[];let batch=[],size=0;
 for(const statement of statements){
  const bytes=Buffer.byteLength(statement+'\n');if(bytes>maxBytes)throw Error('SQL statement exceeds safe D1 size');
  if(batch.length&&(size+bytes>maxBytes||batch.length>=maxStatements)){batches.push(batch);batch=[];size=0;}
  batch.push(statement);size+=bytes;
 }
 if(batch.length)batches.push(batch);return batches;
}
