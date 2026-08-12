import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS='4332';
const FETCH=100;
const MAX_PAGES=30;
const OVERLAP_DAYS=21;
const MIN_SPLIT_DAYS=14;
const HORIZON_DAYS=730;
const SHARD=process.env.FITP_SHARD||'core_dates';
const SHARDS=['core_dates','core_terms','nw_regions','nw_provinces1','nw_provinces2','nw_terms','ne_regions','ne_provinces1','ne_provinces2','ne_terms','ce_regions','ce_provinces1','ce_provinces2','ce_terms','so_regions','so_provinces1','so_provinces2','so_terms'];
const REGIONS={
  '1':'Piemonte','2':'Valle d Aosta','3':'Liguria','4':'Lombardia','5':'Trentino Alto Adige','6':'Veneto','7':'Friuli Venezia Giulia','8':'Emilia Romagna','9':'Toscana','10':'Umbria','11':'Marche','12':'Lazio','13':'Abruzzo','14':'Molise','15':'Campania','16':'Puglia','17':'Basilicata','18':'Calabria','19':'Sicilia','20':'Sardegna'
};
// Official P.U.C. province ids observed/used by the previous engine, grouped geographically only for sharding.
const PROVINCES=[
  ...['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','96','97','98','103','108'],
  ...['21','22','23','24','25','26','27','28','29','30','31','32'],
  ...['33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','99','100','101','102','109','110'],
  ...['61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','111']
].map((id,i)=>({id:String(id),ordinal:i}));
const REGRESSION_IDS={
  feniceBresciaLomb370:'676A77A5-3B55-479E-81E2-45F109C25F98',
  rossoniKinderImperia:'25C6CC33-AE3A-447E-A55B-FBE66FBAFC80',
  navaKinderMilano3:'B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'
};
const dd=n=>String(n).padStart(2,'0');
const addDays=(d,n)=>new Date(d.getTime()+n*864e5);
const daysBetween=(a,b)=>Math.round((b-a)/864e5);
const it=d=>`${dd(d.getUTCDate())}/${dd(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
const isoDate=d=>d.toISOString().slice(0,10);
const iso=v=>{const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/^(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${dd(m[2])}-${dd(m[1])}`:''};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const key=r=>String(r?.guid||r?.competitionId||'').toUpperCase();
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(body,attempt=0){
  const r=await fetch(BASE+'/api/v3/tornei/puc/list',{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-provincial-window-engine/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});
  const text=await r.text();
  if(!r.ok){if(attempt<3&&(r.status>=500||r.status===429)){await new Promise(x=>setTimeout(x,700*(attempt+1)));return post(body,attempt+1)}throw Error(r.status+' '+text.slice(0,180))}
  return text?JSON.parse(text):null;
}
function base(){return{guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS,sesso:'',data_inizio:'',data_fine:'',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:0,fetchrows:FETCH,sortcolumn:'',sortorder:''}}
function reject(r){const id=key(r); if(!id||id==='11111111-1111-1111-1111-111111111111')return true; if(String(r.id_disciplina||'')!==TENNIS)return true; if(String(r.cod_fonte||'')!=='1')return true; const n=norm([r.nome_torneo,r.name,r.descrizione,r.id_fonte].join(' ')); return /TENNIS EUROPE|TE U\s?\d{2}|TENNIS EUROPE JUNIOR TOUR/.test(n)}
function statusOf(a,b){if(b&&b<TODAY)return'finished'; if(a&&a>TODAY)return'upcoming'; return'active_or_open'}
function payload({provinceId,queryStart,queryEnd,skip}){const p=base();p.id_provincia=provinceId;p.data_inizio=it(queryStart);p.data_fine=it(queryEnd);p.rowstoskip=skip;return p}
function shardProvinces(){const idx=Math.max(0,SHARDS.indexOf(SHARD));return PROVINCES.filter((_,i)=>i%SHARDS.length===idx)}
function logicalWindows(){
  const start=new Date(FROM+'T00:00:00Z');
  const limit=addDays(new Date(TODAY+'T00:00:00Z'),HORIZON_DAYS);
  const out=[]; let n=0;
  for(let s=new Date(start);s<limit;s=addDays(s,122),n++){
    const e=new Date(Math.min(limit.getTime(),addDays(s,122).getTime()));
    out.push({label:`window_${n+1}_${isoDate(s)}_${isoDate(e)}`,logicalStart:new Date(s),logicalEnd:e,level:'quadrimestre',first:n===0});
  }
  return out;
}
function queryStartFor(w){return w.first?new Date(w.logicalStart):addDays(w.logicalStart,-OVERLAP_DAYS)}
function splitWindow(w){const span=daysBetween(w.logicalStart,w.logicalEnd); if(span<=MIN_SPLIT_DAYS)return[]; const mid=addDays(w.logicalStart,Math.ceil(span/2)); return[
  {...w,label:w.label+'A',logicalEnd:mid,level:w.level==='quadrimestre'?'bimestre':'split',first:w.first},
  {...w,label:w.label+'B',logicalStart:mid,level:w.level==='quadrimestre'?'bimestre':'split',first:false}
]}
const byId=new Map(), coverage={}; const queries=[], errors=[], branches=[]; let unresolvedSaturations=0;
async function runBranch(province,w,depth=0){
  const queryStart=queryStartFor(w), queryEnd=w.logicalEnd;
  const branch={shard:SHARD,provinceId:province.id,provinceOrdinal:province.ordinal,windowLabel:w.label,logicalStart:isoDate(w.logicalStart),logicalEnd:isoDate(w.logicalEnd),queryStart:isoDate(queryStart),queryEnd:isoDate(queryEnd),level:w.level,depth,pagesRead:0,rowsRead:0,totalDeclared:0,saturated:false,split:false,errors:[]};
  let prev='';
  for(let page=0,skip=0;page<MAX_PAGES;page++,skip+=FETCH){
    let j; try{j=await post(payload({provinceId:province.id,queryStart,queryEnd,skip}))}catch(e){const er={provinceId:province.id,windowLabel:w.label,skip,error:e.message};errors.push(er);branch.errors.push(er);break}
    const rows=j?.competizioni||[]; const total=Number(j?.record||0); const sig=rows.map(key).join('|');
    branch.pagesRead++; branch.rowsRead+=rows.length; branch.totalDeclared=Math.max(branch.totalDeclared,total||0);
    queries.push({provinceId:province.id,windowLabel:w.label,queryStart:branch.queryStart,queryEnd:branch.queryEnd,skip,rows:rows.length,total,saturated:rows.length>=FETCH||total>skip+rows.length});
    for(const r of rows){if(reject(r))continue;const k=key(r);if(!byId.has(k))byId.set(k,r);(coverage[k]??=new Set()).add(`${province.id}:${w.label}`)}
    if(!rows.length||sig===prev)break; prev=sig;
    if(rows.length<FETCH)break;
  }
  branch.saturated=branch.rowsRead>=FETCH*MAX_PAGES || branch.totalDeclared>branch.rowsRead || (branch.pagesRead&&branch.rowsRead>=FETCH&&branch.rowsRead%FETCH===0);
  if(branch.saturated){
    const parts=splitWindow(w);
    if(parts.length){branch.split=true; branches.push(branch); for(const part of parts) await runBranch(province,part,depth+1); return;}
    unresolvedSaturations++;
  }
  branches.push(branch);
}
const provinces=shardProvinces(); const windows=logicalWindows(); let idx=0; const tasks=[];
const allJobs=[]; for(const p of provinces)for(const w of windows)allJobs.push([p,w]);
async function worker(){while(idx<allJobs.length){const [p,w]=allJobs[idx++];await runBranch(p,w)}}
await Promise.all(Array.from({length:4},worker));
const tournaments=[...byId.values()].map(r=>{const startDate=iso(r.data_inizio),rawEnd=iso(r.data_fine),endDate=rawEnd==='1900-01-01'?'':rawEnd,k=key(r);return{circuit:'fitp',competitionId:k,tournamentName:r.nome_torneo||'',location:[r.citta,r.sigla_provincia||r.provincia].filter(Boolean).join(' '),startDate,endDate,status:statusOf(startDate,endDate),disciplineId:String(r.id_disciplina||''),sourceCode:String(r.cod_fonte||''),sourceName:r.id_fonte||'',categoryAge:r.cat_eta||'',categoryClass:r.cat_class||'',tournamentType:r.tipo_torneo||'',club:r.tennisclub||'',sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(k),discoveryShard:SHARD,coverageModes:[...(coverage[k]||new Set())].sort(),lastSeen:NOW}}).filter(t=>!t.endDate||t.endDate>=FROM).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.tournamentName||'').localeCompare(String(b.tournamentName||'')));
const ids=new Set(tournaments.map(t=>String(t.competitionId).toUpperCase()));
const regression={}; for(const [name,id] of Object.entries(REGRESSION_IDS)) regression[name]=ids.has(id);
const out={version:'cw-v3-fitp-provincial-window-engine',generatedAt:NOW,status:errors.length?'fitp_provincial_window_shard_with_errors':unresolvedSaturations?'fitp_provincial_window_shard_with_unresolved_saturations':'fitp_provincial_window_shard_complete',shard:SHARD,source:'FITP tournament discovery by province × rotating logical windows. Each query uses official P.U.C. structured filters only: tennis discipline, TORNEI FITP, province, data_inizio, data_fine. No player names and no tournament keywords. Logical quadrimestre windows overlap the query start by 21 days except the first historical window. Saturated branches auto-split to shorter windows and final map dedupes by competitionId.',coverageFrom:FROM,coverageUntil:isoDate(addDays(new Date(TODAY+'T00:00:00Z'),HORIZON_DAYS)),provinces:provinces.map(p=>p.id),logicalWindows:windows.map(w=>({label:w.label,logicalStart:isoDate(w.logicalStart),logicalEnd:isoDate(w.logicalEnd),queryStart:isoDate(queryStartFor(w)),queryEnd:isoDate(w.logicalEnd)})),branches:branches.length,queries:queries.length,tournamentsFound:tournaments.length,unresolvedSaturations,regression,tournaments,errors};
await writeJson(`dist/v3/shards/source_fitp_tournaments_${SHARD}.json`,out);
await writeJson(`dist/v3/shards/source_fitp_tournaments_${SHARD}_audit.json`,{...out,tournaments:undefined,queries,branches,sample:tournaments.slice(0,200)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length>30||unresolvedSaturations>0) process.exitCode=unresolvedSaturations>0?2:1;
