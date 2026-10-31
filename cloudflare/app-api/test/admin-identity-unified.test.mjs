import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {unifiedIdentityReport,attachIdentityRefresh,IDENTITY_REFRESH_CLIENT} from '../lib/admin-identity-unified.mjs';
import {applyBirthEvidence} from '../lib/player-birth-metadata.mjs';
import {loadObservedBirthAdmin} from '../lib/admin-observed-birth.mjs';
import {savedAdminPage} from '../lib/admin-saved-page.mjs';
const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const ids=()=>Object.assign(['fitp','tennis-europe','itf'].map(circuit=>({circuit,ids:1,players:1,missing:0})),{checkedAt:'2026-10-30'});
test('one identity refresh overlaps the three independent readers and renders their complete reading',async()=>{
 let release;const wait=new Promise(r=>release=r),started=[];const load=(name,value)=>async()=>{started.push(name);if(started.length===3)release();await wait;return value;};
 const html=await unifiedIdentityReport({DB:{}},new URL('https://app/admin/id'),{ids:load('ids',ids()),review:load('review',{available:true,cases:[]}),birth:load('birth',{available:true,selected:64,missing:[]})});
 assert.deepEqual(started,['ids','review','birth']);assert.match(html,/data-identity-snapshot/);assert.match(html,/ID giocatori per circuito/);assert.match(html,/Identità sospette/);assert.match(html,/Tutti i 64/);
});
test('partial failure cannot be published as a complete updated reading',async()=>{
 for(const field of ['ids','review','birth']){
 const values={ids:ids(),review:{available:true,cases:[]},birth:{available:true,selected:64,missing:[]}};values[field]=field==='ids'?null:{available:false};
 await assert.rejects(unifiedIdentityReport({DB:{}},new URL('https://app/admin/id'),Object.fromEntries(Object.entries(values).map(([k,v])=>[k,async()=>v]))),/incomplete/);
 }
});
test('Diagnostics and ID have exactly one accessible identity refresh icon; old separate controls are removed',()=>{
 const html='<html><nav></nav><form method="get" action="/admin/id"><button name="refreshIds">Aggiorna conteggi</button></form><form action="/admin/id#id-circuiti"><button>Aggiorna conteggi</button></form><a href="/admin/id#identita-sospette">Aggiorna segnalazioni</a></html>';
 for(const view of ['id','diagnostica']){const output=attachIdentityRefresh(html,view);assert.equal((output.match(/id="admin-identity-refresh"/g)||[]).length,1);assert.match(output,/aria-label="Aggiorna ID, identità sospette e anni di nascita"/);assert.doesNotMatch(output,/Aggiorna conteggi|Aggiorna segnalazioni/);}
});
test('icon makes no automatic request, shares simultaneous clicks, and never polls or retries',async()=>{
 let click,finish,calls=0,reloads=0;const pending=new Promise(r=>finish=r),button={dataset:{view:'id'},addEventListener:(event,fn)=>{click=fn}},status={};
 vm.runInNewContext(IDENTITY_REFRESH_CLIENT,{document:{getElementById:id=>id==='admin-identity-refresh'?button:status},AbortSignal,location:{reload(){reloads++}},fetch:async(url)=>{assert.equal(url,'/admin/id?refreshIdentity=1');calls++;await pending;return{ok:true,json:async()=>({updated:true})}}});
 assert.equal(calls,0);const first=click();await click();assert.equal(calls,1);finish();await first;assert.equal(reloads,1);assert.equal(button.disabled,false);
 assert.doesNotMatch(IDENTITY_REFRESH_CLIENT,/setInterval|setTimeout/);
});
test('icon failure preserves the displayed reading without reload',async()=>{
 let click,reloads=0;const status={},button={dataset:{view:'diagnostica'},addEventListener:(e,fn)=>click=fn};
 vm.runInNewContext(IDENTITY_REFRESH_CLIENT,{document:{getElementById:id=>id==='admin-identity-refresh'?button:status},AbortSignal,location:{reload(){reloads++}},fetch:async()=>({ok:false})});
 await click();assert.equal(reloads,0);assert.match(status.textContent,/precedente lettura/);
});
test('existing app years and five owner confirmations are recognized without deriving age or matching names',()=>{
 const years={'alessio-nava':2017,'andrea-losa':2014,'carlo-ghislotti':2016,'francesco-bocchio':2015,'matteo-bocchio':2017,'mattia-garibaldi':2015,'nicholas-scappa':2015,'virginia-rossoni':2016,'cw-5dad2aaa746cfd520dbe4e3313afe309':2010,'cw-ba794d788cf429468eb070db20de4cad':2007,'cw-bdb8d1e902ddd81f98afdd33d6f52844':2016,'cw-e51996ce09302dd1a0c6279a13447d53':2016,'cw-e99845ef949cc7dd2a99ff26e17af781':2012};
 for(const[id,year]of Object.entries(years))assert.equal(applyBirthEvidence({id},[]).birthYear,year);
 assert.equal(applyBirthEvidence({id:'other',name:'Alessio Nava'},[]).birthYear,undefined);
 assert.equal(applyBirthEvidence({id:'alessio-nava'},[{birth_year:2010}]).birthYearStatus,'conflict');
});
test('refresh endpoint remains inside admin authentication and uses the protected retained-page writer',()=>{
 const auth=source.indexOf('if(!adminAuthorized(request,env))'),action=source.indexOf("url.searchParams.get('refreshIdentity')");
 assert.ok(auth>0&&action>auth);assert.match(source.slice(action,action+1200),/savedAdminPage/);assert.match(source.slice(action,action+1200),/updated\?200:503/);
});
test('Admin omits existing app and user-confirmed years while retaining genuinely unknown observed players',async()=>{
 const selected=['alessio-nava','matteo-bocchio','nicholas-scappa','cw-bdb8d1e902ddd81f98afdd33d6f52844','unknown'].map(id=>({courtwatch_id:id,canonical_id:id,payload:JSON.stringify({id,name:id}),in_main:1}));
 let reads=0;const db={prepare(sql){reads++;return{bind(){return{all:async()=>({results:sql.includes('SELECT u.courtwatch_id')?selected:[]})}}}}};
 const r=await loadObservedBirthAdmin(db);assert.equal(r.available,true);assert.equal(reads,2);assert.deepEqual(r.missing.map(p=>p.id),['unknown']);
});
test('failure in any reader preserves the previous complete saved identity page',async()=>{
 const values=new Map();let writes=0;
 const env={DB:{},ARCHIVE:{get:async k=>values.has(k)?{json:async()=>JSON.parse(values.get(k))}:null,put:async(k,v)=>{writes++;values.set(k,v)}}};
 const url=new URL('https://unified-complete.test/admin/id?refreshIds=1'),request=new Request(url);
 const loaders={ids:async()=>ids(),review:async()=>({available:true,cases:[]}),birth:async()=>({available:true,selected:64,missing:[]})};
 const render=async()=>'<html><nav></nav><div class="admin-page page-id">'+await unifiedIdentityReport(env,url,loaders)+'</div></html>';
 await savedAdminPage(request,env,'id',render);const saved=[...values.entries()];
 loaders.birth=async()=>({available:false});const failed=await savedAdminPage(request,env,'id',render);
 assert.match(failed,/Aggiornamento non riuscito/);assert.match(failed,/Tutti i 64/);assert.equal(writes,1);assert.deepEqual([...values.entries()],saved);
});
