import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd(),artifacts=path.join(root,'artifacts');
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
const errors=[],analysis=new Map(),checks=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error'&&!/favicon|404/.test(message.text()))errors.push(message.text())});
await page.route('**/app/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),api=url.pathname.replace(/^\/app\/api/,'');
  if(api==='/session')return route.fulfill({json:{user:{id:'shield-user',email:'shield@courtwatch.test',displayName:'CourtWatch Shield',role:'admin'}}});
  if(api==='/match-analysis-status')return route.fulfill({json:{matches:[...analysis.keys()].map(matchKey=>({matchKey,updatedAt:new Date().toISOString()}))}});
  if(api==='/match-analysis'){
    const body=request.method()==='PUT'?JSON.parse(request.postData()||'{}'):null,key=body?.matchKey||url.searchParams.get('matchKey')||'';
    if(request.method()==='PUT'){analysis.set(key,body.analysis);return route.fulfill({json:{matchKey:key,analysis:body.analysis,updatedAt:new Date().toISOString()}})}
    if(request.method()==='DELETE'){analysis.delete(key);return route.fulfill({json:{success:true,matchKey:key}})}
    return route.fulfill({json:{matchKey:key,analysis:analysis.get(key)||'',updatedAt:null}});
  }
  return route.fulfill({status:404,json:{error:'not_found'}});
});
const requireCheck=(condition,name,detail='')=>{if(!condition)throw new Error(name+(detail?': '+detail:''));checks.push({name,status:'pass',detail})};
try{
  await page.goto(base+'/v3.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('#playersList [data-profile]').length>=23&&document.querySelectorAll('#calendar .tourBand').length>0,null,{timeout:45000});
  requireCheck(await page.locator('#playersList [data-profile]').count()===23,'23 giocatori');
  requireCheck(await page.locator('#calendar .tourBand').count()>0,'calendario popolato');
  requireCheck(await page.locator('#playerFilters button').count()===23,'filtri giocatori');
  await page.locator('#toggleAll').click();await page.locator('#toggleAll').click();
  requireCheck(await page.locator('#accountMenuButton').isVisible(),'menu account');
  await page.locator('#accountMenuButton').click();
  requireCheck(!(await page.locator('#accountMenu').getAttribute('hidden')),'logout disponibile');

  const rows=page.locator('#playersList [data-profile]');let analysisButton=null;
  for(let i=0;i<Math.min(23,await rows.count());i++){
    await rows.nth(i).click();await page.waitForTimeout(100);
    if(await page.locator('#profileView.active').count()&&await page.locator('[data-match-analysis]').count()){analysisButton=page.locator('[data-match-analysis]').first();break}
    await page.locator('#backHome').click();await page.waitForTimeout(50);
  }
  requireCheck(Boolean(analysisButton),'profilo e partite');
  requireCheck(await page.locator('#profileCircuitFilter').count()===1,'filtro circuito profilo');
  requireCheck(await page.locator('#profileTournamentStatusFilter').count()===1,'filtro stato tornei');

  await analysisButton.click();
  const editor=page.locator('#matchAnalysisEditor'),text=editor.locator('.analysisEditorText');
  await text.fill('Verifica automatica Scudo CourtWatch');
  await editor.locator('.analysisEditorSave').click();
  await page.waitForFunction(()=>document.querySelector('#matchAnalysisEditor')?.hidden===true);
  await analysisButton.click();await page.waitForFunction(()=>document.querySelector('.analysisEditorText')?.value==='Verifica automatica Scudo CourtWatch');
  await editor.locator('.analysisEditorDelete').click();
  await page.waitForFunction(()=>document.querySelector('#matchAnalysisEditor')?.hidden===true);
  requireCheck(analysis.size===0,'CRUD UI completo e pulito');

  const tournament=page.locator('[data-open-tournament]').first();
  if(await tournament.count()){await tournament.click();await page.waitForTimeout(100);requireCheck(await page.locator('#profileView.active').count()===1,'dettaglio torneo')}
  await page.locator('#resetHome').click();await page.waitForTimeout(100);
  requireCheck(await page.locator('#homeView.active').count()===1,'Home Oggi');
  await page.locator('#nextAgenda').click();await page.locator('#prevAgenda').click();
  requireCheck(await page.locator('#dailyAgenda').count()===1,'navigazione agenda');

  await page.setViewportSize({width:390,height:844});
  requireCheck(await page.locator('#homeView').isVisible(),'layout mobile');
  requireCheck(errors.length===0,'nessun errore browser',errors.join(' | '));
  await page.screenshot({path:path.join(artifacts,'courtwatch-shield-ui.png'),fullPage:true});
  await fs.writeFile(path.join(artifacts,'courtwatch-shield-ui.json'),JSON.stringify({generatedAt:new Date().toISOString(),passed:true,checks},null,2)+'\n');
  console.log('CourtWatch Shield E2E: '+checks.length+' controlli superati.');
}catch(error){
  await page.screenshot({path:path.join(artifacts,'courtwatch-shield-ui-failure.png'),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(artifacts,'courtwatch-shield-ui.json'),JSON.stringify({generatedAt:new Date().toISOString(),passed:false,checks,errors:[...errors,String(error)]},null,2)+'\n');
  throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
