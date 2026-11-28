import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.js','v3.css'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const id='A62D829E-687A-4DC8-A2F8-FBEFEB690167',phases=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const tournament={circuit:'fitp',competitionId:id,name:'FITP fase verificata',location:'Monza',startDate:'2026-11-24',endDate:'2026-11-30'};
const draws=['INIZIALE','FINALE'].map((phase,i)=>({categoryCode:'SM14',category:'Singolare Maschile Under 14',phase:'TABELLONE '+phase,label:'SM14 '+phase,phaseId:phases[i],tournamentId:'222',url:`https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3?tournamentId=222&phaseId=${phases[i]}`}));
const player={id:'p',name:'Observed Player',userAdded:true,sex:'M',birthYear:2012},match={...tournament,playerId:'p',playerName:player.name,draw:'Singolare Maschile Under 14',resultSourceUrl:`https://dp-myfit-test-function-v2.azurewebsites.net/api/v3/puc/competizione/tabellone?tournamentId=222&phaseId=${phases[1]}`,date:'2026-11-25',opponent:'Other Player',result:'6-2 6-2'};
const browser=await chromium.launch({headless:true,executablePath:process.env.COURTWATCH_TEST_CHROMIUM||undefined});
try{for(const group of ['main','others']){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
  if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Test',role:'admin'}}});
  if(u.pathname.endsWith('/app-snapshot'))return route.fulfill({json:{group,players:[player],tournaments:[{...tournament,playerId:'p',playerName:player.name,subscriptionRegistrations:[{category:'Singolare Maschile Under 14'}]}],matches:[match],agenda:[]}});
  if(u.pathname.endsWith('/fitp-draw-links'))return route.fulfill({json:{competitionId:id,draws:draws.map((row,i)=>({...row,participantsLoaded:true,participants:i===1?[{name:player.name}]:[{name:'Other Player'}]}))}});
  if(u.pathname.endsWith('/tournament-search'))return route.fulfill({json:{tournament}});
  return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
 });
 await page.goto(`https://courtwatch.test/v3.html?group=${group}#calendar`);await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.length&&!loadRunning);
 await page.evaluate(id=>{location.hash='#catalog-tournament/fitp/'+id;},id);await page.waitForFunction(()=>document.querySelectorAll('.tournamentDraws a').length===1);
 assert.equal(await page.locator('.tournamentDraws a').textContent(),'SM14 FINALE');assert.match(await page.locator('.tournamentDraws a').getAttribute('href'),new RegExp(phases[1]));
 await page.evaluate(({match,url})=>{state.data.matches.push({...match,resultSourceUrl:url});const saved=fitpDrawLinkCache.get(match.competitionId);saved.draws[0].participants.push({name:'Observed Player'});route();},{match,url:draws[0].url});await page.waitForFunction(()=>document.querySelectorAll('.tournamentDraws a').length===2);
 await page.evaluate(()=>{state.data.players=[];state.data.tournaments=[];state.data.matches=[];route();});await page.waitForFunction(()=>!document.querySelector('.tournamentPlayer')&&document.querySelectorAll('.tournamentDraws a').length===2);
 assert.deepEqual(errors,[]);await page.close();
}console.log('FITP main/others: final only, both phases when both are observed, all phases when unobserved.');}finally{await browser.close();}
