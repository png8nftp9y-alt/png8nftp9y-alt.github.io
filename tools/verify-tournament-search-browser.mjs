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
 await page.keyboard.press('Enter');await page.locator('#tournamentSearchPageRows button').first().waitFor();assert.equal(await page.locator('#tournamentSearchPageRows button').count(),2);
 await page.locator('[data-catalogue-id="SEARCH-F1"]').click();await page.locator('.tournamentPlayer').waitFor();assert.match(await page.locator('.tournamentPlayer').textContent(),/Test Player/);
 await page.goBack();await page.locator('#tournamentSearchPageRows button').first().waitFor();await page.locator('[data-catalogue-id="SEARCH-I1"]').click();await page.locator('.tournamentHero h2').waitFor();
 assert.match(await page.locator('.tournamentHero h2').textContent(),/J30 Cuneo/);assert.equal(await page.locator('.tournamentPlayer,.tournamentMatches,.tournamentHeroActions').count(),0);
 await page.reload();await page.locator('.tournamentHero h2').waitFor();assert.match(await page.locator('.tournamentHero h2').textContent(),/J30 Cuneo/);
 await page.evaluate(()=>{location.hash='#calendar';});await input.waitFor({state:'visible'});
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.getElementById('tournamentSearchForm').nextElementSibling.id),'toggleAll');}
 assert.deepEqual(errors,[]);await page.close();
}console.log('Tournament search: suggestions, Enter results, tracked/empty pages and reload passed for both groups.');}finally{await browser.close();}
