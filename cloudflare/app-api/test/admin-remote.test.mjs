import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminRemote } from '../lib/admin-remote.mjs';
const primaryBase='https://raw.example/data',fallbackBase='https://pages.example/data';
const now=Date.parse('2026-10-03T21:40:00Z');
const operational={generatedAt:new Date(now).toISOString(),items:[{latestRun:{id:123,path:'.github/workflows/courtwatch-v3-itf-t-minus-one.yml',status:'completed',conclusion:'success'}}],runs:[],runsError:null};
const document=url=>url.endsWith('/operational_status.json')?operational:{generatedAt:new Date(now).toISOString()};
test('published CI statuses supply workflow rows without calling the GitHub API',async()=>{
  const urls=[];
  const result=await loadAdminRemote({primaryBase,fallbackBase,now,fetcher:async url=>{urls.push(url);return Response.json(document(url));}});
  assert.equal(result.errors,0);assert.equal(result.itfT1Runs[0].id,123);
  assert.equal(result.workflowStatusAvailable,true);assert.equal(urls.length,8);
  assert.ok(urls.every(url=>url.startsWith(primaryBase)));
});
test('raw source outage falls back to Pages with real workflow and queue data',async()=>{
  const result=await loadAdminRemote({primaryBase,fallbackBase,now,fetcher:async url=>url.startsWith(primaryBase)?new Response('',{status:503}):Response.json(document(url))});
  assert.equal(result.errors,0);assert.equal(result.itfT1Runs[0].id,123);
  assert.ok(result.docs['itf_t1_queue_status.json']);
});
test('cached fallback is marked stale rather than hidden as a fresh read',async()=>{
  const cache={match:async()=>new Response(JSON.stringify({generatedAt:'old'}),{headers:{'X-CourtWatch-Cached-At':new Date(now-600000).toISOString()}})};
  const result=await loadAdminRemote({primaryBase,fallbackBase,now,cache,fetcher:async()=>new Response('',{status:503})});
  assert.equal(result.stale.length,8);assert.equal(result.workflowStatusAvailable,false);
});
test('unavailable sources remain individually named; missing history is not success',async()=>{
  const result=await loadAdminRemote({primaryBase,fallbackBase,now,fetcher:async()=>new Response('',{status:404})});
  assert.equal(result.errors,8);assert.equal(result.workflowStatusAvailable,false);
  assert.ok(result.failures.some(x=>x.file==='itf_t1_queue_status.json'&&x.error.includes('404')));
});
test('queue ignores a warm cache and reads current counters',async()=>{
  let queueCalls=0;
  const cache={match:async()=>new Response(JSON.stringify({old:true}),{headers:{'X-CourtWatch-Cached-At':new Date(now-1000).toISOString()}})};
  const result=await loadAdminRemote({primaryBase,fallbackBase,cache,now,fetcher:async url=>{if(url.endsWith('itf_t1_queue_status.json'))queueCalls++;return Response.json({coverage:{extraordinaryA:{total:18}}});}});
  assert.equal(queueCalls,1);assert.equal(result.docs['itf_t1_queue_status.json'].coverage.extraordinaryA.total,18);
});
