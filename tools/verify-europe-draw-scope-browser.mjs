import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {europeCatalogueDraws} from '../cloudflare/app-api/lib/tournament-draw-catalogue.mjs';
const assets=Object.fromEntries(await Promise.all(['v3.html','v3.js','v3.css'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const circuit='tennis-europe',rid='E6C27FE1-A487-440E-9C38-AE8717B4FDE5',fid='00523E1D-06C9-430A-B8B9-851B401381E3';
const tournament=(competitionId,name)=>({circuit,competitionId,name,location:'Test City',startDate:'2026-02-14',endDate:'2026-02-22',sourceUrl:`https://te.tournamentsoftware.com/tournament/${competitionId}`});
const rotterdam=tournament(rid,'Robey FOCUS tennis academy open 2026'),forli=tournament(fid,'Forli');
const rd=europeCatalogueDraws(await readFile(new URL('../src/v3/fixtures/rotterdam-2026-draw-list.html',import.meta.url),'utf8'),rid);
const fd=['BS12 - Group A','BS12 - Group B','GS12 - Group A','GS12 - Group B'].map((event,i)=>({event,group:i%2?'B':'A',drawId:String(i+1),drawUrl:`https://te.tournamentsoftware.com/tournament/${fid}/draw/${i+1}`}));
const players=[{id:'boy-a',name:'Observed Boy A',sex:'M'},{id:'boy-b',name:'Observed Boy B',sex:'M'},{id:'girl',name:'Observed Girl',sex:'F'}].map(p=>({...p,userAdded:true,birthYear:2014}));
const tournaments=[...players.slice(0,2).map(p=>({...forli,playerId:p.id,playerName:p.name})),{...rotterdam,playerId:'boy-a',status:'withdrawn',draws:['Boys Singles 14 Main Draw']},{...rotterdam,playerId:'girl',status:'excluded',draws:['Girls Singles 14 Main Draw']}];
const matches=players.slice(0,2).map((p,i)=>({...forli,playerId:p.id,playerName:p.name,event:fd[i].event,drawUrl:fd[i].drawUrl,round:'RR',opponent:'Other Player',score:'6-1 6-1',result:'W',date:'2026-02-15'}));
const browser=await chromium.launch({headless:true,executablePath:process.env.COURTWATCH_TEST_CHROMIUM||undefined});
try{for(const group of ['main','others']){
 const page=await browser.newPage(),errors=[];let metadataRequests=0;page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
  if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  if(u.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Test',role:'admin'}}});
  if(u.pathname.endsWith('/app-snapshot'))return route.fulfill({json:{group,players,tournaments,matches,agenda:[]}});
  if(u.pathname.endsWith('/tournament-search')){metadataRequests++;return route.fulfill({json:{tournament:u.searchParams.get('competitionId')===rid?rotterdam:forli}});}
  if(u.pathname.endsWith('/tournament-draw-links')){const id=u.searchParams.get('competitionId');return route.fulfill({json:{circuit,competitionId:id,complete:true,draws:id===rid?rd:fd}});}
  return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
 });
 await page.goto(`https://courtwatch.test/v3.html?group=${group}#calendar`);await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.length===3&&!loadRunning);
 await page.evaluate(id=>{location.hash='#catalog-tournament/tennis-europe/'+id;},rid);
 await page.waitForFunction(()=>document.querySelectorAll('.tournamentDraws a.tournamentDrawLink').length===14);
 assert.equal(await page.locator('.tournamentPlayer').count(),0);
 assert.equal(await page.locator('.tournamentAcceptanceLink').count(),1);assert.equal(await page.locator('.tournamentAcceptanceLink').getAttribute('href'),`https://te.tournamentsoftware.com/sport/acceptancelist.aspx?id=${rid}`);
 const metadataBefore=metadataRequests;
 await page.evaluate(()=>{window.catalogueLoadingFlashes=0;window.catalogueObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.textContent?.includes('Caricamento torneo'))window.catalogueLoadingFlashes++;});window.catalogueObserver.observe(document.getElementById('profileContent'),{childList:true,subtree:true});route();route();route();});
 await page.waitForLoadState('networkidle');assert.equal(metadataRequests,metadataBefore);assert.equal(await page.evaluate(()=>window.catalogueLoadingFlashes),0);
 await page.evaluate(()=>window.catalogueObserver.disconnect());

 assert.equal(await page.locator('.tournamentDraws a').filter({hasText:/^SQ/}).count(),4);
 assert.equal(await page.locator('.tournamentDraws a').filter({hasText:/RR$/}).count(),2);
 await page.evaluate(id=>{location.hash='#catalog-tournament/tennis-europe/'+id;},fid);
 await page.waitForFunction(()=>document.querySelector('.tournamentHero h2')?.textContent.includes('Forli')&&document.querySelectorAll('.tournamentDraws a.tournamentDrawLink').length===2);
 await page.waitForLoadState('networkidle');
 const links=await page.locator('.tournamentDraws a').evaluateAll(nodes=>nodes.map(a=>({text:a.textContent,href:a.href})));
 assert.equal(links.length,2);assert.ok(links.every(a=>/^SM12 RR Group [AB]$/.test(a.text)));assert.ok(links.every(a=>/\/draw\/[12]$/.test(a.href)));

 assert.equal(await page.locator('.tournamentAcceptanceLink').count(),1);
 for(const width of [360,650,1200]){await page.setViewportSize({width,height:900});assert(await page.locator('.tournamentAcceptanceLink').evaluate(a=>{const r=a.getBoundingClientRect(),p=a.parentElement.getBoundingClientRect();return Math.abs(r.right-p.right)<2&&r.right<=innerWidth+1;}),'acceptance list must align right at '+width);}
 assert.deepEqual(errors,[]);await page.close();
}console.log('Europe full app, main and others: Rotterdam 28 draws in 14 links with two category RR links; Forli only the two observed boys groups.');}finally{await browser.close();}
