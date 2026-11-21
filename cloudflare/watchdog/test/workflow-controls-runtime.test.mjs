import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as runtime from 'miniflare';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Cloudflare runtime reads workflows and verifies pause/resume through private RPC; no real GitHub access',async()=>{
 let state='active';const calls=[];
 const workflow=()=>({id:42,name:'Runtime fixture',path:'.github/workflows/courtwatch-itf-junior-rankings.yml',state});
 const controls=read('../src/workflow-controls.mjs'),panel=read('../../app-api/lib/admin-operational-workflows.mjs')+'\n'+read('../../app-api/lib/admin-automation-control.mjs').replace(/^import[^\n]+\n/,'');
 const options={workers:[{name:'app',compatibilityDate:'2026-08-29',modules:true,serviceBindings:{AUTOMATION_CONTROL:{name:'watchdog',entrypoint:'AutomationControl'}},script:panel+`\nexport default {async fetch(request,env){try {const url=new URL(request.url);if(url.pathname==='/change')return changeAutomation(request,env,{});return new Response(await automationControlPage('<h2>Workflow e watchdog</h2><table><thead><tr><th>Riferimento</th></tr></thead><tbody><tr><td><b>ITF Junior · classifiche e recuperi</b></td><td>—</td></tr></tbody></table>','diagnostica',env));}catch(e){return new Response(String(e),{status:500});}}}`},{name:'watchdog',compatibilityDate:'2026-08-29',modules:true,bindings:{COURTWATCH_GITHUB_TOKEN:'fixture-only'},script:`import {WorkerEntrypoint} from 'cloudflare:workers';\n`+controls+`\nexport class AutomationControl extends WorkerEntrypoint {async list(){return listWorkflowControls(this.env);}async set(input){return setWorkflowEnabled(this.env,input);}}`,outboundService:async request=>{
  calls.push({url:request.url,method:request.method});assert.equal(new URL(request.url).hostname,'api.github.com');
  if(request.method==='PUT'){assert.match(request.url,/\/42\/(enable|disable)$/);state=request.url.endsWith('/disable')?'disabled_manually':'active';return new Response(null,{status:204});}
  assert.equal(request.method,'GET');return Response.json(request.url.includes('?')?{total_count:1,workflows:[workflow()]}:workflow());
 }}]};
 const mf=new runtime.Miniflare(runtime.convertV4MiniflareOptions?runtime.convertV4MiniflareOptions(options):options);
 try {
  const initial=await mf.dispatchFetch('https://app.test/');assert.equal(initial.status,200);assert.match(await initial.text(),/Metti in pausa/);assert.ok(calls.every(x=>x.method==='GET'));
  const post=(action,expectedState)=>mf.dispatchFetch('https://app.test/change',{method:'POST',redirect:'manual',headers:{Origin:'https://app.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({workflowId:'42',action,expectedState}).toString()});
  assert.equal((await post('pause','active')).status,303);assert.equal(state,'disabled_manually');
  const paused=await (await mf.dispatchFetch('https://app.test/')).text();assert.match(paused,/Riattiva/);assert.doesNotMatch(paused,/Metti in pausa/);
  assert.equal((await post('resume','disabled_manually')).status,303);assert.equal(state,'active');
  assert.equal(calls.filter(x=>x.method==='PUT').length,2);assert.ok(calls.every(x=>!/(dispatches|cancel)/.test(x.url)));
 }finally{await mf.dispose();}
});
