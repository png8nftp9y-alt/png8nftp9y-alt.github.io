import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const URL='https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/puc-sgat-competition_v1.15.js';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const r=await fetch(URL,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-js-audit/1.1','accept':'application/javascript,text/plain,*/*'}});
const text=await r.text();
const needles=['/api/v1/tornei/check/subscription','check/subscription','api/v2/puc/subscribe','api/v2/puc/unsubscribe','subscribedTournaments','puc-sgat-subscriptions','access_token','id_token','token','Authorization','Bearer','headers','competitionId','cardNumber','membershipCard','selectedCard'];
const windows=[];
for(const needle of needles){let idx=0;while((idx=text.indexOf(needle,idx))!==-1){windows.push({needle,index:idx,context:text.slice(Math.max(0,idx-3500),Math.min(text.length,idx+4500))});idx+=needle.length;}}
const ajaxBlocks=[];
for(const m of text.matchAll(/\$\.ajax\s*\(\s*\{[\s\S]{0,3500}?\}\s*\)/g)){const b=m[0];if(/subscription|subscribe|unsubscribe|puc|tornei|competizione/i.test(b))ajaxBlocks.push({index:m.index,block:b});}
const axiosBlocks=[];
for(const m of text.matchAll(/axios\.[a-z]+\s*\([\s\S]{0,2000}?\)/g)){const b=m[0];if(/subscription|subscribe|unsubscribe|puc|tornei|competizione/i.test(b))axiosBlocks.push({index:m.index,block:b});}
const out={generatedAt:NOW,status:'fitp_subscription_js_logic_extracted_forced',url:URL,statusCode:r.status,bytes:text.length,hitCount:windows.length,windows,ajaxBlocks,axiosBlocks};
await writeJson('dist/v3/source_fitp_subscription_js_audit.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,statusCode:r.status,bytes:text.length,hitCount:windows.length,ajaxBlocks:ajaxBlocks.length,axiosBlocks:axiosBlocks.length,firstHits:windows.slice(0,12).map(w=>({needle:w.needle,index:w.index,context:w.context.slice(0,1500)})),ajax:ajaxBlocks.slice(0,10)},null,2));
