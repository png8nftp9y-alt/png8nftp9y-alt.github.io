import test from 'node:test';
import assert from 'node:assert/strict';
import {savedAdminPage} from '../lib/admin-saved-page.mjs';
function fixture(view){
 const objects=new Map();let writes=0;
 const env={ARCHIVE:{async get(key){return objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null},async put(key,value){writes++;objects.set(key,value)}}};
 const flag=view==='id'?'refreshIds':'refreshDiagnostics';
 const request=refresh=>new Request(`https://refresh-failure.test/admin/${view}${refresh?'?'+flag+'=1':''}`);
 const render=async()=>`<html><nav></nav><div class="admin-page page-${view}">lettura precedente</div></html>`;
 return {env,objects,request,render,writes:()=>writes};
}
for(const view of ['diagnostica','id']){
 test(view+' failed manual refresh keeps the saved reading and visibly reports failure',async()=>{
  const f=fixture(view),first=await savedAdminPage(f.request(true),f.env,view,f.render);
  const before=[...f.objects.entries()];
  const html=await savedAdminPage(f.request(true),f.env,view,async()=>{throw Error('D1 read failed')});
  assert.match(html,/role="alert"/);assert.match(html,/Aggiornamento non riuscito/);assert.match(html,/ultima lettura salvata/);assert.match(html,/lettura precedente/);
  assert.deepEqual([...f.objects.entries()],before);assert.equal(f.writes(),1);
  assert.equal(await savedAdminPage(f.request(false),f.env,view,()=>{throw Error('must not render')}),first);
 });
 test(view+' first refresh failure provides a retry control without fabricating a successful reading',async()=>{
  const f=fixture(view),html=await savedAdminPage(f.request(true),f.env,view,async()=>{throw Error('D1 CPU limit')});
  assert.match(html,/Aggiornamento non riuscito/);assert.match(html,/Nessuna lettura salvata disponibile/);assert.match(html,/name="refresh(?:Diagnostics|Ids)"/);assert.equal(f.writes(),0);
 });
}
test('simultaneous explicit refreshes share a build; the next manual action can recover',async()=>{
 const f=fixture('diagnostica');let builds=0,release;
 const pending=new Promise(resolve=>release=resolve);
 const render=async()=>{builds++;await pending;return f.render()};
 const a=savedAdminPage(f.request(true),f.env,'diagnostica',render),b=savedAdminPage(f.request(true),f.env,'diagnostica',render);
 await Promise.resolve();assert.equal(builds,1);release();assert.equal(await a,await b);assert.equal(f.writes(),1);
 const html=await savedAdminPage(f.request(true),f.env,'diagnostica',async()=>'<html><nav></nav><div class="admin-page page-diagnostica">nuova lettura</div></html>');
 assert.match(html,/nuova lettura/);assert.equal(f.writes(),2);
});
