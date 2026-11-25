import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.js','v3.css'].map(async p=>[p,await readFile(new URL('../'+p,import.meta.url),'utf8')])));
const tracked={circuit:'fitp',competitionId:'SEARCH-F1',name:'Open Circolo Test',venueName:'Circolo Test',location:'Monza',startDate:'2026-11-24',endDate:'2026-11-30'};
const empty={...tracked,circuit:'itf',competitionId:'SEARCH-I1',name:'J30 Cuneo',location:'Cuneo'};
const browser=await chromium.launch({headless:true,executablePath:process.env.COURTWATCH_TEST_CHROMIUM||undefined});
try{for(const group of ['main','others']){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
  if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  if(url.pathname.endsWith('/tournament-search'))return route.fulfill({json:url.searchParams.has('competitionId')?{tournament:empty}:{results:[tracked,empty],total:2,nextCursor:''}});
  if(url.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Test',role:'admin'}}});
  if(url.pathname.endsWith('/app-snapshot'))return route.fulfill({json:{group,players:[{id:'search-player',name:'Test Player',userAdded:true,sex:'F',birthYear:2012}],tournaments:[{...tracked,playerId:'search-player',playerName:'Test Player'}],matches:[],agenda:[]}});
  return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
 });
 await page.goto('https://courtwatch.test/v3.html?group='+group+'#calendar');await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.length&&!loadRunning);
 const input=page.locator('#tournamentSearchInput');await input.fill('monza');await page.locator('#tournamentSearchSuggestions button').first().waitFor();
 assert.equal(await page.locator('#tournamentSearchSuggestions button').count(),2);
 await page.keyboard.press('Enter');assert.equal(await input.inputValue(),'');await page.locator('#tournamentSearchPageRows button').first().waitFor();assert.equal(await page.locator('#tournamentSearchPageRows button').count(),2);
 await page.locator('#tournamentSearchPageRows [data-catalogue-id="SEARCH-F1"]').click();await page.locator('.tournamentPlayer').waitFor();assert.match(await page.locator('.tournamentPlayer').textContent(),/Test Player/);
 await page.goBack();await page.locator('#tournamentSearchPageRows button').first().waitFor();await page.locator('#tournamentSearchPageRows [data-catalogue-id="SEARCH-I1"]').click();await page.locator('.tournamentHero h2').waitFor();
 assert.match(await page.locator('.tournamentHero h2').textContent(),/J30 Cuneo/);assert.equal(await page.locator('.tournamentPlayer,.tournamentMatches,.tournamentHeroActions').count(),0);
 await page.reload();await page.locator('.tournamentHero h2').waitFor();assert.match(await page.locator('.tournamentHero h2').textContent(),/J30 Cuneo/);
 await page.evaluate(()=>{location.hash='#calendar';});await input.waitFor({state:'visible'});
 for(const width of [320,390,768,1024,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect(),p=r('playerFilters'),t=r('calendarTournamentToolbar'),s=r('tournamentSearchForm'),a=r('addCalendarEvent'),m=document.querySelector('.calendarMonthNav').getBoundingClientRect();return p.bottom<=t.top+1&&m.top>=t.top&&m.bottom<=t.bottom&&a.right<=s.left&&Math.abs(a.top+a.height/2-s.top-s.height/2)<2&&s.width<=261&&(innerWidth<=700||Math.abs(m.top+m.height/2-s.top-s.height/2)<2);}),`calendar controls and month must share the toolbar below players at ${width}px`);assert.ok(await page.evaluate(()=>{const ids=['tournamentSearchForm','tournamentSearchInput','toggleAll'];return ids.every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;});}),`calendar search controls must fit ${width}px`);}
 await input.fill('monza');await page.locator('#tournamentSearchSuggestions button').first().waitFor();await page.locator('#tournamentSearchSuggestions button').first().click();await page.locator('.tournamentHero h2').waitFor();assert.equal(await input.inputValue(),'');await page.evaluate(()=>{location.hash='#calendar';});await input.waitFor({state:'visible'});
 await input.fill('monza');await page.locator('#tournamentSearchSuggestions button').first().waitFor();await page.locator('.calendarTitleActions h2').click();assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#tournamentSearchSuggestions').isVisible(),false);
 await input.fill('monza');await page.locator('#tournamentSearchSuggestions button').first().waitFor();await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.length&&!loadRunning);assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#tournamentSearchSuggestions').isVisible(),false);
 await input.fill('draft');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await input.inputValue(),'');
 assert.deepEqual(errors,[]);await page.close();
}console.log('Tournament search: suggestions, Enter results, tracked/empty pages and reload passed for both groups.');}finally{await browser.close();}
