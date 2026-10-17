// D1_WRITE_POLICY: incremental
// Uses the common buildIncrementalSyncPlan contract for the single release pointer.
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
export const RUNTIME_DOCUMENT_FILES=[
 ...['players','tournaments','matches','agenda','results','opponents','tournament_entries','sync_status','diagnostics','manual_matches',
 'source_itf_history_tournaments','source_itf_tournaments','source_fitp_tournaments','source_tennis_europe_tournaments_sharded',
 'itf_system_diagnostics','source_itf_entries','tennis_europe_system_diagnostics','source_fitp_entries','itf_t1_queue_status','itf_metadata_queue_status','itf_tournament_metadata_diagnostics','operational_status'].map(n=>'dist/v3/'+n+'.json'),
 'history/itf_official_metadata.json'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export function encodeDocument(path,document){
 if(!RUNTIME_DOCUMENT_FILES.includes(path)||!document||typeof document!=='object'||Array.isArray(document))throw Error('runtime_document_invalid:'+path);
 const arrayKey=path.endsWith('/players.json')?'players':/source_.*tournaments|\/tournaments\.json$/.test(path)?'tournaments':null;
 if(arrayKey&&(!Array.isArray(document[arrayKey])||!document[arrayKey].length))throw Error('runtime_document_source_incomplete:'+path);
 if(/source_.*tournaments/.test(path)&&(!String(document.status||'').endsWith('_complete')||document.errors?.length))throw Error('runtime_catalogue_incomplete:'+path);
 const json=JSON.stringify(document),contentHash=hash(json),encoded=gzipSync(Buffer.from(json),{mtime:0}).toString('base64'),chunks=[];
 for(let i=0;i<encoded.length;i+=48000)chunks.push(encoded.slice(i,i+48000));
 return {path,hash:contentHash,bytes:Buffer.byteLength(json),chunks};
}
export function decodeDocument(record,chunks){
 if(chunks.length!==record.chunks)throw Error('runtime_document_chunks_missing:'+record.path);
 const json=gunzipSync(Buffer.from(chunks.join(''),'base64')).toString('utf8');
 if(hash(json)!==record.hash||Buffer.byteLength(json)!==record.bytes)throw Error('runtime_document_content_mismatch:'+record.path);
 return JSON.parse(json);
}
export function versionStatements(document,existing){
 if(existing){decodeDocument({...document,chunks:document.chunks.length},existing);return [];}
 return document.chunks.map((data,seq)=>`INSERT INTO runtime_document_chunks(path,content_hash,seq,data) VALUES(${quote(document.path)},${quote(document.hash)},${seq},${quote(data)}) ON CONFLICT(path,content_hash,seq) DO NOTHING;`);
}
export function releasePlan(documents,sourceCommit,previous=null){
 if(documents.length!==RUNTIME_DOCUMENT_FILES.length||new Set(documents.map(d=>d.path)).size!==RUNTIME_DOCUMENT_FILES.length||RUNTIME_DOCUMENT_FILES.some(p=>!documents.some(d=>d.path===p)))throw Error('runtime_document_scope_incomplete');
 const manifest=documents.map(d=>({path:d.path,hash:d.hash,bytes:d.bytes,chunks:d.chunks.length})).sort((a,b)=>a.path.localeCompare(b.path));
 const fingerprint=hash(JSON.stringify(manifest));
 const old=previous?JSON.parse(previous):null;
 if(old?.fingerprint===fingerprint)return {changed:false,manifest,previous,sql:[]};
 const value=JSON.stringify({version:1,sourceCommit,fingerprint,documents:manifest,verifiedAt:new Date().toISOString()});
 const plan=buildIncrementalSyncPlan({current:previous?[{key:'runtimeDocumentRelease',value:previous}]:[],incoming:[{key:'runtimeDocumentRelease',value}],keyOf:x=>x.key,sourceComplete:true});
 const sql=plan.inserts.length?[`INSERT INTO app_state(key,value) VALUES('runtimeDocumentRelease',${quote(value)}) ON CONFLICT(key) DO NOTHING;`]:[`UPDATE app_state SET value=${quote(value)} WHERE key='runtimeDocumentRelease' AND value=${quote(previous)};`];
 return {changed:true,manifest,value,previous,sql};
}
