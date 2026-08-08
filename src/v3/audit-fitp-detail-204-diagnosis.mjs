import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(body){try{const r=await fetch(BASE+'/api/v3/puc/competizione/dettaglio',{method:'POST',headers:{'content-type':'application/json','accept':'application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-204-diagnosis/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return{status:r.status,ok:r.ok,bytes:text.length,topKeys:json&&typeof json==='object'?Object.keys(json).slice(0,40):[],tournaments:Array.isArray(json?.Tournaments)?json.Tournaments.length:null,participants:Array.isArray(json?.Tournaments)?json.Tournaments.reduce((a,t)=>a+(Array.isArray(t.Participants)?t.Participants.length:0),0):null,text:text.slice(0,200)}}catch(e){return{error:e.message}}}
function pickIds(t){const keys=Object.keys(t);const vals={};for(const k of keys){if(/id|uid|guid/i.test(k))vals[k]=t[k]}return vals}
const source=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const tournaments=(source.tournaments||[]).filter(t=>t.circuit==='fitp'&&t.competitionId);
const sample=tournaments.slice(0,160);
const rows=[];let summary={generatedAt:NOW,status:'fitp_detail_204_diagnosis_complete',sampleSize:sample.length,variantsTested:0,successByVariant:{},statusByVariant:{}};
for(const t of sample){const ids=pickIds(t);const variants=[
 {name:'competitionUid',body:{competitionUid:t.competitionId}},
 {name:'competitionId',body:{competitionId:t.competitionId}},
 {name:'CompetitionUid',body:{CompetitionUid:t.competitionId}},
 {name:'CompetitionId',body:{CompetitionId:t.competitionId}},
 {name:'uid',body:{uid:t.competitionId}},
 {name:'id',body:{id:t.competitionId}}
];
 const results=[];for(const v of variants){summary.variantsTested++;const r=await post(v.body);summary.statusByVariant[v.name]??={};summary.statusByVariant[v.name][String(r.status||r.error)] = (summary.statusByVariant[v.name][String(r.status||r.error)]||0)+1;if(r.status===200&&r.tournaments!==null){summary.successByVariant[v.name]=(summary.successByVariant[v.name]||0)+1}results.push({variant:v.name,body:v.body,...r});}
 rows.push({competitionId:t.competitionId,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate,source:t.source,sourceName:t.sourceName,rawIdFields:ids,sourceUrl:t.sourceUrl,results});}
await writeJson('dist/v3/source_fitp_detail_204_diagnosis.json',{...summary,rows});
console.log(JSON.stringify(summary,null,2));
