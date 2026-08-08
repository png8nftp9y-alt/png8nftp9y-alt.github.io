import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const URL='https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/puc-sgat-competition_v1.15.js';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const r=await fetch(URL,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-js-audit/1.0'}});
const text=await r.text();
const needles=['/api/v1/tornei/check/subscription','check/subscription','api/v2/puc/subscribe','api/v2/puc/unsubscribe','subscribedTournaments','puc-sgat-subscriptions','token','Authorization','Bearer','headers','competitionId','membershipCard','cardNumber'];
const windows=[];
for(const needle of needles){let idx=0;while((idx=text.indexOf(needle,idx))!==-1){windows.push({needle,index:idx,context:text.slice(Math.max(0,idx-2500),Math.min(text.length,idx+3500))});idx+=needle.length;}}
const funcs=[];
for(const w of windows){const c=w.context;const m=c.match(/function\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{[\s\S]{0,5000}/); if(m)funcs.push({needle:w.needle,fragment:m[0].slice(0,5000)});}
const out={generatedAt:NOW,status:'fitp_subscription_js_logic_extracted',url:URL,statusCode:r.status,bytes:text.length,needles,hitCount:windows.length,windows,funcFragments:funcs.slice(0,30)};
await writeJson('dist/v3/source_fitp_subscription_js_audit.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,statusCode:r.status,bytes:text.length,hitCount:windows.length,hits:windows.map(w=>({needle:w.needle,index:w.index,context:w.context.slice(0,1200)})).slice(0,20)},null,2));
