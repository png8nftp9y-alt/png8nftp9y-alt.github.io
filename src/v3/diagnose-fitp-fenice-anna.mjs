import fs from 'node:fs/promises';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS='4332';
const FROM='2025-12-18';
const ANNA_CARD='3876473411';
const terms=['LA FENICE','FENICE','BRESCIA','LOMB. 370','LOMB 370','370','GAMBARINI','GAMBARINI ANNA',ANNA_CARD];
const dd=n=>String(n).padStart(2,'0');
const it=d=>`${dd(d.getUTCDate())}/${dd(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
const iso=v=>{const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${dd(m[2])}-${dd(m[1])}`:''};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch Fenice diagnostic','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(r.status+' '+t.slice(0,200));return t?JSON.parse(t):null}
function payload({term='',start='',end='',skip=0,cod='1'}){return{guid:'',profilazione:'',freetext:term,id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS,sesso:'',data_inizio:start,data_fine:end,tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:cod,id_fonte:cod==='1'?'TORNEI FITP':'',rowstoskip:skip,fetchrows:100,sortcolumn:'',sortorder:''}}
function collect(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collect(x,into);return into}const full=[node.Surname||node.Cognome,node.Name||node.Nome||node.FirstName].filter(Boolean).join(' ');const mc=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full||mc)into.push({full,membershipCard:mc,ranking:node.Ranking||node.Classifica||'',rawKeys:Object.keys(node)});for(const [k,v] of Object.entries(node)){if(!/result|score|winner|loser/i.test(k))collect(v,into)}return into}
const windows=[['01/03/2026','30/04/2026'],['01/01/2026','31/12/2026'],['18/12/2025','31/12/2026'],['01/03/2026','31/03/2026']];
const found=new Map(), queries=[], errors=[];
for(const cod of ['1','3','']) for(const [start,end] of windows) for(const term of terms){for(let skip=0;skip<500;skip+=100){try{const r=await post('/api/v3/tornei/puc/list',payload({term,start,end,skip,cod}));const rows=r?.competizioni||[];queries.push({term,start,end,cod,skip,total:r?.record,rows:rows.length});for(const c of rows){const text=norm([c.nome_torneo,c.citta,c.sigla_provincia,c.provincia,c.tennisclub,c.id_fonte,c.cat_eta].join(' '));if(/FENICE|BRESCIA|LOMB 370|LOMB 370/.test(text)||text.includes('370')){const id=String(c.guid||'').toUpperCase();found.set(id,{...c,competitionId:id,isoStart:iso(c.data_inizio),isoEnd:iso(c.data_fine),matchText:text,sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(id)})}}
if(rows.length<100)break;}catch(e){errors.push({term,start,end,cod,skip,error:e.message});break}}
}
const detail=[];
for(const t of found.values()){try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});const participants=collect(d);const anna=participants.filter(p=>p.membershipCard===ANNA_CARD||norm(p.full).includes('GAMBARINI ANNA')||norm(p.full).includes('ANNA GAMBARINI'));detail.push({competitionId:t.competitionId,name:d.Description||t.nome_torneo,from:iso(d.From)||t.isoStart,to:iso(d.To)||t.isoEnd,cod_fonte:t.cod_fonte,id_fonte:t.id_fonte,municipality:d.Municipality,province:d.Province,drawCount:(d.Tournaments||[]).length,participants:participants.length,annaHits:anna,sourceUrl:t.sourceUrl});}catch(e){detail.push({competitionId:t.competitionId,error:e.message})}}
const out={version:'cw-v3-fitp-fenice-anna-diagnostic',generatedAt:new Date().toISOString(),terms,foundCount:found.size,found:[...found.values()],detail,queries,errors};
await fs.mkdir('dist/v3',{recursive:true});await fs.writeFile('dist/v3/fitp_fenice_anna_diagnostic.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({...out,queries:queries.slice(0,50)},null,2));
