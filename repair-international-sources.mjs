import fs from 'node:fs/promises';

let te=await fs.readFile('te-entries.mjs','utf8');
if(!te.includes('const TE_BASE='))te=te.replace(/(import fs[^\n]+\n)/,"$1const TE_BASE=['https:','','te.tournamentsoftware.com'].join('/');\n");
if(!te.includes('const TE_CALENDAR='))te=te.replace("const TE_BASE=['https:','','te.tournamentsoftware.com'].join('/');","const TE_BASE=['https:','','te.tournamentsoftware.com'].join('/');\nconst TE_CALENDAR=['https:','','www.tenniseurope.org','calendar','82','European-Calendar'].join('/');");
te=te.replace(/await collect\([^;\n]*\/tournaments[^;\n]*\);/,"await collect(TE_BASE+'/tournaments');");
te=te.replace(/  const url=.*?\n  await collect\(url\);/s,"  const url=TE_BASE+'/find?DateFilterType=0&StartDate='+d.toISOString().slice(0,10)+'&EndDate='+e.toISOString().slice(0,10)+'&StatusFilterID=0&page=1';\n  await collect(url);");
te=te.replace("if(/\\/sport\\/tournament|\\/tournament\\?id=/i.test(h))","if(/\\/sport\\/(?:tournament|acceptancelist)\\.aspx\\?id=|\\/tournament\\?id=/i.test(h))");
if(!te.includes('await collect(TE_CALENDAR);'))te=te.replace("await collect(TE_BASE+'/tournaments');","await collect(TE_BASE+'/tournaments');\nawait collect(TE_CALENDAR);");
if(te.includes('{{https'))throw Error('URL Tennis Europe ancora compressa');
await fs.writeFile('te-entries.mjs',te);

let itf=await fs.readFile('itf-entries.mjs','utf8');
if(!itf.includes('const ITF_SITE='))itf=itf.replace(/(import fs[^\n]+\n)/,"$1const ITF_SITE=['https:','','www.itftennis.com'].join('/');\n");
if(!itf.includes("from 'playwright'"))itf=itf.replace(/(import fs[^\n]+\n)/,"$1import { chromium } from 'playwright';\n");
if(!itf.includes('ITF_BROWSER_READY')){
  const marker="const ITF_SITE=['https:','','www.itftennis.com'].join('/');";
  const browser="\nconst ITF_BROWSER_READY=true;\nconst itfBrowser=await chromium.launch({headless:true});\nconst itfContext=await itfBrowser.newContext({userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',locale:'en-GB'});\nconst warm=await itfContext.newPage();\ntry{await warm.goto(ITF_SITE+'/en/itf-tours/world-tennis-tour-juniors/',{waitUntil:'domcontentloaded',timeout:30000});}catch{}\nawait warm.close();";
  itf=itf.replace(marker,marker+browser);
}
itf=itf.replace(/url:`[^`]*acceptance-list\/`/,"url:ITF_SITE+link+(link.endsWith('/')?'':'/')+'acceptance-list/'");
itf=itf.replace("const concurrency=24","const concurrency=4");
itf=itf.replace("const r=await fetch(url,{headers:{accept:'application/json'}});","const opts={headers:{accept:'application/json, text/plain, */*','user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','referer':ITF_SITE+'/en/itf-tours/world-tennis-tour-juniors/','x-requested-with':'XMLHttpRequest'}};const r=url.includes('GetAcceptanceList')?await itfContext.request.get(url,opts):await fetch(url,opts);");
if(!itf.includes('await itfBrowser.close();'))itf=itf.replace("await fs.writeFile('itf-sync.json'","await itfBrowser.close();\nawait fs.writeFile('itf-sync.json'");
if(itf.includes('{{https'))throw Error('URL ITF ancora compressa');
await fs.writeFile('itf-entries.mjs',itf);
