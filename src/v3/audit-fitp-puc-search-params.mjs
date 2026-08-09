import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const JS_URL='https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/puc-sgat-competition_v1.15.js';
const LIST='/api/v3/tornei/puc/list';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function getText(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-param-audit/1.0','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'}});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,200));return t}
async function post(body){const r=await fetch(BASE+LIST,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-param-audit/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,200));return t?JSON.parse(t):null}
const base={guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'4332',sesso:'',data_inizio:'18/12/2025',data_fine:'18/12/2026',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:0,fetchrows:100,sortcolumn:'',sortorder:''};
const errors=[];let js='';try{js=await getText(JS_URL)}catch(e){errors.push({stage:'fetch_js',error:e.message})}
const paramNames=[...new Set([...js.matchAll(/\b(guid|profilazione|freetext|id_regione|id_provincia|id_stato|id_disciplina|sesso|data_inizio|data_fine|tipo_competizione|categoria_eta|id_classifica|classifica|massimale_montepremi|id_area_regionale|ambito|cod_fonte|id_fonte|rowstoskip|fetchrows|sortcolumn|sortorder)\b/g)].map(m=>m[1]))];
const endpointMentions=[...new Set([...js.matchAll(/\/api\/[A-Za-z0-9_./?=&-]+/g)].map(m=>m[0]))].sort();
const interestingLines=js.split(/\n/).map((line,i)=>({line:i+1,text:line.trim()})).filter(x=>/id_regione|id_provincia|categoria_eta|id_classifica|classifica|tipo_competizione|id_stato|puc\/list|tornei\/puc\/list|rowstoskip|fetchrows/i.test(x.text)).slice(0,350);
async function probe(field,values){const out=[];for(const value of values){const body={...base,[field]:value};try{const j=await post(body);const rows=j?.competizioni||[];out.push({field,value,total:Number(j?.record||rows.length||0),rows:rows.length,first:rows[0]?.nome_torneo||'',sampleFields:rows[0]?Object.keys(rows[0]).sort():[]})}catch(e){out.push({field,value,error:e.message})}}return out}
const probes=[];
probes.push(...await probe('id_stato',['0','1','2','3','4','5','6','7','8','9']));
probes.push(...await probe('sesso',['M','F','Maschile','Femminile']));
probes.push(...await probe('tipo_competizione',['Maschile','Femminile','Misto','Doppio M.','Doppio F.','Femminile;Maschile']));
probes.push(...await probe('categoria_eta',['U08','U10','U11','U12','U13','U14','U15','U16','U17','U18','NOF','NOR','O30','O35','O40']));
probes.push(...await probe('classifica',['1','2','3','4','2.5','2.6','2.7','2.8','3.1','3.2','3.3','3.4','3.5','4.1','4.2','4.3','4.4','4.5','4.6','4.NC']));
probes.push(...await probe('id_classifica',['1','2','3','4','21','22','23','24','25','31','32','33','34','35','41','42','43','44','45','46','47']));
probes.push(...await probe('id_regione',['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21']));
probes.push(...await probe('id_area_regionale',['1','2','3','4','5','6','7','8','9','10']));
const useful=probes.filter(p=>!p.error&&p.rows>0);
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'fitp_puc_search_parameter_audit_complete',purpose:'Discover usable official PUC tournament-search parameters for exhaustive FITP individual tournament discovery',jsUrl:JS_URL,jsFetched:!!js,jsBytes:js.length,paramNames,endpointMentions,interestingLines,probeSummary:{total:probes.length,useful:useful.length,errors:probes.filter(p=>p.error).length},usefulProbes:useful,probes,errors};
await writeJson('dist/v3/source_fitp_puc_search_params_audit.json',out);
console.log(JSON.stringify({...out,interestingLines:interestingLines.slice(0,30),probes:undefined},null,2));
if(!js&&useful.length<5)process.exitCode=1;
