// D1_READ_ONLY: guarded
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {runtimeDocumentReader} from '../lib/runtime-document-reader.mjs';
import {storedPresentationLoaders} from '../lib/personal-tournament-presentation.mjs';
import worker from '../src/index.js';
import {verifyRuntimeAppReaders} from '../lib/verify-runtime-app-readers.mjs';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const original=globalThis.fetch,requests=[];
globalThis.fetch=(url,options)=>{const host=new URL(typeof url==='string'?url:url.url).hostname;requests.push(host);if(host!=='api.cloudflare.com')throw Error('external_runtime_request_forbidden:'+host);return original(url,options);};
try{
 const client=await openReadOnlyD1(),reader=runtimeDocumentReader(client.db),release=await reader.release();
 let verified=0;for(const document of release.documents){await reader.get(document.path);verified++;}
 const metadata=storedPresentationLoaders(reader),counts={};for(const c of ['fitp','tennis-europe','itf'])counts[c]=(await metadata[c]()).size;
 const users=await client.query("SELECT email FROM app_users WHERE status='active' ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,id LIMIT 1");
 if(!users.length)throw Error('runtime_check_no_active_user');
 const appReaders=await verifyRuntimeAppReaders(worker,client.db,users[0].email);
 const report={status:'verified',sourceCommit:release.sourceCommit,verifiedDocuments:verified,metadataRows:counts,authenticatedDocumentRoute:appReaders.documentRoutes['players.json'],...appReaders,externalDataRequests:requests.filter(h=>h!=='api.cloudflare.com').length,writes:0};
 const folder=fileURLToPath(new URL('../../../dist/v3/audits/',import.meta.url));await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'runtime-d1-read-path.json',JSON.stringify(report,null,2)+'\n');console.log('RUNTIME_D1_READ_PATH='+JSON.stringify(report));
}finally{globalThis.fetch=original;}
