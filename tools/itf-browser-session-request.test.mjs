import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const url='https://www.itftennis.com/tennis/api/TournamentApi/GetDrawsheet?tournamentId=1';
function reader(){
 const source=readFileSync(new URL('../src/v3/read-itf-draws-browser.mjs',import.meta.url),'utf8');
 const start=source.indexOf('async function api(page,url,'),end=source.indexOf('export async function',start);
 assert.ok(start>=0&&end>start);
 const context={challengePattern:/Incapsula|hCaptcha/i,pause:async()=>{},Error,JSON,URL};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';globalThis.read=api;',context);return context.read;
}
function page(status,text){
 const calls={browser:0,session:0,disposed:0};
 return {calls,evaluate:async()=>{calls.browser++;throw Error('Failed to fetch')},reload:async()=>{},request:{get:async(endpoint,options)=>{calls.session++;assert.equal(endpoint,url);assert.equal(options.timeout,30000);assert.equal(options.failOnStatusCode,false);return{status:()=>status,text:async()=>text,dispose:async()=>{calls.disposed++}}}}};
}
test('session request reads official JSON only after browser network failure and explicit opt in',async()=>{
 const p=page(200,'{"matchId":1,"resultStatusCode":"WO"}');
 const result=await reader()(p,url,{networkFallback:true});assert.equal(result.resultStatusCode,'WO');
 assert.equal(p.calls.browser,1);assert.equal(p.calls.session,1);assert.equal(p.calls.disposed,1);
});
test('existing callers never use session request unless enabled',async()=>{
 const p=page(200,'{}');await assert.rejects(reader()(p,url),/Failed to fetch/);assert.equal(p.calls.session,0);
});
test('session HTTP errors with JSON bodies cannot be accepted as documents',async()=>{
 const p=page(403,'{"error":"forbidden"}');await assert.rejects(reader()(p,url,{networkFallback:true}),/browser_http_403/);assert.equal(p.calls.session,3);assert.equal(p.calls.disposed,3);
});
test('session challenge remains blocked rather than becoming a successful draw',async()=>{
 const p=page(200,'Incapsula challenge');await assert.rejects(reader()(p,url,{networkFallback:true}),/browser_incapsula_challenge/);
});
test('session fallback is restricted to the two official read endpoints',async()=>{
 const p=page(200,'{}');await assert.rejects(reader()(p,'https://other.invalid/path',{networkFallback:true}),/session_api_url_not_allowed/);assert.equal(p.calls.session,0);
});
test('session network failure remains bounded and explicit',async()=>{
 const p=page(200,'{}');p.request.get=async()=>{p.calls.session++;throw Error('connection closed')};
 await assert.rejects(reader()(p,url,{networkFallback:true}),/connection closed/);assert.equal(p.calls.session,3);
});
