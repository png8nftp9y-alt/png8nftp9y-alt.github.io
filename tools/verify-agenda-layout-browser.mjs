import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const assets=Object.fromEntries(await Promise.all(['v3.html','v3.css','v3.js'].map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')])));
const players=[
 {id:'layout-a',name:'Alexandre Maximilien de la Rochefoucauld'},
 {id:'layout-b',name:'Maria Alexandra Constantinopoulos'},
 {id:'layout-c',name:'Jean-Baptiste LongUnbrokenSurnameForLayoutVerification'},
].map((p,i)=>({...p,userAdded:true,birthYear:i===1?2014:2012,sex:i===1?'M':'F'}));
const tournament={competitionId:'layout-europe',name:'International European Junior Championship with a long tournament name',location:'Saint-Georges-de-Commiers, Francia',circuit:'tennis-europe',startDate:'2026-09-20',endDate:'2026-09-27',surface:'Clay',environment:'Outdoor'};
const matches=players.map((p,i)=>({id:'layout-match-'+i,playerId:p.id,playerName:p.name,competitionId:tournament.competitionId,tournamentName:tournament.name,circuit:'tennis-europe',date:'2026-09-21',time:'10:30',court:i===0?'Campo centrale internazionale Saint-Georges-de-Commiers':'Court '+(i+1),courtMatchNumber:2,playerNationality:'FRA',playerTeRanking:1234,partnerNationalities:['NED'],partnerTeRankings:[234],opponentNationalities:['GER','ESP'],opponentTeRankings:[100,1000],event:i===1?'GD14 - Girls Doubles 14 Main Draw':'GS14 - Girls Singles 14 Main Draw',round:'Quarter final',matchType:i===1?'doubles':'singles',partner:i===1?'Anastasia Marie-Louise Papadopoulou':'',opponent:i===1?'VeryLongOpponentSurnameWithoutSpaces / Alexandra Constantinopoulos':'Alexandra Maria de la Rochefoucauld',score:'6-7(12) 7-6(10) 10-8',result:'6-7(12) 7-6(10) 10-8',advances:i!==1}));
const engine=process.env.COURTWATCH_LAYOUT_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,executablePath:engine===chromium?process.env.COURTWATCH_TEST_CHROMIUM||undefined:undefined});
try{
 for(const group of ['main','others']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{window.setInterval=()=>0;});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
   if(assets[name])return route.fulfill({body:assets[name],contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});
   if(url.pathname.endsWith('/app-snapshot'))return route.fulfill({json:{group,players,tournaments:players.map(p=>({...tournament,playerId:p.id})),matches,agenda:matches}});
   if(url.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Layout Fixture',role:'admin'}}});
   return route.fulfill({json:{players:[],tournaments:[],matches:[],agenda:[],results:[],rankings:[]}});
  });
  await page.goto('http://courtwatch.test/v3.html?group='+group+'#agenda');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state.data?.players?.some(p=>p.id==='layout-a')&&!loadRunning);
  // Exercise date links, selective rendering, filters and reload persistence.
  for(const width of [320,390,1280]){
  await page.evaluate(()=>{
   window.navigationRenderCalls={};
   for(const name of ['renderAgenda','renderCalendar','renderPlayers','groups']){
    const original=window[name];
    window[name]=function(...args){navigationRenderCalls[name]=(navigationRenderCalls[name]||0)+1;return original.apply(this,args);};
   }
  });
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>{state.month=new Date(2026,8,1,12);location.hash='calendar';renderHome();});
   await page.locator('#calendarView.active').waitFor();
   await page.evaluate(()=>{navigationRenderCalls={};});
   await page.locator('.calDay[data-date="2026-09-21"]').click();
   await page.waitForFunction(()=>location.hash==='#agenda'&&document.querySelector('#agendaView.active'));
   assert.equal(await page.evaluate(()=>iso(state.agenda)),'2026-09-21');
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),3);
   assert.deepEqual(await page.evaluate(()=>navigationRenderCalls),{renderAgenda:1,groups:1},'day click must render Agenda once without rebuilding Calendar, Players or per-match tournament groups');
   await page.locator('#weeklyAgendaToggle').click();
   assert.equal(await page.locator('#weeklyAgendaContent .weeklyTournament').count(),1);
   await page.locator('#weeklyAgendaToggle').click();
   await page.locator('#agendaDemographicFilter summary').click();
   await page.evaluate(()=>{navigationRenderCalls={};});
   await page.locator('#quickSectionNav [data-home-route="players"]').click();
   await page.locator('#playersView.active').waitFor();
   assert.deepEqual(await page.evaluate(()=>navigationRenderCalls),{renderPlayers:1},'Players navigation must not rebuild hidden Agenda or Calendar');
   await page.evaluate(()=>{navigationRenderCalls={};});
   await page.locator('#brandHome').click();
   await page.locator('#homeView.active').waitFor();
   assert.deepEqual(await page.evaluate(()=>navigationRenderCalls),{},'Home launcher must not rebuild hidden data sections');
   await page.locator('#homeView [data-home-route="calendar"]').click();
   await page.locator('#calendarView.active').waitFor();
   await page.locator('.calDay[data-date="2026-09-21"]').click();
   await page.locator('#agendaView.active').waitFor();
   await page.locator('#agendaDemographicFilter summary').click();
   await page.locator('#agendaDemographicFilter [value="U14"]').check();
   await page.locator('#agendaSex').selectOption('F');
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),2);
   assert.equal(await page.locator('#calendarSex').inputValue(),'F');
   assert.equal(await page.locator('#calendarCategory [value="U14"]').isChecked(),true);
   await page.locator('#agendaPlayerFilter summary').click();
   await page.waitForFunction(()=>!document.querySelector('#agendaDemographicFilter').open);
   await page.locator('[data-agenda-player="layout-a"]').uncheck();
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),1);
   assert.deepEqual(await page.evaluate(()=>[...state.selected]),['layout-c']);
   assert.equal(await page.locator('#playerFilters [data-filter="layout-c"]').getAttribute('class'),'chip selected');
   const menuBounds=await page.locator('#agendaPlayerFilter .agendaFilterMenu').boundingBox();
   assert.ok(menuBounds.x>=0&&menuBounds.x+menuBounds.width<=width+1,`dropdown must fit ${width}px`);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#agendaPlayerFilter').getAttribute('open'),null);
   await page.reload();
   await page.waitForFunction(()=>typeof state!=='undefined'&&state.data&&!loadRunning);
   assert.equal(await page.evaluate(()=>iso(state.agenda)),'2026-09-21');
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),1);
   assert.deepEqual(await page.evaluate(()=>[...state.selected]),['layout-c']);
   await page.locator('#agendaPlayerFilter summary').click();
   await page.locator('#agendaSelectAll').click();
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),3);
   assert.equal(await page.locator('#agendaSex').inputValue(),'all');
   await page.locator('#agendaDeselectAll').click();
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),0);
   await page.locator('#agendaSelectAll').click();
   await page.locator('#agendaPlayerFilter summary').click();
   await page.locator('#agendaDemographicFilter summary').click();
   await page.locator('#agendaDemographicFilter [value="U12"]').check();
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),1);
   await page.locator('#agendaResetDemographics').click();
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),3);
   await page.locator('#agendaDemographicFilter summary').click();
  }
  for(const mode of ['chronological','tournament'])for(const width of [320,375,390,650,768,900,1000,1280,1440]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(({matches,mode})=>{state.agenda=new Date(2026,8,21,12);state.agendaMode=mode;state.data.agenda=matches;state.selected=new Set(matches.map(m=>m.playerId));renderAgenda();},{matches,mode});
   assert.equal(await page.locator('#dailyAgenda .agendaItem').count(),3);
   assert.equal(await page.evaluate(()=>{
    const header=document.querySelector('#dailyAgenda .agendaTournamentHead,#dailyAgenda .agendaChronologicalTournament');
    const match=document.querySelector('#dailyAgenda .agendaItem');
    return Boolean(header&&match&&getComputedStyle(header).backgroundColor!==getComputedStyle(match).backgroundColor);
   }),true,`${group}/${mode}: tournament and match rows need different backgrounds`);
   const problems=await page.evaluate(()=>{
    const bad=[],visible=e=>e.getClientRects().length>0,inside=(a,b)=>a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;
    const root=document.querySelector('#dailyAgenda');
    const cardBox=root.closest('.agendaCard').getBoundingClientRect();
    for(const button of document.querySelectorAll('.agendaNav button'))if(visible(button)&&!inside(button.getBoundingClientRect(),cardBox))bad.push('date navigation outside agenda card');
    if(root.scrollWidth>root.clientWidth+1)bad.push('agenda horizontal overflow');
    for(const card of root.querySelectorAll('.agendaItem')){
     const bounds=card.getBoundingClientRect(),when=card.querySelector('.agendaWhen'),body=card.querySelector('.agendaMatchBody');
     if(!inside(when.getBoundingClientRect(),bounds)||!inside(body.getBoundingClientRect(),bounds))bad.push('column outside match');
     if(when.getBoundingClientRect().right>body.getBoundingClientRect().left+1)bad.push('columns overlap');
     for(const region of [when,body]){
      const box=region.getBoundingClientRect();for(const badge of region.querySelectorAll('.nationality,.countryFlag'))if(visible(badge)&&!inside(badge.getBoundingClientRect(),box))bad.push('flag outside column');
      const walker=document.createTreeWalker(region,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
       const node=walker.currentNode;if(!node.textContent.trim()||!visible(node.parentElement))continue;
       const range=document.createRange();range.selectNodeContents(node);
       for(const rect of range.getClientRects())if(rect.width&&rect.height&&!inside(rect,box))bad.push('text outside column: '+node.textContent.trim().slice(0,60));
      }
     }
    }
    for(const head of root.querySelectorAll('.agendaTournamentHead,.agendaChronologicalTournament')){
     const box=head.getBoundingClientRect();for(const child of head.children)if(visible(child)&&!inside(child.getBoundingClientRect(),box))bad.push('tournament header overflow');
    }
    return [...new Set(bad)];
   });
   assert.deepEqual(problems,[],`${group}/${mode}/${width}px: ${problems.join('; ')}`);
   if(process.env.COURTWATCH_LAYOUT_CAPTURE&&group==='others'&&mode==='tournament'&&[390,1280].includes(width))await page.screenshot({path:process.env.COURTWATCH_LAYOUT_CAPTURE+'-'+width+'.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({group,engine:engine.name(),agendaDate:'2026-09-21',modes:2,widths:9,dropdownPlayers:'passed',demographicFilters:'passed',calendarDayLink:'passed',filterReload:'passed',contrastingHeaders:'passed',longNames:'passed',courtLabels:'passed',doubles:'passed',noTextOverlap:'passed'}));await page.close();
 }
}finally{await browser.close();}
