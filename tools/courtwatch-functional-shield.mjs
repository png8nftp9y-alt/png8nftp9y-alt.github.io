import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd(),artifacts=path.join(root,'artifacts');
const players=JSON.parse(await fs.readFile(path.join(root,'dist/v3/players.json'),'utf8')).players;
const tournaments=JSON.parse(await fs.readFile(path.join(root,'dist/v3/tournaments.json'),'utf8')).tournaments;
const matches=JSON.parse(await fs.readFile(path.join(root,'dist/v3/agenda.json'),'utf8')).agenda;
const playerCount=players.length;
await fs.mkdir(artifacts,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'v3.html':pathname.replace(/^\//,'');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep))throw new Error('invalid path');
    const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
await page.addInitScript(()=>{window.setInterval=()=>0});
page.setDefaultTimeout(10000);
const errors=[],analysis=new Map(),checks=[],otherPlayers=new Map();
const otherPerson={id:'shield-other',name:'Test Other',sourceKey:'itf|id:800000001',sourceCircuit:'itf',worldTennisId:'800000001',userAdded:true,nationality:'ITA',club:'Tennis Club Demo'};
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error'&&!/favicon|404/.test(message.text()))errors.push(message.text())});
await page.route('https://courtwatch-app-api.ckrk9ggvrb.workers.dev/v1/app-snapshot**',route=>route.fulfill({json:{generatedAt:new Date(0).toISOString(),players:[{id:'shield-projection'}],tournaments:[],matches:[]}}));
// Exercise the proposed commit's data, independently of the deployed site.
await page.route('https://png8nftp9y-alt.github.io/dist/v3/**',async route=>{
  const file=path.basename(new URL(route.request().url()).pathname);
  try{
    const body=await fs.readFile(path.join(root,'dist/v3',file));
    return route.fulfill({body,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'}});
  }catch{return route.fulfill({status:404,body:'not found',headers:{'Access-Control-Allow-Origin':'*'}})}
});
await page.route('**/app/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),api=url.pathname.replace(/^\/app\/api/,'');
  if(api==='/session')return route.fulfill({json:{user:{id:'shield-user',email:'shield@courtwatch.test',displayName:'CourtWatch Shield',role:'admin'}}});
  const group=request.headers()['x-courtwatch-group']||'main';
  if(api==='/app-snapshot'&&group==='main')return route.fulfill({json:{group,players,tournaments,matches,agenda:matches}});
  if(api==='/player-list')return route.fulfill({json:{group,players:group==='others'?[...otherPlayers.values()]:players}});
  if(api==='/player-ranking')return route.fulfill({json:{rankings:[]}});
  if(api==='/app-snapshot'&&group==='others')return route.fulfill({json:{group,generatedAt:new Date().toISOString(),players:[...otherPlayers.values()],tournaments:[...otherPlayers.values()].map(p=>({playerId:p.id,name:'Torneo Demo',competitionId:'shield-demo',circuit:'itf',startDate:new Date().toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10)})),matches:[]}});
  if(api==='/player-search')return route.fulfill({json:{results:[{sourceKey:otherPerson.sourceKey,identity:otherPerson.worldTennisId,name:otherPerson.name,circuit:'itf'}],nextCursor:null}});
  if(api==='/courtwatch-player'&&request.method()==='POST'){
    requireCheck(group==='others','aggiunta inviata al gruppo Altri');
    otherPlayers.set(otherPerson.id,otherPerson);
    return route.fulfill({json:{added:true,player:otherPerson,playerId:otherPerson.id,group}});
  }
  if(api==='/courtwatch-player'&&request.method()==='DELETE'){
    requireCheck(group==='others','rimozione inviata al gruppo Altri');
    otherPlayers.delete(url.searchParams.get('playerId'));
    return route.fulfill({json:{removed:true,playerId:otherPerson.id,group}});
  }
  if(api==='/match-analysis-status')return route.fulfill({json:{matches:[...analysis.keys()].map(matchKey=>({matchKey,updatedAt:new Date().toISOString()}))}});
  if(api==='/match-analysis'){
    const body=request.method()==='PUT'?JSON.parse(request.postData()||'{}'):null,key=body?.matchKey||url.searchParams.get('matchKey')||'';
    if(request.method()==='PUT'){analysis.set(key,body.analysis);return route.fulfill({json:{matchKey:key,analysis:body.analysis,updatedAt:new Date().toISOString()}})}
    if(request.method()==='DELETE'){analysis.delete(key);return route.fulfill({json:{success:true,matchKey:key}})}
    return route.fulfill({json:{matchKey:key,analysis:analysis.get(key)||'',updatedAt:null}});
  }
  return route.fulfill({status:404,json:{error:'not_found'}});
});
const requireCheck=(condition,name,detail='')=>{if(!condition)throw new Error(name+(detail?': '+detail:''));checks.push({name,status:'pass',detail});console.log('PASS '+name)};
const openSection=async section=>{
  await page.locator(`[data-home-route="${section}"]:visible`).first().click();
  await page.locator(`#${section}View.active`).waitFor({state:'visible'});
};
try{
  const appSource=await fs.readFile(path.join(root,'v3.js'),'utf8');
  requireCheck(appSource.includes('${agendaDrawCodeHtml(m,itemTournament)}</div><${whenTag} class="agendaWhenDetails'),'sigla evento linkata al tabellone nella colonna sinistra');
  requireCheck(appSource.includes('agendaRoundOopLink')&&appSource.includes('agendaWhenDetails${oopUrl'), 'collegamenti OOP separati dal link tabellone');
  await page.goto(base+'/v3.html',{waitUntil:'domcontentloaded',timeout:30000});
  await openSection('players');
  await page.waitForFunction(n=>document.querySelectorAll('#playersList [data-profile]').length===n,playerCount,{timeout:15000});
  requireCheck(await page.locator('#playersList [data-profile]').count()===playerCount,'giocatori del dataset');
  await page.locator('#brandHome').click();await page.locator('#homeView.active').waitFor({state:'visible'});
  requireCheck(await page.locator('#homeView.active').isVisible(),'home con sezioni');
  await openSection('calendar');
  requireCheck(await page.locator('#calendar .tourBand').count()>0,'calendario popolato');
  requireCheck(await page.locator('#playerFilters button').count()===playerCount,'filtri giocatori');
  requireCheck(await page.locator('#toggleAll').isVisible(),'filtri nella pagina calendario');
  await page.locator('#toggleAll').click();await page.locator('#toggleAll').click();
  requireCheck(await page.locator('#accountMenuButton').isVisible(),'menu account');
  await page.locator('#accountMenuButton').click();
  requireCheck(!(await page.locator('#accountMenu').getAttribute('hidden')),'logout disponibile');
  await page.locator('#accountMenuButton').click();
  await openSection('players');

  const rows=page.locator('#playersList [data-profile]');let analysisButton=null;
  for(let i=0;i<await rows.count();i++){
    await rows.nth(i).click();await page.waitForTimeout(100);
    if(await page.locator('#profileView.active').count()){
      const toggles=page.locator('.profileTournament:visible .tournamentToggle:visible');
      for(let j=0;j<await toggles.count();j++){
        if(await page.locator('[data-match-analysis]:visible').count()){analysisButton=page.locator('[data-match-analysis]:visible').first();break}
        await toggles.nth(j).click();await page.waitForTimeout(30);
      }
      if(!analysisButton&&await page.locator('[data-match-analysis]:visible').count())analysisButton=page.locator('[data-match-analysis]:visible').first();
    }
    if(analysisButton)break;
    await page.locator('#backHome').click();await page.locator('#playersView.active').waitFor({state:'visible'});
  }
  requireCheck(Boolean(analysisButton),'profilo e partite');
  requireCheck(await page.locator('#profileCircuitFilter').count()===1,'filtro circuito profilo');
  requireCheck(await page.locator('#profileTournamentStatusFilter').count()===0,'filtro stato tornei rimosso');
  requireCheck(appSource.includes("stats.innerHTML='<span class=\"scheduledTournamentLabel\">PROGRAMMATO</span>'"),'programmato senza freccia');
  requireCheck(appSource.includes("statSpans[0].hidden=profileOutcomeFilter!=='all'"),'statistiche torneo sincronizzate con esito');
  requireCheck(/today\s*:\s*iso\(new Date\(\)\)/.test(appSource),'transizione giornaliera stato torneo');

  await analysisButton.click();
  const editor=page.locator('#matchAnalysisEditor'),text=editor.locator('.analysisEditorText');
  await text.fill('Verifica automatica Scudo CourtWatch');
  await editor.locator('.analysisEditorSave').click();
  await page.waitForFunction(()=>document.querySelector('#matchAnalysisEditor')?.hidden===true);
  await analysisButton.click();await page.waitForFunction(()=>document.querySelector('.analysisEditorText')?.value==='Verifica automatica Scudo CourtWatch');
  await editor.locator('.analysisEditorDelete').click();
  await page.waitForFunction(()=>document.querySelector('#matchAnalysisEditor')?.hidden===true);
  requireCheck(analysis.size===0,'CRUD UI completo e pulito');

  const tournament=page.locator('[data-open-tournament]:visible').first();
  if(await tournament.count()){await tournament.click();await page.waitForTimeout(100);requireCheck(await page.locator('#profileView.active').count()===1,'dettaglio torneo')}
  await page.locator('#brandHome').click();await page.locator('#homeView.active').waitFor({state:'visible'});
  requireCheck(await page.locator('#homeView.active').isVisible(),'logo torna alla home');
  await openSection('agenda');
  const agendaDate=await page.locator('#agendaToday').textContent();
  await page.locator('#nextAgenda').click();await page.locator('#prevAgenda').click();
  requireCheck(await page.locator('#dailyAgenda').isVisible()&&await page.locator('#agendaToday').textContent()===agendaDate,'navigazione agenda');

  await page.setViewportSize({width:390,height:844});
  for(const section of ['calendar','players','agenda']){
    await openSection(section);
    requireCheck(await page.locator(`#${section}View`).isVisible(),'layout mobile '+section);
  }
  await page.locator('#brandHome').click();await page.locator('#homeView.active').waitFor({state:'visible'});
  requireCheck(await page.locator('#homeView').isVisible(),'layout mobile home');
  requireCheck(await page.locator('[data-switch-player-group]').count()===4,'quattro accessi alla sezione parallela');
  await page.locator('#homeOthers').click();await page.waitForURL(url=>url.searchParams.get('group')==='others',{waitUntil:'domcontentloaded'});
  await openSection('players');
  await page.waitForFunction(()=>document.querySelector('#playerTotal')?.textContent==='0');
  requireCheck(await page.locator('#activePlayerGroup').isVisible(),'sezione Altri riconoscibile');
  requireCheck(await page.locator('#playersList [data-profile]').count()===0,'Altri inizialmente vuoto');
  await page.locator('#addPlayer').click();await page.locator('#addPlayerQuery').fill(otherPerson.name);
  await page.locator('[data-add-player-search]').evaluate(form=>form.requestSubmit());
  await page.locator('#addPlayerDialog [data-search-player]').first().click();
  await page.waitForFunction(()=>location.hash==='#player/shield-other');
  requireCheck(await page.locator('#profileContent').textContent().then(s=>s.includes('Torneo Demo')),'Altri usa scheda e tornei condivisi');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#profileView.active').waitFor({state:'visible'});
  await openSection('players');await page.waitForFunction(()=>document.querySelector('#playerTotal')?.textContent==='1');
  requireCheck(await page.locator('#playersList [data-profile]').count()===1,'Altri conservato dopo ricarica');
  await page.locator('#playersView [data-switch-player-group]').click();await page.waitForURL(url=>!url.searchParams.has('group'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(n=>document.querySelector('#playerTotal')?.textContent===String(n),playerCount);
  requireCheck(await page.locator('#playersList [data-profile="shield-other"]').count()===0,'aggiunta Altri non modifica TCL');
  requireCheck(await page.locator('#playersView.active').isVisible()&&new URL(page.url()).hash==='#players','Altri → TCL conserva pagina Giocatori');
  await page.setViewportSize({width:390,height:500});
  await openSection('calendar');await page.locator('#nextCalendarMonth').click();await page.locator('#calendarSex').selectOption('F');
  const mirrorMonth=await page.locator('#calendarMonthLabel').textContent();
  await page.evaluate(()=>scrollTo(0,80));
  const mirrorScroll=await page.evaluate(()=>scrollY);
  requireCheck(mirrorScroll>0,'calendario sorgente con posizione di scroll verificabile');
  await page.locator('#calendarView [data-switch-player-group]').evaluate(button=>button.click());
  await page.waitForURL(url=>url.searchParams.get('group')==='others'&&url.hash==='#calendar',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#playerFilters button').length===1);
  await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,mirrorScroll);
  requireCheck(await page.locator('#calendarView.active').isVisible(),'TCL → Altri conserva Calendario');
  requireCheck(await page.locator('#calendarMonthLabel').textContent()===mirrorMonth&&await page.locator('#calendarSex').inputValue()==='F','Calendario speculare conserva mese e filtro');
  requireCheck(await page.locator('#calendarView [data-switch-player-group]').textContent()==='Vai a TCL','etichetta TCL nel calendario Altri');
  await page.locator('#calendarView [data-switch-player-group]').evaluate(button=>button.click());
  await page.waitForURL(url=>!url.searchParams.has('group')&&url.hash==='#calendar',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(n=>document.querySelectorAll('#playerFilters button').length===n,playerCount);
  await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,mirrorScroll);
  requireCheck(await page.locator('#calendarMonthLabel').textContent()===mirrorMonth,'Altri → TCL conserva Calendario e posizione');
  await openSection('players');
  await page.locator('#playersView [data-switch-player-group]').click();await page.waitForURL(url=>url.searchParams.get('group')==='others'&&url.hash==='#players',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#playerTotal')?.textContent==='1');
  await page.locator('#removePlayer').click();await page.locator('[data-remove-player="shield-other"]').click();
  await page.locator('[data-removal-yes]').click();await page.waitForFunction(()=>document.querySelector('#playerTotal')?.textContent==='0');
  requireCheck(otherPlayers.size===0,'rimozione Altri persistente');
  await page.locator('#brandHome').click();await page.locator('#homeView.active').waitFor({state:'visible'});
  requireCheck(errors.length===0,'nessun errore browser',errors.join(' | '));
  await page.screenshot({path:path.join(artifacts,'courtwatch-shield-ui.png'),fullPage:true});
  await fs.writeFile(path.join(artifacts,'courtwatch-shield-ui.json'),JSON.stringify({generatedAt:new Date().toISOString(),passed:true,checks},null,2)+'\n');
  console.log('CourtWatch Shield E2E: '+checks.length+' controlli superati.');
}catch(error){
  await page.screenshot({path:path.join(artifacts,'courtwatch-shield-ui-failure.png'),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(artifacts,'courtwatch-shield-ui.json'),JSON.stringify({generatedAt:new Date().toISOString(),passed:false,checks,errors:[...errors,String(error)]},null,2)+'\n');
  throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
