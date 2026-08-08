import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,160));return t?JSON.parse(t):null}
function it(d){return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`}
const start0=new Date(FROM+'T00:00:00Z'), limit=new Date(Date.now()+420*864e5);
const windows=[];for(let s=new Date(start0);s<=limit;s=new Date(s.getTime()+28*864e5)){const e=new Date(Math.min(limit.getTime(),s.getTime()+27*864e5));windows.push({start:s,end:e})}
function payload(w,extra={},skip=0){return{guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'',sesso:'',data_inizio:it(w.start),data_fine:it(w.end),tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',rowstoskip:skip,fetchrows:100,sortcolumn:'',sortorder:'',...extra}}
const sampleRows=[],errors=[],fields={};
for(const w of windows){try{const r=await post('/api/v3/tornei/puc/list',payload(w));const rows=(r?.competizioni||[]).filter(x=>x.guid&&x.guid!=='11111111-1111-1111-1111-111111111111');sampleRows.push(...rows.slice(0,20));for(const row of rows){for(const [k,v] of Object.entries(row)){if(v===null||v===undefined||typeof v==='object')continue;const s=String(v).trim();if(!s)continue;(fields[k] ||= {});fields[k][s]=(fields[k][s]||0)+1}}}catch(e){errors.push(`${it(w.start)}-${it(w.end)} ${e.message}`)}}
const fieldValues=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,Object.entries(v).sort((a,b)=>b[1]-a[1]).slice(0,100).map(([value,count])=>({value,count}))]));
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'fitp_filter_audit',purpose:'identify official PUC filter values for discipline tennis and competition tornei FITP/campionati a squadre without keyword search',coverageFrom:FROM,windows:windows.length,sampleRows:sampleRows.length,fieldValues,sampleRows:sampleRows.slice(0,200),errors};
await writeJson('dist/v3/source_fitp_filter_audit.json',out);
console.log(JSON.stringify({...out,sampleRows:undefined,fieldValues:Object.keys(fieldValues)},null,2));
