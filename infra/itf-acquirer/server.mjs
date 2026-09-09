import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const PORT=Number(process.env.PORT||8788),TOKEN=String(process.env.ITF_ACQUIRER_TOKEN||''),PROFILE_DIR=process.env.ITF_BROWSER_PROFILE_DIR||'/data/chrome-profile',CACHE_DIR=process.env.ITF_BROWSER_CACHE_DIR||'/data/response-cache',MIN_DELAY_MS=Number(process.env.ITF_BROWSER_MIN_DELAY_MS||1200),TIMEOUT_MS=Number(process.env.ITF_BROWSER_TIMEOUT_MS||30000),CACHE_TTL_MS=Number(process.env.ITF_BROWSER_CACHE_TTL_MS||12*60*1000),ALLOWED_HOST='www.itftennis.com',ALLOWED_PATH='/tennis/api/TournamentApi/';
let lastRequestAt=0,chain=Promise.resolve();
function send(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(text)});res.end(text)}
function allowed(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!==ALLOWED_HOST||!url.pathname.startsWith(ALLOWED_PATH))throw new Error('url_not_allowed');return url}
function allowedFactsheet(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!==ALLOWED_HOST||!/^\/en\/tournament\/[^/]+\/[a-z]{3}\/\d{4}\/[0-9a-f-]+\/?$/i.test(url.pathname))throw new Error('factsheet_url_not_allowed');return url}
function cacheFile(url){return path.join(CACHE_DIR,crypto.createHash('sha256').update(url.toString()).digest('hex')+'.json')}
async function readCache(file){try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if(Date.now()-Date.parse(cached.fetchedAt)<=CACHE_TTL_MS&&cached.responseKind==='json')return cached}catch{}return null}
async function acquire(context,rawUrl){const url=allowed(rawUrl),file=cacheFile(url),cached=await readCache(file);if(cached)return{...cached,cache:'hit'};const wait=Math.max(0,MIN_DELAY_MS-(Date.now()-lastRequestAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastRequestAt=Date.now();const page=await context.newPage();try{const response=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:TIMEOUT_MS}),status=response?.status()||0,text=await page.locator('body').innerText({timeout:5000}).catch(()=>'' );let json=null;try{json=JSON.parse(text)}catch{}const incapsula=/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(text),result={fetchedAt:new Date().toISOString(),ok:status>=200&&status<300&&Boolean(json)&&!incapsula,status,url:url.toString(),json,responseKind:incapsula?'incapsula_challenge':json?'json':'non_json'};if(result.responseKind==='json'){await fs.mkdir(CACHE_DIR,{recursive:true});await fs.writeFile(file,JSON.stringify(result))}return{...result,cache:'miss'}}finally{await page.close()}}
async function acquireFactsheet(context,rawUrl){
  const url=allowedFactsheet(rawUrl),wait=Math.max(0,MIN_DELAY_MS-(Date.now()-lastRequestAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastRequestAt=Date.now();
  const page=await context.newPage();
  try{
    const response=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:TIMEOUT_MS}),status=response?.status()||0;
    await page.waitForFunction(()=>/First day of Singles Qualifying:|Venue Name:|Venue Address:/i.test(document.body?.innerText||''),null,{timeout:Math.min(TIMEOUT_MS,15000)}).catch(()=>{});
    const text=await page.locator('body').innerText({timeout:5000}).catch(()=>''),incapsula=/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(text);
    return{fetchedAt:new Date().toISOString(),ok:status>=200&&status<300&&!incapsula&&Boolean(text),status,url:url.toString(),text,responseKind:incapsula?'incapsula_challenge':text?'rendered_text':'empty'};
  }finally{await page.close()}
}
await fs.mkdir(PROFILE_DIR,{recursive:true});await fs.mkdir(CACHE_DIR,{recursive:true});
const context=await chromium.launchPersistentContext(PROFILE_DIR,{headless:true,viewport:{width:1280,height:900},locale:'en-GB',timezoneId:'Europe/Rome'});
const server=http.createServer((req,res)=>{if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true});const route=req.url;if(req.method!=='POST'||!['/v1/fetch','/v1/factsheet'].includes(route))return send(res,404,{error:'not_found'});if(!TOKEN||req.headers.authorization!==`Bearer ${TOKEN}`)return send(res,401,{error:'unauthorized'});let body='';req.on('data',chunk=>{if(body.length<16384)body+=chunk});req.on('end',()=>{let url;try{url=JSON.parse(body).url;(route==='/v1/fetch'?allowed:allowedFactsheet)(url)}catch{return send(res,400,{error:'invalid_url'})}chain=chain.then(()=>route==='/v1/fetch'?acquire(context,url):acquireFactsheet(context,url));chain.then(result=>send(res,200,result)).catch(error=>send(res,502,{error:error.message}))})});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({status:'ready',port:PORT})));
async function shutdown(){server.close();await context.close();process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
