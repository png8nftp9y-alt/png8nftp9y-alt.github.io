import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function reader(){
 const source=readFileSync(new URL('../src/v3/read-itf-draws-browser.mjs',import.meta.url),'utf8');
 const start=source.indexOf('async function api(page,url'),end=source.indexOf('export async function',start);
 const context={challengePattern:/Incapsula|hCaptcha/i,pause:async()=>{},Error,JSON};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';globalThis.read=api;',context);return context.read;
}
test('browser retries failed fetch and returns the real successful response',async()=>{
 let calls=0,reloads=0;
 const page={evaluate:async()=>{if(++calls===1)throw Error('Failed to fetch');return{status:200,text:'{"matchId":1183706228,"resultStatusCode":"WO"}'}},reload:async()=>{reloads++}};
 const result=await reader()(page,'https://www.itftennis.com/tennis/api/TournamentApi/GetDrawsheet');
 assert.equal(result.matchId,1183706228);assert.equal(result.resultStatusCode,'WO');assert.equal(calls,2);assert.equal(reloads,1);
});
test('permanent network failure is bounded to three reads and two reloads',async()=>{
 let calls=0,reloads=0;
 const page={evaluate:async()=>{calls++;throw Error('Failed to fetch')},reload:async()=>{reloads++}};
 await assert.rejects(reader()(page,'endpoint'),/browser_network_error:Failed to fetch/);
 assert.equal(calls,3);assert.equal(reloads,2);
});
test('a failed reload does not bypass the remaining bounded attempts',async()=>{
 let calls=0,reloads=0;
 const page={evaluate:async()=>{if(++calls<3)throw Error('Failed to fetch');return{status:200,text:'{"ok":true}'}},reload:async()=>{reloads++;throw Error('reload failed')}};
 assert.equal((await reader()(page,'endpoint')).ok,true);assert.equal(calls,3);assert.equal(reloads,2);
});
test('persistent source protection remains an explicit error',async()=>{
 let calls=0;
 const page={evaluate:async()=>{calls++;return{status:403,text:'Incapsula challenge'}},reload:async()=>{}};
 await assert.rejects(reader()(page,'endpoint'),/browser_incapsula_challenge/);assert.equal(calls,3);
});
