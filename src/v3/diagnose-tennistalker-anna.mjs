import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const PLAYER_URL='https://www.tennistalker.it/giocatore/304952';
const BASE='https://www.tennistalker.it';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function get(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch TennisTalker diagnostic','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});const t=await r.text();return{url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type')||'',text:t}}
function uniq(a){return[...new Set(a.filter(Boolean))]}
const out={version:'cw-v3-tennistalker-anna-diagnostic',generatedAt:NOW,playerUrl:PLAYER_URL,playerId:'304952',assets:[],apiCandidates:[],endpointProbes:[],textHits:[],errors:[]};
try{
  const page=await get(PLAYER_URL);out.pageStatus=page.status;out.pageContentType=page.contentType;out.pageTitle=(page.text.match(/<title[^>]*>([^<]+)/i)||[])[1]||'';out.pageTextSnippet=page.text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,1000);
  const assetPaths=uniq([...page.text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)].map(m=>m[1]).concat([...page.text.matchAll(/import\(["']([^"']+\.js)["']\)/gi)].map(m=>m[1])));
  const assets=assetPaths.map(p=>p.startsWith('http')?p:p.startsWith('/')?BASE+p:BASE+'/'+p);
  out.assets=assets;
  const jsTexts=[];
  for(const url of assets.filter(x=>x.endsWith('.js'))){try{const a=await get(url);out.assetsDetail??=[];out.assetsDetail.push({url,status:a.status,contentType:a.contentType,size:a.text.length});if(a.ok)jsTexts.push({url,text:a.text})}catch(e){out.errors.push({stage:'asset',url,error:e.message})}}
  const allJs=jsTexts.map(x=>x.text).join('\n');
  out.textHits=uniq(['GAMBARINI','304952','giocatore','players','risultati','tornei','fitp','api'].flatMap(term=>allJs.includes(term)?[term]:[]));
  const stringUrls=uniq([...allJs.matchAll(/https?:\/\/[^"'`\\)]+/g)].map(m=>m[0]));
  const relativeApis=uniq([...allJs.matchAll(/["'`]((?:\/api|api\/|\/v\d+\/|v\d+\/|\/giocatore|giocatore\/|\/player|player\/)[^"'`]+)["'`]/gi)].map(m=>m[1]));
  const interestingStrings=uniq([...allJs.matchAll(/["'`]([^"'`]*(?:giocator|player|risultat|torne|classific|fitp|match|api)[^"'`]*)["'`]/gi)].map(m=>m[1]).filter(s=>s.length<180)).slice(0,400);
  out.stringUrls=stringUrls.slice(0,200);out.relativeApis=relativeApis.slice(0,300);out.interestingStrings=interestingStrings;
  const templates=[];
  for(const s of [...relativeApis,...interestingStrings]){
    let u=s.replace(/\$\{[^}]+\}/g,'304952').replace(/:id|\{id\}|\{playerId\}|PLAYER_ID|playerId/g,'304952');
    if(/304952|giocator|player/i.test(u)&&!/[\s{}]/.test(u))templates.push(u);
  }
  const probeUrls=uniq(templates.map(u=>u.startsWith('http')?u:u.startsWith('/')?BASE+u:BASE+'/'+u)).slice(0,80);
  out.apiCandidates=probeUrls;
  for(const url of probeUrls){try{const p=await get(url);const txt=p.text.slice(0,1000);out.endpointProbes.push({url,status:p.status,contentType:p.contentType,size:p.text.length,looksJson:/json/i.test(p.contentType)||/^\s*[\[{]/.test(p.text),snippet:txt.replace(/\s+/g,' ').slice(0,500)})}catch(e){out.endpointProbes.push({url,error:e.message})}}
}catch(e){out.errors.push({stage:'main',error:e.stack||e.message})}
await writeJson('dist/v3/tennistalker_anna_diagnostic.json',out);
console.log(JSON.stringify({...out,assetsDetail:out.assetsDetail?.slice(0,20),interestingStrings:out.interestingStrings?.slice(0,80),endpointProbes:out.endpointProbes?.slice(0,20)},null,2));
