import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.js','v3.css'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const players=[{id:'fixture',name:'Alexandra Maria Constantinopoulos',userAdded:true}];
const tournament={playerId:'fixture',competitionId:'event',name:'International European Junior Championship',location:'Saint-Georges-de-Commiers, Francia',circuit:'tennis-europe',startDate:'2026-09-01',endDate:'2026-10-27'};
const matches=[{id:'match',playerId:'fixture',playerName:players[0].name,competitionId:'event',tournamentName:tournament.name,circuit:'tennis-europe',date:'2026-10-17',event:'GD14',matchType:'doubles',partner:'Anastasia Marie-Louise Papadopoulou',opponent:'Alexandre Maximilien Constantinopoulos / Alexandra Maria de la Rochefoucauld',score:'6-7(12) 7-6(10) 10-8',round:'Quarter final'}];
const engine=process.env.COURTWATCH_MOBILE_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.COURTWATCH_TEST_CHROMIUM?{executablePath:process.env.COURTWATCH_TEST_CHROMIUM}:{})});
try {
 for(const group of ['main','others']) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));
  let failed=false,searchFailed=false,snapshots=0,searches=0;
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
  await page.addInitScript(()=>{window.setInterval=()=>0});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
   if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});
   if(u.pathname.endsWith('/app-snapshot')){snapshots++;return route.fulfill({status:failed?503:200,json:{group,players,tournaments:[tournament],matches,agenda:matches}})}
   if(u.pathname.endsWith('/player-search')){searches++;return route.fulfill({status:searchFailed?503:200,json:{results:Array.from({length:10},(_,i)=>({...players[0],name:i?'Search Person '+i:players[0].name,courtwatchId:players[0].id,sourceKey:'search-'+i}))}})}
   if(u.pathname.endsWith('/opponent-profile'))return route.fulfill({json:{profile:{name:matches[0].opponent},tournaments:[{...tournament,historyKind:'past',matches:[{...matches[0],won:false,status:'completed',opponents:[{name:players[0].name,profileId:'other'}]}]}]}});
   if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Mobile Fixture',role:'admin'}}});
   return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
  });
  await page.goto('http://courtwatch.test/v3.html?group='+group+'#players');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.length&&!loadRunning);
  // Both portrait and landscape, small keyboard viewport, tablets and desktop.
  const sizes=[[320,640],[375,812],[390,844],[430,932],[844,390],[390,420],[768,1024],[1024,768],[1440,1000]];
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});

   for(const route of ['', 'players','calendar','agenda','player/fixture','tournament','opponent-profile/other/Someone/-']) {
    await page.evaluate(route=>location.hash=route==='tournament'?'tournament/'+encodeURIComponent(tournamentKey(state.data.tournaments[0])):route,route);
    const expected=route.startsWith('player/')||route.startsWith('opponent')||route==='tournament'?'profile':route||'home';
    await page.locator('#'+expected+'View.active').waitFor();
    if(route.startsWith('opponent'))await page.locator('#opponentTournamentHistory .unifiedMatchRow').waitFor();
    if(route==='player/fixture')await page.locator('.tournamentToggle[aria-expanded="false"]').evaluateAll(es=>es.forEach(e=>e.click()));
    if(route==='tournament')await page.locator('.tournamentPlayerToggle[aria-expanded="false"]').evaluateAll(es=>es.forEach(e=>e.click()));
    if(process.env.COURTWATCH_MOBILE_CAPTURE&&group==='main'&&width===390&&height===844&&route.startsWith('opponent'))await page.screenshot({path:process.env.COURTWATCH_MOBILE_CAPTURE,fullPage:true});
    const problems=await page.evaluate(()=>{
     const bad=[],root=document.querySelector('main.view.active');
     for(const e of [document.querySelector('.top'),root,...root.querySelectorAll('button,input,select,[role="link"],.card,.cardHead,.unifiedMatchRow')]) {
      const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
      if(r.left< -1||r.right>innerWidth+1)bad.push(e.tagName+'.'+e.className+' outside viewport');
     }
     for(const row of root.querySelectorAll('.unifiedMatchRow')) {
      const box=row.getBoundingClientRect();
      for(const e of row.querySelectorAll('.inlinePlayerLink,.opponentHistoryCourtWatch,strong,.unifiedMatchMeta,.unifiedMatchOpponent')) {
       const r=e.getBoundingClientRect();if(r.width&&(r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+1))bad.push('match content outside row');
      }
     }
     return [...new Set(bad)];
    });
    assert.equal(await page.evaluate(()=>document.documentElement.clientWidth),width,`${group}: mobile viewport must keep its requested width`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${group}/${width}/${route}: document overflow`);
    assert.deepEqual(problems,[],`${group}/${width}x${height}/${route}: ${problems.join('; ')}`);
   }
  }
  await page.setViewportSize({width:390,height:420});
  await page.evaluate(()=>location.hash='players');await page.locator('#playersView.active').waitFor();
  // A retained selection in the header must not disable a touch on a player.
  await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('.brand h1'));getSelection().removeAllRanges();getSelection().addRange(r)});
  await page.locator('[data-profile="fixture"]').tap();await page.locator('#profileView.active').waitFor();
  await page.evaluate(()=>{getSelection().removeAllRanges();location.hash='players'});await page.locator('#playersView.active').waitFor();
  await page.locator('#playerSearchInput').fill('Alex');await page.locator('.playerSearchSuggestion[data-search-player="search-9"]').waitFor();
  const last=page.locator('[data-search-player="search-9"]');await last.scrollIntoViewIfNeeded();
  assert.equal(await last.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'last search result must be touch reachable, not clipped by player card');
  await last.tap();await page.locator('#profileView.active').waitFor();
  await page.evaluate(()=>location.hash='players');await page.locator('#playersView.active').waitFor();
  searchFailed=true;await page.locator('#playerSearchInput').fill('Failure');await page.locator('[data-retry-search]').waitFor();
  searchFailed=false;await page.locator('[data-retry-search]').tap();await page.locator('[data-search-player="search-0"]').waitFor();
  // Submitting invalidates pending suggestions before navigation.
  await page.locator('#playerSearchInput').fill('Alex');await page.locator('#playerSearchInput').press('Enter');
  await page.locator('#playerSearchPageContent [data-search-player]').first().waitFor();assert.equal(await page.locator('#playerSearchSuggestions').isVisible(),false);
  await page.evaluate(()=>location.hash='players');await page.locator('#playersView.active').waitFor();
  await page.locator('#addPlayer').tap();await page.locator('#addPlayerQuery').fill('Alex');await page.locator('#addPlayerDialog [data-search-player]').first().waitFor();
  const dialog=await page.locator('#addPlayerDialog').boundingBox();assert.ok(dialog.x>=0&&dialog.x+dialog.width<=390);
  await page.locator('[data-close-add-player]').tap();assert.equal(await page.locator('#addPlayerDialog').count(),0);
  // Moving a finger cancels the long press rather than applying a filter while scrolling.
  await page.evaluate(()=>{const e=document.createElement('button');e.id='hold-test';document.body.append(e);window.mobileHoldCount=0;window.isolatePlayer=()=>window.mobileHoldCount++;bindPlayerHold(e,'fixture');e.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',clientX:10,clientY:10,button:0}));e.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:10,clientY:45}));});
  await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.mobileHoldCount),0);await page.locator('#hold-test').evaluate(e=>e.remove());
  await page.evaluate(()=>location.hash='player/fixture');await page.locator('#profileView.active').waitFor();
  await page.evaluate(()=>saveCachedData(state.data));failed=true;
  await page.reload();await page.locator('#profileContent .unifiedMatchRow').waitFor({state:'attached'});
  assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(),1,'failed network reload must preserve matches');
  await page.waitForFunction(()=>!loadRunning);
  failed=false;const before=snapshots;await page.evaluate(()=>dispatchEvent(new Event('online')));await page.waitForFunction(()=>!loadRunning);assert.ok(snapshots>before,'reconnect triggers a fresh snapshot');
  assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(),1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine:engine.name(),group,viewports:sizes.length,routes:7,touchSelection:'passed',searchLastResult:'passed',searchRetry:'passed',searchSubmit:'passed',addDialog:'passed',scrollCancelsHold:'passed',offlineRefresh:'passed',reconnect:'passed',snapshots,searches}));
  await context.close();
 }
}finally{await browser.close()}
