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
  const d=setup(view);const first=await savedAdminPage(d.request(),d.env,view,d.render);
  assert.equal(d.builds(),1);assert.equal(d.writes(),1);
  const key='monitoring/admin-pages/'+view+'/current.json',value=JSON.parse(d.values.get(key));value.checkedAt='2000-01-01T00:00:00Z';d.values.set(key,JSON.stringify(value));
  assert.equal(await savedAdminPage(d.request(),d.env,view,d.render),first);assert.equal(d.builds(),1);
  const updated=await savedAdminPage(d.request(flag),d.env,view,d.render);assert.match(updated,/revision 2/);
  assert.equal(d.builds(),2);assert.equal(d.writes(),2);
  assert.equal(await savedAdminPage(d.request(),d.env,view,d.render),updated);
 });
}
test('background ID preparation builds once and never refreshes an existing saved reading',async()=>{
 const d=setup('id');await prepareSavedIdPage(d.request(),d.env,d.render);
 await prepareSavedIdPage(d.request(),d.env,async()=>{throw Error('must not recalculate')});
 assert.equal(d.builds(),1);assert.equal(d.writes(),1);
});
test('failed ID refresh preserves the valid saved snapshot',async()=>{
 const d=setup('id');const first=await savedAdminPage(d.request(),d.env,'id',d.render);
 await savedAdminPage(d.request('refreshIds'),d.env,'id',async()=>'<html><nav></nav><div class="admin-page page-id">Conteggi ID non disponibili</div></html>');
 assert.equal(d.writes(),1);assert.equal(await savedAdminPage(d.request(),d.env,'id',d.render),first);
});
test('saved page access stays authenticated and no-store; it does not query D1',async()=>{
 for(const view of ['id','diagnostica']){
 const d=setup(view);const first=await savedAdminPage(d.request(),d.env,view,d.render);
 d.env.DB={prepare(){throw Error('cached page must not query D1')}};
 let reads=0;const get=d.env.ARCHIVE.get;d.env.ARCHIVE.get=async key=>{reads++;return get(key)};
 assert.equal((await worker.fetch(d.request(),d.env)).status,401);assert.equal(reads,0);
 const r=await worker.fetch(new Request(d.request().url,{headers:{Authorization:'Basic '+btoa('admin:test-only')}}),d.env);
 assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(await r.text(),first);assert.equal(reads,1);
 }
});
