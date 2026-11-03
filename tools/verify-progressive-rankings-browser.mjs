import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();let active;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://local.test'),api=url.pathname.slice('/app/api'.length);
  if(url.pathname.startsWith('/app/api/')){
   const x=active,json=value=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
   if(api==='/app-snapshot'){
    x.snapshots++;assert.equal(req.headers['x-courtwatch-group'],x.group);assert.equal(url.searchParams.get('streamRankings'),'1');
    res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'});res.write(JSON.stringify({type:'snapshot',data:x.snapshot})+'\n');
    await x.gate;
    res.end(JSON.stringify(x.fail?{type:'rankings_error'}:{type:'rankings',data:x.patch,durationMs:20000})+'\n');return;
   }
   if(api.startsWith('/documents/'))return json(x.documents[api.slice('/documents/'.length)]||{});
   if(api==='/player-list')return json({group:x.group,membershipIds:['progressive-player'],players:x.snapshot.players});
   if(api==='/session')return json({user:{displayName:'Test',role:'admin'}});
   if(api==='/player-ranking')return json({latestRankingDates:{G14:x.date},rankings:x.released&&!x.fail?[{category:'G14',ranking:10,ranking_date:x.date}]:[]});
   return json({matches:[],rankings:[]});
  }
  const file=path.resolve(root,url.pathname.slice(1));if(!file.startsWith(root+path.sep))throw Error('path');
  const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(body);
 }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const mobile of [false,true])for(const group of ['main','others'])for(const fail of [false,true]){
  const date=new Date().toISOString().slice(0,10),player={id:'progressive-player',name:'Progressive Player',userAdded:true,nationality:'ITA',sex:'F',birthYear:new Date().getFullYear()-13,ranking:'3.2'};
  const tournament={playerId:player.id,circuit:'tennis-europe',competitionId:'progressive-tournament',name:'Progressive Tournament',startDate:date,endDate:date};
  const match={id:'progressive-match',matchId:'progressive-match',playerId:player.id,playerName:player.name,circuit:'tennis-europe',competitionId:tournament.competitionId,tournamentName:tournament.name,date,status:'scheduled',opponent:'Progressive Opponent',draw:'GS14',event:'GS14',time:'12:00'};
  let release;const gate=new Promise(resolve=>release=resolve);
  active={group,fail,date,gate,release,snapshots:0,released:false,snapshot:{group,membershipIds:[player.id],generatedAt:new Date().toISOString(),players:[player],tournaments:[tournament],matches:[match]},patch:{group,players:[{id:player.id,tennisEuropeRanking:'n°10 TE U14',tennisEuropeRankings:{u14:10},tennisEuropeRankingDates:{u14:date},tennisEuropeLatestRankingDates:{G14:date}}],matches:[{id:match.id,matchId:match.id,playerId:player.id,playerTeRanking:10,playerTeRankingDate:date}]},documents:{'players.json':{players:[player]},'tournaments.json':{tournaments:[tournament]},'matches.json':{matches:[match]},'agenda.json':{agenda:[match]},'results.json':{results:[]},'opponents.json':{opponents:[]},'tournament_entries.json':{tournamentEntries:[]},'diagnostics.json':{overall:'green',items:[]},'manual_matches.json':{matches:[]}}};
  const context=await browser.newContext({timezoneId:'UTC',viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>{window.setInterval=()=>0;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/v3.html'+(group==='others'?'?group=others':'')+'#calendar',{waitUntil:'domcontentloaded'});
  await page.locator('#calendar .tourBand').first().waitFor({state:'visible'});
  assert.equal(active.released,false);assert.equal(active.snapshots,1);
  await page.evaluate(()=>{location.hash='#agenda'});await page.getByText('Progressive Opponent',{exact:false}).first().waitFor({state:'visible'});
  await page.evaluate(()=>{location.hash='#player/progressive-player'});await page.locator('#profileView.active').waitFor({state:'visible'});assert.match(await page.locator('#profileContent').innerText(),/Progressive Tournament/);
  assert.equal(active.released,false);active.released=true;release();
  if(!fail)await page.locator('#playerLiveRankings').filter({hasText:'n°10'}).waitFor({state:'visible'});
  else await page.waitForFunction(()=>document.querySelector('#profileContent')?.textContent.includes('Progressive Tournament'));
  assert.match(await page.locator('#profileContent').innerText(),/Progressive Tournament/);assert.equal(active.snapshots,1);assert.deepEqual(errors,[]);
  results.push({mobile,group,rankingFailure:fail,calendarBeforeRankings:true,agendaBeforeRankings:true,historyBeforeRankings:true,snapshots:active.snapshots});await context.close();
 }
 console.log('PROGRESSIVE_RANKINGS_BROWSER='+JSON.stringify(results));
}finally{active?.release?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
