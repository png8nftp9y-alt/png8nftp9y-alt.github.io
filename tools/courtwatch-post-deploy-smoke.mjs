import fs from 'node:fs';
import { chromium } from 'playwright';

const pageUrl=String(process.env.PAGE_URL||'https://png8nftp9y-alt.github.io/').replace(/\/?$/,'/');
const appUrl=process.env.APP_URL||'https://courtwatch-app-api.ckrk9ggvrb.workers.dev/app';
const expected=fs.readFileSync('v3.html','utf8').match(/v3\.(?:js|css)\?v=\d+/g)||[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let published='';
for(let attempt=1;attempt<=8;attempt++){
  try{const response=await fetch(pageUrl+'v3.html',{cache:'no-store'});if(response.ok){published=await response.text();if(expected.every(asset=>published.includes(asset)))break}}catch{}
  if(attempt<8)await wait(5000);
}
if(!published||!expected.every(asset=>published.includes(asset)))throw new Error('GitHub Pages non espone ancora gli asset attesi: '+expected.join(', '));
console.log('✓ Pages espone gli asset attesi: '+expected.join(', '));
for(const [file,key,min] of [['players.json','players',1],['tournaments.json','tournaments',1],['agenda.json','agenda',0]]){
  const response=await fetch(pageUrl+'dist/v3/'+file+'?shield='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('Dataset pubblicato non leggibile: '+file+' HTTP '+response.status);
  const doc=await response.json(),rows=doc[key];
  if(!Array.isArray(rows)||rows.length<min)throw new Error('Dataset pubblicato vuoto o invalido: '+file);
}
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),browserErrors=[];
const testHtml=published.replace(/<script>if\(location\.hostname===\"png8nftp9y-alt\.github\.io\"\)location\.replace\([\s\S]*?<\/script>/,'');
await page.route('**/v3.html?shield=*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:testHtml}));
page.on('pageerror',error=>browserErrors.push(String(error)));
try{
  let populated=false,lastState={};
  for(let attempt=1;attempt<=3&&!populated;attempt++){
    await page.goto(pageUrl+'v3.html?shield='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
    try{await page.waitForFunction(()=>document.querySelectorAll('#playersList [data-profile]').length>0&&document.querySelectorAll('#calendar .tourBand').length>0,null,{timeout:30000});populated=true}catch{}
    lastState=await page.evaluate(()=>({players:document.querySelectorAll('#playersList [data-profile]').length,tournaments:document.querySelectorAll('#calendar .tourBand').length,status:document.querySelector('#syncStatus')?.textContent||'',alert:document.querySelector('#dataAlert')?.textContent||''}));
    if(!populated&&attempt<3)await wait(5000);
  }
  if(!populated)throw new Error('App pubblicata non popolata dopo tre aperture: '+JSON.stringify(lastState)+'; browser='+browserErrors.join(' | '));
  if(browserErrors.length)throw new Error('App pubblicata con errori browser: '+browserErrors.join(' | '));
  if(await page.locator('#syncStatus.fallback').count())throw new Error('App pubblicata ferma sulla copia locale di fallback');
  console.log('✓ App pubblicata carica dati reali e contenuto visibile');
}finally{await browser.close()}
const access=await fetch(appUrl,{redirect:'manual',cache:'no-store'});
if(![301,302,303,307,308,401,403].includes(access.status))throw new Error('Accesso anonimo inatteso: HTTP '+access.status);
console.log('✓ Accesso anonimo bloccato: HTTP '+access.status);
