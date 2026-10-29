import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd(),snapshots={};
for(const group of ['main','others']){
 const file=group==='main'?'/tmp/courtwatch-main-snapshot.json':'/tmp/courtwatch-others-snapshot.json';
 const body=JSON.parse(await fs.readFile(file,'utf8'));
 assert.equal(body.group,group);for(const key of ['players','tournaments','matches'])assert.ok(Array.isArray(body[key]));
 snapshots[group]=body;
}
const server=http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,pathname==='/'?'v3.html':pathname.slice(1));if(!file.startsWith(root+path.sep))throw Error('path');
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain'});res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch(),page=await browser.newPage(),errors=[],requests={main:0,others:0};
page.on('pageerror',()=>errors.push('browser_exception'));
await page.route('**/app/api/**',route=>{
 const request=route.request(),url=new URL(request.url()),group=request.headers()['x-courtwatch-group']||'main';
 if(url.pathname.endsWith('/app-snapshot')){if(!snapshots[group])return route.fulfill({status:400,json:{error:'invalid_group'}});requests[group]++;return route.fulfill({json:snapshots[group]});}
 if(url.pathname.endsWith('/player-list'))return route.fulfill({json:{group,players:snapshots[group].players,membershipIds:snapshots[group].players.map(p=>p.id)}});
 if(url.pathname.endsWith('/session'))return route.fulfill({json:{user:{displayName:'Release check',role:'admin'}}});
 return route.fulfill({json:url.pathname.endsWith('/player-ranking')?{rankings:[]}:{matches:[]}});
});
const verify=async group=>{
 await page.waitForFunction(({group,count})=>typeof state!=='undefined'&&typeof PLAYER_GROUP!=='undefined'&&PLAYER_GROUP===group&&state.data?.group===group&&state.data.players?.length===count&&!groupSwitchRunning,{group,count:snapshots[group].players.length},{timeout:20000});
 await page.locator('#playersView.active').waitFor({state:'visible'});
 const rows=await page.locator('#playersList .playerRow').count();assert.equal(rows,snapshots[group].players.length);
 const identity=await page.evaluate(()=>state.data.players.map(p=>p.id).sort());assert.deepEqual(identity,snapshots[group].players.map(p=>p.id).sort());
};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/v3.html?protected=1#players',{waitUntil:'domcontentloaded'});
 await verify('main');
 await page.locator('#playersView [data-switch-player-group]').click();await verify('others');
 await page.locator('#playersView [data-switch-player-group]').click();await verify('main');
 assert.ok(requests.main>0&&requests.others>0);assert.equal(errors.length,0);
 console.log('REAL_TCL_OTHERS_SWITCH='+JSON.stringify({passed:true,mainPlayers:snapshots.main.players.length,othersPlayers:snapshots.others.players.length,requests}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
