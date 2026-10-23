import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.css','v3.js'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const engine=process.env.COURTWATCH_MOBILE_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.COURTWATCH_TEST_CHROMIUM?{executablePath:process.env.COURTWATCH_TEST_CHROMIUM}:{})});
try {
 // Cold group switch: keep both the previous load and target history blocked.
 {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));
  let releaseOld,releaseTarget,targetReads=0,listReads=0;
  const oldGate=new Promise(r=>releaseOld=r),targetGate=new Promise(r=>releaseTarget=r);
  await page.addInitScript(()=>{window.setInterval=()=>0});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),name=u.pathname.split('/').pop(),group=route.request().headers()['x-courtwatch-group']||'main';
   if(u.pathname==='/app')return route.fulfill({body:assets['v3.html'].replace('<head>','<head><base href="https://png8nftp9y-alt.github.io/">'),contentType:'text/html'});
   if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.css')?'text/css':'application/javascript'});
   const id=group+'-player',player={id,name:group==='main'?'TCL Player':'Others Cold Player',userAdded:true,club:'Saved Club'};
   if(u.pathname.endsWith('/player-list')){if(group==='others')listReads++;return route.fulfill({json:{group,membershipIds:[id],players:[player]}});}
   if(u.pathname.endsWith('/app-snapshot')){
    if(group==='others'){targetReads++;await targetGate;}
    return route.fulfill({json:{group,membershipIds:[id],players:[player],tournaments:[{playerId:id,competitionId:'event',name:'Complete Tournament',circuit:'tennis-europe',startDate:'2026-10-01',endDate:'2026-10-31'}],matches:[]}});
   }
   if(name==='diagnostics.json'&&group==='main')await oldGate;
   if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Fixture'}}});
   return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
  });
  try{
   await page.goto('https://courtwatch.test/app#players');
   await page.waitForFunction(()=>state.data?.players?.[0]?.id==='main-player'&&loadRunning);
   const identity=await page.evaluate(()=>documentIdentity='preserved');
   await page.locator('#playersView [data-switch-player-group]').tap();
   await page.waitForFunction(()=>PLAYER_GROUP==='others'&&!groupSwitchRunning&&state.data?.membershipOnly===true);
   await page.locator('#playersList [data-profile="others-player"]').waitFor();
   assert.match(await page.locator('#playersList').innerText(),/Saved Club/);
   assert.match(await page.locator('#playersList').innerText(),/Caricamento tornei/);
   assert.doesNotMatch(await page.locator('#playersList').innerText(),/Nessun torneo/);
   assert.equal(targetReads,1);assert.equal(listReads,1);
   assert.equal(await page.evaluate(()=>documentIdentity),identity);
   await page.evaluate(()=>location.hash='agenda');
   await page.waitForFunction(()=>document.querySelector('#dailyAgenda')?.textContent.includes('Caricamento tornei'));
   releaseOld();releaseTarget();
   await page.waitForFunction(()=>!state.data?.membershipOnly&&!loadRunning&&state.data?.tournaments?.some(t=>t.name==='Complete Tournament'));
   assert.equal(targetReads,1);assert.equal(listReads,1);
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({engine:engine.name(),coldSwitchBeforeOldLoadAndTargetHistory:'passed',fullTargetRequests:targetReads,listRequests:listReads}));
  } finally {releaseOld();releaseTarget();await context.close();}
 }
 for(const scenario of ['fresh','null-ui','array-ui','invalid-dates','invalid-maps','storage-denied']) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
  await page.addInitScript(scenario=>{
   window.setInterval=()=>0;window.documentIdentity=Math.random();
   if(scenario==='storage-denied')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}});
   else {
    const key='courtwatch-v3-ui-state-v1-others';
    if(scenario==='null-ui')localStorage.setItem(key,'null');
    if(scenario==='array-ui')localStorage.setItem(key,'[]');
    if(scenario==='invalid-dates')localStorage.setItem(key,JSON.stringify({month:'2026-99',agenda:'2026-02-31',selected:['others-player']}));
    if(scenario==='invalid-maps'){
     localStorage.setItem('courtwatch-opponent-history-v3',JSON.stringify([null,{},42,['valid',{tournaments:[]}]]));
     localStorage.setItem('courtwatch-player-rankings-v1',JSON.stringify([null,'broken',{}]));
    }
   }
  },scenario);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
   if(u.pathname==='/app')return route.fulfill({body:assets['v3.html'].replace('<head>','<head><base href="https://png8nftp9y-alt.github.io/">'),contentType:'text/html'});
   if(assets[name])return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},body:assets[name],contentType:name.endsWith('.css')?'text/css':'application/javascript'});
   if(u.pathname.endsWith('/app-snapshot')){
    const group=route.request().headers()['x-courtwatch-group'];assert.ok(['main','others'].includes(group));
    const id=group+'-player',player={id,name:group==='main'?'TCL Player':'Others Player',userAdded:true};
    const tournament={playerId:id,competitionId:'event-'+group,name:'Europe '+group,circuit:'tennis-europe',startDate:'2026-10-01',endDate:'2026-10-31'};
    return route.fulfill({json:{group,players:[player],tournaments:[tournament],matches:[{id:'match-'+group,playerId:id,playerName:player.name,competitionId:tournament.competitionId,tournamentName:tournament.name,circuit:'tennis-europe',date:'2026-10-17',event:'GS14',round:'Final',opponent:'Other Player',score:'6-4 6-3',advances:true}]}});
   }
   if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Mobile Fixture',role:'admin'}}});
   return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
  });
  // A direct Others entry on a phone with no previous valid UI state.
  await page.goto('https://courtwatch.test/app?group=others#players');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.[0]?.id==='others-player'&&!loadRunning);
  assert.equal(await page.locator('#syncStatus').isVisible(),false);
  assert.deepEqual(errors,[],scenario+': startup');
  const identity=await page.evaluate(()=>documentIdentity);
  for(const route of ['','players','calendar','agenda']){
   await page.evaluate(route=>location.hash=route,route);
   const view='#'+(route||'home')+'View.active';await page.locator(view).waitFor();
   const switcher=page.locator(route?view+' [data-switch-player-group]':'#homeOthers');
   if(scenario==='null-ui')await page.evaluate(()=>localStorage.setItem('courtwatch-v3-ui-state-v1','null'));
   await switcher.tap();
   await page.waitForFunction(()=>PLAYER_GROUP==='main'&&!groupSwitchRunning);
   assert.equal(await page.evaluate(()=>state.data.players[0].id),'main-player');
   if(scenario==='null-ui')await page.evaluate(()=>localStorage.setItem('courtwatch-v3-ui-state-v1-others','null'));
   await switcher.tap();
   await page.waitForFunction(()=>PLAYER_GROUP==='others'&&!groupSwitchRunning);
   assert.equal(await page.evaluate(()=>state.data.players[0].id),'others-player');
   assert.equal(await page.evaluate(()=>documentIdentity),identity,'switch must not reload the document');
  }
  await page.evaluate(()=>location.hash='players');await page.locator('#playersView.active').waitFor();
  await page.locator('[data-profile="others-player"]').tap();await page.locator('#profileView.active .profileHero h2').waitFor();
  assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(),1);
  assert.deepEqual(errors,[],scenario+': touch switching');
  console.log(JSON.stringify({engine:engine.name(),scenario,directOthers:'passed',touchSwitches:8,knownMatch:'passed',documentPreserved:'passed'}));
  await context.close();
 }
}finally{await browser.close()}
