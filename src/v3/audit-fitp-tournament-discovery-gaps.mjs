import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const BRALLO_NAME='BRALLO';
const TENNIS='4332';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function post(body){const r=await fetch(BASE+'/api/v3/tornei/puc/list',{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-gap-audit/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{};return{status:r.status,text:text.slice(0,300),json}}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const hasBrallo=r=>String(r?.guid||'').toUpperCase()===BRALLO||norm(r?.nome_torneo||r?.name||'').includes(BRALLO_NAME);
const base={guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS,sesso:'',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:0,fetchrows:100,sortcolumn:'',sortorder:''};
const variants=[];
for(const datePair of [
  ['02/08/2026','08/08/2026'],['01/08/2026','09/08/2026'],['2026-08-02','2026-08-08'],['08/02/2026','08/08/2026'],['02-08-2026','08-08-2026'],['',''],
]){
  for(const source of [{cod:'1',name:'TORNEI FITP'},{cod:'',name:''},{cod:'0',name:''},{cod:null,name:null}]){
    for(const ft of ['', 'brallo', 'BRALLO', 'CENTRO ESTIVO FITP BRALLO', 'JUNIOR NEXT GEN BRALLO']){
      variants.push({...base,data_inizio:datePair[0],data_fine:datePair[1],cod_fonte:source.cod,id_fonte:source.name,freetext:ft});
    }
  }
}
// Also test known date windows from old working tournament and current discovery style around every day of Brallo.
for(let d=2;d<=8;d++)variants.push({...base,data_inizio:String(d).padStart(2,'0')+'/08/2026',data_fine:String(d).padStart(2,'0')+'/08/2026'});
const findings=[];let calls=0;
for(const body of variants){
  const all=[];let total=null;for(let skip=0;skip<2000;skip+=100){const r=await post({...body,rowstoskip:skip,fetchrows:100});calls++;const rows=r.json?.competizioni||[];if(total===null)total=r.json?.record??rows.length;all.push(...rows);if(rows.some(hasBrallo)){findings.push({body:{...body,rowstoskip:skip},status:r.status,total,rowsReturned:rows.length,bralloRows:rows.filter(hasBrallo)});break}if(!rows.length||rows.length<100)break;if(skip>=(Number(total)||0)+200)break}
  if(findings.length)break;
}
const current=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const currentBrallo=(current.tournaments||[]).filter(hasBrallo);
const summary={version:'cw-v3-agenda-first',generatedAt:NOW,status:findings.length?'brallo_found_by_probe_variant':'brallo_not_found_by_probe_variants',knownBralloId:BRALLO,currentTournamentFileBralloRows:currentBrallo.length,calls,variantsTested:variants.length,findings};
await writeJson('dist/v3/source_fitp_tournament_discovery_gap_audit.json',summary);
await fs.writeFile('courtwatch-v3-fitp-tournament-discovery-gap-audit-run.log',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if(!findings.length)process.exitCode=2;
