import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TARGET=process.env.FITP_PLAYER_NAME||'';
if(!TARGET) throw new Error('FITP_PLAYER_NAME is required');
const TERMS=(process.env.FITP_PLAYER_TERMS||TARGET).split(',').map(s=>s.trim()).filter(Boolean);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body,attempt=0){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-player-probe/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok){if(attempt<2&&(r.status>=500||r.status===429)){await new Promise(res=>setTimeout(res,500*(attempt+1)));return post(path,body,attempt+1)}throw Error(r.status+' '+t.slice(0,200))}return t?JSON.parse(t):null}
function collectParticipants(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '), surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full1=`${name} ${surname}`.trim(), full2=`${surname} ${name}`.trim();const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',raw:node});for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}return into}
function listPayload(term){return{guid:'',profilazione:'',freetext:term,id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'4332',sesso:'',data_inizio:'18/12/2025',data_fine:'20/12/2026',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:0,fetchrows:100,sortcolumn:'',sortorder:''}}
const targetNorms=new Set([norm(TARGET),...TERMS.map(norm)]);
const targetParts=norm(TARGET).split(' ').filter(Boolean);
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const tournaments=(map.tournaments||[]).filter(t=>t.circuit==='fitp'&&t.competitionId);
const candidateIds=new Set(); const listHits=[]; const errors=[];
for(const term of TERMS){try{const r=await post('/api/v3/tornei/puc/list',listPayload(term));for(const c of (r?.competizioni||[])){const id=String(c.guid||'').toUpperCase();if(id){candidateIds.add(id);listHits.push({term,competitionId:id,tournamentName:c.nome_torneo||'',startDate:c.data_inizio,endDate:c.data_fine})}}}catch(e){errors.push({stage:'list',term,error:e.message})}}
// Probe candidate list first, then all map until enough hits.
const byId=new Map(tournaments.map(t=>[String(t.competitionId).toUpperCase(),t]));
const ordered=[...candidateIds].map(id=>byId.get(id)||{competitionId:id,tournamentName:'candidate from list'}).concat(tournaments.filter(t=>!candidateIds.has(String(t.competitionId).toUpperCase())));
const hits=[]; let checked=0;
for(const t of ordered){try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});checked++;const participants=collectParticipants(d?.Tournaments||[]);for(const p of participants){const n1=norm(p.full1), n2=norm(p.full2);if(targetNorms.has(n1)||targetNorms.has(n2)||targetParts.every(part=>n1.includes(part))||targetParts.every(part=>n2.includes(part))){hits.push({competitionId:String(t.competitionId).toUpperCase(),tournamentName:d?.Description||t.tournamentName,location:[d?.Municipality,d?.Province].filter(Boolean).join(' '),startDate:d?.From||t.startDate,endDate:d?.To||t.endDate,participant:p});}}
if(hits.length>=5)break;}catch(e){errors.push({stage:'detail',competitionId:t.competitionId,error:e.message})}}
const cards=[...new Set(hits.map(h=>h.participant.membershipCard).filter(Boolean))];
const out={generatedAt:NOW,target:TARGET,terms:TERMS,listHits:listHits.slice(0,50),candidateIds:[...candidateIds],detailsChecked:checked,hits,cards,errors:errors.slice(0,50)};
const outputSlug=norm(TARGET).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
await writeJson(`dist/v3/fitp_player_probe_${outputSlug}.json`,out);
console.log(JSON.stringify(out,null,2));
if(!cards.length)process.exitCode=2;
