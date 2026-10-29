import {decodeDocument,versionStatements} from './runtime-document-plan.mjs';
// A complete immutable version is already read and verified. Read back again
// only after filling missing chunks; never trust a hash without its contents.
export async function ensureRuntimeDocumentVersion(query,document){
 const read=()=>query('SELECT seq,data FROM runtime_document_chunks WHERE path=? AND content_hash=? ORDER BY seq',[document.path,document.hash]);
 const stored=await read();
 if(stored.some(row=>document.chunks[row.seq]!==row.data))throw Error('Immutable runtime chunk conflict:'+document.path);
 const complete=stored.length===document.chunks.length;
 if(complete){decodeDocument({...document,chunks:document.chunks.length},stored.map(row=>row.data));return false;}
 for(const sql of versionStatements(document,null))await query(sql);
 const checked=await read();
 decodeDocument({...document,chunks:document.chunks.length},checked.map(row=>row.data));
 return true;
}
