import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.css','v3.js'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const engine=process.env.COURTWATCH_MOBILE_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.COURTWATCH_TEST_CHROMIUM?{executablePath:process.env.COURTWATCH_TEST_CHROMIUM}:{})});
try {
 for(const scenario of ['normal','script-blocked','script-error','api-error','diagnostics-off']) {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(10000);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
   if(u.pathname==='/app')return route.fulfill({body:assets['v3.html'].replace('<head>','<head><base href="https://png8nftp9y-alt.github.io/">'),contentType:'text/html'});
   if(assets[name]){
    if(name==='v3.js'&&scenario==='script-blocked')return route.abort();
    return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},body:name==='v3.js'&&scenario==='script-error'?'throw Error("fixture startup error");':assets[name],contentType:name.endsWith('.css')?'text/css':'application/javascript'});
   }
   if(u.pathname.endsWith('/app-snapshot')){const group=route.request().headers()['x-courtwatch-group'];return route.fulfill({status:scenario==='api-error'?503:200,json:{group,players:[{id:group,name:group+' Player',userAdded:true}],tournaments:[],matches:[]}})}
   if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Fixture',role:'admin'}}});
   return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
  });
  await page.goto('https://courtwatch.test/app'+(scenario==='diagnostics-off'?'':'?cw-debug=1'));
  if(scenario==='diagnostics-off'){assert.equal(await page.locator('#cwMobileDiagnostics').count(),0);await page.close();continue;}
  await page.locator('#cwMobileDiagnostics').waitFor();
  const log=page.locator('#cwMobileDiagnostics pre');
  if(scenario==='script-blocked')await page.waitForFunction(()=>document.querySelector('#cwMobileDiagnostics pre')?.textContent.includes('SCRIPT NON CARICATO'));
  if(scenario==='script-error')await page.waitForFunction(()=>document.querySelector('#cwMobileDiagnostics pre')?.textContent.includes('fixture startup error'));
  if(scenario==='api-error')await page.waitForFunction(()=>document.querySelector('#cwMobileDiagnostics pre')?.textContent.includes('HTTP 503'));
  if(scenario==='normal'){
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.data&&!loadRunning);
   await page.locator('#homeOthers').tap();await page.waitForFunction(()=>PLAYER_GROUP==='others'&&!groupSwitchRunning);
   const text=await log.textContent();assert.ok(text.includes('TOCCO ALTRI: click'));assert.ok(text.includes('/app/api/app-snapshot gruppo=others HTTP 200'));
  }
  assert.ok((await log.textContent()).includes('20261017-safari-diagnosis'));
  console.log(JSON.stringify({engine:engine.name(),scenario,diagnosis:'passed'}));await page.close();
 }
}finally{await browser.close()}
