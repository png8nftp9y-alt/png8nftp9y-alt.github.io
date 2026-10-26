import test from 'node:test';
import assert from 'node:assert/strict';
import {savedAdminPage,prepareSavedIdPage} from '../lib/admin-saved-page.mjs';
import worker from '../src/index.js';

function setup(view){
 const values=new Map();let builds=0,writes=0;
 const env={ADMIN_TOKEN:'test-only',ARCHIVE:{async get(key){return values.has(key)?{json:async()=>JSON.parse(values.get(key))}:null},async put(key,value){writes++;values.set(key,value)}}};
 const render=async()=>{builds++;return '<html><nav></nav><div class="admin-page page-'+view+'">revision '+builds+'</div></html>'};
 const request=flag=>new Request('https://'+view+'.test/admin/'+view+(flag?'?'+flag+'=1':''));
 return{env,values,render,request,builds:()=>builds,writes:()=>writes};
}
for(const [view,flag] of [['id','refreshIds'],['diagnostica','refreshDiagnostics']]){
 test(view+' retains the last saved version until explicit refresh, without age-based recalculation',async()=>{
  const d=setup(view);const first=await savedAdminPage(d.request(flag),d.env,view,d.render);
  assert.equal(d.builds(),1);assert.equal(d.writes(),1);
  const key='monitoring/admin-pages/'+view+'/current.json',value=JSON.parse(d.values.get(key));value.checkedAt='2000-01-01T00:00:00Z';d.values.set(key,JSON.stringify(value));
  assert.equal(await savedAdminPage(d.request(),d.env,view,d.render),first);assert.equal(d.builds(),1);
  const updated=await savedAdminPage(d.request(flag),d.env,view,d.render);assert.match(updated,/revision 2/);
  assert.equal(d.builds(),2);assert.equal(d.writes(),2);
  assert.equal(await savedAdminPage(d.request(),d.env,view,d.render),updated);
 });
}
test('background preparation never rebuilds counts when no saved reading exists',async()=>{
 const d=setup('id');let reads=0;const get=d.env.ARCHIVE.get;d.env.ARCHIVE.get=async key=>{reads++;return get(key)};
 await Promise.all([prepareSavedIdPage(d.request(),d.env,d.render),prepareSavedIdPage(d.request(),d.env,d.render)]);
 await prepareSavedIdPage(d.request(),d.env,async()=>{throw Error('must not recalculate')});
 assert.equal(d.builds(),0);assert.equal(d.writes(),0);
 assert.equal(reads,1);
});
test('failed ID refresh preserves the valid saved snapshot',async()=>{
 const d=setup('id');const first=await savedAdminPage(d.request('refreshIds'),d.env,'id',d.render);
 await savedAdminPage(d.request('refreshIds'),d.env,'id',async()=>'<html><nav></nav><div class="admin-page page-id">Conteggi ID non disponibili</div></html>');
 assert.equal(d.writes(),1);assert.equal(await savedAdminPage(d.request(),d.env,'id',d.render),first);
});
test('saved Admin opens before blocked D1 reads; authentication and no-store remain enforced',async()=>{
 for(const [view,flag] of [['id','refreshIds'],['diagnostica','refreshDiagnostics']]){
 const d=setup(view);await savedAdminPage(d.request(flag),d.env,view,d.render);
 let dbReads=0;d.env.DB={prepare(){dbReads++;throw Error('must not wait for D1')}};
 assert.equal((await worker.fetch(d.request(),d.env)).status,401);assert.equal(dbReads,0);
 const response=await worker.fetch(new Request(d.request().url,{headers:{Authorization:'Basic '+btoa('admin:test-only')}}),d.env);
 const html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.match(html,/revision 1/);if(view==='id')assert.match(html,/panels.js/);else assert.doesNotMatch(html,/panels.js|currentPanels=1/);assert.equal(dbReads,0);assert.equal(d.builds(),1);assert.equal(d.writes(),1);
 }
});
test('missing saved page offers explicit calculation instead of a heavy automatic rebuild',async()=>{
 const d=setup('id');const html=await savedAdminPage(d.request(),d.env,'id',d.render);assert.match(html,/Nessuna lettura/);assert.match(html,/refreshIds/);assert.equal(d.builds(),0);assert.equal(d.writes(),0);
});

import './admin-current-panels.test.mjs';
