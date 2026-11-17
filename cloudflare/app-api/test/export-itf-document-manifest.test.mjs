import test from 'node:test';import assert from 'node:assert/strict';
import {exportItfDocumentManifest} from '../scripts/export-itf-document-manifest.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
// D1_TEST_READ_ONLY_TRANSPORT / D1_TEST_MUTATIONS_REJECTED
test('manifest uses guarded SELECT transport only; mutations cannot reach the network',async()=>{
 process.env.CLOUDFLARE_ACCOUNT_ID='fixture';process.env.CLOUDFLARE_API_TOKEN='fixture';
 const bodies=[];
 try{
 const manifest=await exportItfDocumentManifest({databaseId:'12345678-1234-1234-1234-123456789abc',fetcher:async(url,init)=>{bodies.push(JSON.parse(init.body));return new Response(JSON.stringify({success:true,result:[{success:true,results:[]}]}))}});
 assert.equal(manifest.documents.length,0);assert.equal(bodies.length,2);assert.ok(bodies.every(b=>/^SELECT /.test(b.sql)));
 let calls=0;const client=createReadOnlyD1Client(async()=>{calls++;return []});
 for(const sql of ['DELETE FROM itf_draw_documents','UPDATE tournaments SET id=1','INSERT INTO tournaments VALUES(1)'])await assert.rejects(client.query(sql));
 assert.equal(calls,0);
 }finally{delete process.env.CLOUDFLARE_ACCOUNT_ID;delete process.env.CLOUDFLARE_API_TOKEN}
});
