import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const scriptUrl='https://www.fitp.it/common/vue/PucSearch_v14.js';
const response=await fetch(scriptUrl,{headers:{'user-agent':'Mozilla/5.0 CourtWatch/1.0',accept:'text/javascript,*/*'}});
if(!response.ok)throw new Error(`PucSearch script HTTP ${response.status}`);
const source=await response.text(),strings=[],paths=[];
for(const match of source.matchAll(/(["'`])([^"'`\r\n]{3,300})\1/g)){const value=match[2].replace(/\\\//g,'/');if(/puc|compet|torne|search|ricerca|api|loadmore|filter/i.test(value))strings.push(value)}
for(const match of source.matchAll(/\/(?:[A-Za-z0-9_.?=&${}-]+\/){0,8}[A-Za-z0-9_.?=&${}-]*(?:Puc|Compet|Torne|Search|Ricerca|Load)[A-Za-z0-9_./?=&${}-]*/gi))paths.push(match[0]);
const contexts={};for(const term of['urlFunctionMyFit','/api/v3/tornei/puc/list']){const found=[];let at=0;while((at=source.indexOf(term,at))>=0&&found.length<8){found.push(source.slice(Math.max(0,at-2500),Math.min(source.length,at+5000)));at+=term.length}contexts[term]=found;}
const payload={guid:'',profilazione:'',freetext:'BRALLO',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'',sesso:'',data_inizio:'',data_fine:'',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',rowstoskip:0,fetchrows:100,sortcolumn:'',sortorder:''};
const apiTests=[];
for(const endpoint of['https://dp-fit-prod-function.azurewebsites.net/api/v3/tornei/puc/list','https://dp-fit-test-function.azurewebsites.net/api/v3/integration/puc/list']){try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch/1.0'},body:JSON.stringify(payload)}),text=await r.text();let body;try{body=JSON.parse(text)}catch{body={raw:text.slice(0,2000)}}apiTests.push({endpoint,status:r.status,ok:r.ok,keys:Object.keys(body||{}),record:body?.record,competitions:(body?.competizioni||[]).slice(0,25)});}catch(error){apiTests.push({endpoint,error:error.message});}}
const result={fetchedAt:new Date().toISOString(),url:scriptUrl,bytes:Buffer.byteLength(source),sha256:crypto.createHash('sha256').update(source).digest('hex'),strings:[...new Set(strings)].slice(0,500),paths:[...new Set(paths)].slice(0,500),contexts,apiTests};
await fs.writeFile('puc-script-endpoints.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({bytes:result.bytes,apiTests:apiTests.map(x=>({endpoint:x.endpoint,status:x.status,record:x.record,competitions:x.competitions?.length,error:x.error}))},null,2));
