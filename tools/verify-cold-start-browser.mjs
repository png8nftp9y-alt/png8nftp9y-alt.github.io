import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

// Fresh browser contexts model the first app landing after Access authentication.
// No saved projections, external network, live user data or background timers.
const root=process.cwd();
const server=http.createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://local.test').pathname.slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))throw Error('invalid path');
  const body=await fs.readFile(file),type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const mobile of [false,true])for(const group of ['main','others']){
  const context=await browser.newContext({timezoneId:'UTC',viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();await page.addInitScript(()=>{window.setInterval=()=>0;});
  const date=new Date().toISOString().slice(0,10),player={id:'cold-player',name:'Cold Player',userAdded:true,nationality:'ITA',club:'Verified Club',ranking:'3.2',membershipCard:'1234567890'};
  const tournament={playerId:player.id,circuit:'tennis-europe',competitionId:'cold-tournament',name:'Cold Tournament',startDate:date,endDate:date};
  const match={id:'cold-match',matchId:'cold-match',playerId:player.id,playerName:player.name,circuit:'tennis-europe',competitionId:tournament.competitionId,tournamentName:tournament.name,date,status:'scheduled',opponent:'Cold Opponent',draw:'GS14',time:'12:00'};
  const startupDocuments={players:{players:[player]},tournaments:{tournaments:[tournament]},matches:{matches:[match]},agenda:{agenda:[match]},results:{results:[]},opponents:{opponents:[]},entries:{tournamentEntries:[]},status:{},diagnostics:{overall:'green',items:[]},manual:{matches:[]}};
  let snapshots=0,scoped=0,documents=0,release;const gate=new Promise(resolve=>release=resolve),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/app/api/**',async route=>{
   const url=new URL(route.request().url()),api=url.pathname.slice('/app/api'.length);
   if(api==='/app-snapshot'){
    assert.equal(route.request().headers()['x-courtwatch-group'],group);
    const body={group,membershipIds:[player.id],generatedAt:new Date().toISOString(),players:[player],tournaments:[tournament],matches:[match]};
    if(url.searchParams.has('playerId')){scoped++;return route.fulfill({json:{...body,playerId:player.id}});}
    snapshots++;await gate;return route.fulfill({json:body});
   }
   if(api.startsWith('/documents/')){documents++;const names={players:'players.json',tournaments:'tournaments.json',matches:'matches.json',agenda:'agenda.json',results:'results.json',opponents:'opponents.json',entries:'tournament_entries.json',status:'sync_status.json',diagnostics:'diagnostics.json',manual:'manual_matches.json'};const field=Object.keys(names).find(key=>names[key]===api.slice('/documents/'.length));return route.fulfill({json:startupDocuments[field]||{}});}
   if(api==='/player-list')return route.fulfill({json:{group,membershipIds:[player.id],players:[player]}});
   if(api==='/session')return route.fulfill({json:{user:{displayName:'Cold test',role:'admin'}}});
   return route.fulfill({json:{matches:[],rankings:[]}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/v3.html'+(group==='others'?'?group=others':'')+'#calendar',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#calendarView.active'));
  release();
  await page.locator('#calendar .tourBand').first().waitFor({state:'visible'});
  await page.evaluate(()=>{location.hash='#agenda';});
  await page.getByText('Cold Opponent',{exact:false}).first().waitFor({state:'visible'});
  await page.evaluate(()=>{location.hash='#player/cold-player';});
  await page.locator('#profileView.active').waitFor({state:'visible'});
  assert.match(await page.locator('#profileContent').innerText(),/Cold Tournament/);
  assert.match(await page.locator('#profileContent').innerText(),/3\.2/);
  assert.equal(snapshots,1);assert.equal(scoped,0);assert.equal(documents,10);assert.deepEqual(errors,[]);
  results.push({mobile,group,fullSnapshots:snapshots,scopedSnapshots:scoped,documentRequests:documents,calendar:true,agenda:true,history:true});
  await context.close();
 }
 console.log('COLD_START_BROWSER='+JSON.stringify(results));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
