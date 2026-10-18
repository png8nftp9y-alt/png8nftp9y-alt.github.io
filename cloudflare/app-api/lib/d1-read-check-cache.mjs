// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan is not needed for this fixed-key, guarded checkpoint.
import {createHash,randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
let codeVersion;
export async function readCheckVersion(){
 return codeVersion??=(async()=>{
  const hash=createHash('sha256');
  // A change in check logic or its local dependencies invalidates prior results.
  for(const directory of [new URL('./',import.meta.url),new URL('../scripts/',import.meta.url),new URL('../../../src/v3/',import.meta.url),new URL('../migrations/',import.meta.url)]){
   for(const name of (await readdir(directory)).filter(n=>/\.(mjs|sql)$/.test(n)).sort())hash.update(name).update(await readFile(new URL(name,directory)));
  }
  return hash.digest('hex');
 })();
}
export async function cachedReadCheck(query,name,version,work,{force=false,canCache=()=>true}={}){
 const schema=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_read_check_cache'");
 if(!schema.length)return{value:await work(),reused:false,cacheSaved:false,migrationPending:true};
 const key=sqlString(name),current=(await query(`SELECT state,version,result_json,verified_at FROM d1_read_check_cache WHERE name=${key}`))[0];
 if(!current)throw Error('d1_read_check_migration_required:'+name);
 if(!force&&current.state==='valid'&&current.version===version&&current.result_json!==null){
  return{value:JSON.parse(current.result_json),reused:true,verifiedAt:current.verified_at,cacheSaved:true};
 }
 const rawToken=randomUUID(),token=sqlString(rawToken);
 // Mark running before any source reads. A source change turns running -> dirty,
 // so an interrupted or concurrently modified check cannot publish a valid cache.
 await query(`UPDATE d1_read_check_cache SET state='running',token=${token} WHERE name=${key}`);
 const value=await work();
 if(!canCache(value))return{value,reused:false,cacheSaved:false};
 const resultJson=JSON.stringify(value);
 if(Buffer.byteLength(resultJson,'utf8')>60000)return{value,reused:false,cacheSaved:false};
 const verifiedAt=new Date().toISOString();
 await query(`UPDATE d1_read_check_cache SET state='valid',version=${sqlString(version)},result_json=${sqlString(resultJson)},verified_at=${sqlString(verifiedAt)} WHERE name=${key} AND token=${token} AND state='running'`);
 const saved=(await query(`SELECT state,token FROM d1_read_check_cache WHERE name=${key}`))[0];
 return{value,reused:false,verifiedAt,cacheSaved:saved?.state==='valid'&&saved.token===rawToken};
}
