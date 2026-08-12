import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const ANNA_CARD='3876473411';
const ANNA_ID='anna-gambarini';
const ANNA_NAMES=['ANNA GAMBARINI','GAMBARINI ANNA','GAMBARINI'];
const TENNIS='4332';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
const dd=n=>String(n).padStart(2,'0');
const it=d=>`${dd(d.getUTCDate())}/${dd(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
const iso=v=>{const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
const addDays=(d,n)=>new Date(d.getTime()+n*864e5);
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body,attempt=0){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-map-gap/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok){if(attempt<2&&(r.status>=500||r.status===429)){await new Promise(res=>setTimeout(res,500*(attempt+1)));return post(path,body,attempt+1)}throw Error(r.status+' '+t.slice(0,220))}return t?JSON.parse(t):null}
function collectParticipants(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}const full1=[node.Name,node.FirstName,node.Nome,node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full2=[node.Surname,node.LastName,node.Cognome,node.Name,node.FirstName,node.Nome].filter(Boolean).join(' ');const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',subscriptionDate:node.SubscriptionDate||''});for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}return into}
function hasAnna(participants){return participants.find(p=>p.membershipCard===ANNA_CARD||ANNA_NAMES.some(n=>[norm(p.full1),norm(p.full2)].includes(norm(n))))}
function listPayload({start,end,freetext,skip,region='',province='',state='',sex='',age='',classifica='',tipo=''}){return{guid:'',profilazione:'',freetext:freetext||'',id_regione:region,id_provincia:province,id_stato:state,id_disciplina:TENNIS,sesso:sex,data_inizio:start?it(start):'',data_fine:end?it(end):'',tipo_competizione:tipo,categoria_eta:age,id_classifica:'',classifica,massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:skip||0,fetchrows:100,sortcolumn:'',sortorder:''}}
async function listAll(spec,maxPages=40){const out=[];for(let skip=0;skip<maxPages*100;skip+=100){const r=await post('/api/v3/tornei/puc/list',listPayload({...spec,skip}));const rows=r?.competizioni||[];out.push(...rows);if(rows.length<100)break;const total=Number(r?.record||0);if(total&&skip+100>=total)break}return out}
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const entries=await readJson('dist/v3/source_fitp_entries.json',{entries:[]});
const currentAnna=(entries.entries||[]).filter(e=>e.playerId===ANNA_ID).map(e=>String(e.competitionId).toUpperCase());
const currentAnnaSet=new Set(currentAnna);
const mapIds=new Set((map.tournaments||[]).map(t=>String(t.competitionId||'').toUpperCase()));
const start0=new Date(FROM+'T00:00:00Z'), limit=addDays(new Date(NOW.slice(0,10)+'T00:00:00Z'),365);
const windows=[];for(let s=new Date(start0);s<=limit;s=addDays(s,14))windows.push({start:new Date(s),end:new Date(Math.min(limit.getTime(),addDays(s,13).getTime()))});
const specs=[];
for(const w of windows){
  specs.push({...w,freetext:ANNA_CARD,label:'card'});
  for(const term of ANNA_NAMES)specs.push({...w,freetext:term,label:'name:'+term});
  for(const term of ['GAMBARINI','TENNIS CLUB LECCO','LECCO','U.12','UNDER 12','RODEO','KINDER','JUNIOR'])specs.push({...w,freetext:term,label:'broad:'+term});
  for(const region of ['3','7'])specs.push({...w,region,label:'region:'+region});
  for(const province of ['15','16','97','98','108'])specs.push({...w,province,label:'province:'+province});
}
const listed=new Map(), listErrors=[];
for(const spec of specs){try{for(const c of await listAll(spec,20)){const id=String(c.guid||'').toUpperCase();if(!id||id==='11111111-1111-1111-1111-111111111111')continue;if(String(c.id_disciplina||'')!==TENNIS||String(c.cod_fonte||'')!=='1')continue;const rec=listed.get(id)||{competitionId:id,tournamentName:c.nome_torneo||c.name||'',location:[c.citta,c.sigla_provincia||c.provincia].filter(Boolean).join(' '),startDate:iso(c.data_inizio),endDate:iso(c.data_fine),seenBy:[]};rec.seenBy.push(spec.label);listed.set(id,rec)}}catch(e){listErrors.push({label:spec.label,start:it(spec.start),end:it(spec.end),error:e.message})}}
const candidates=[...listed.values()].filter(c=>!currentAnnaSet.has(c.competitionId));
const detailFindings=[], detailErrors=[];let checked=0;
for(const c of candidates){try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:c.competitionId});checked++;const draws=d?.Tournaments||[];let found=null, participantsScanned=0, lists=[];for(const draw of draws){const ps=collectParticipants(draw.Participants||[]);participantsScanned+=ps.length;const hit=hasAnna(ps);if(hit){found=hit;lists.push(draw.TournamentDescription||draw.Description||'Lista iscritti P.U.C.')}}let classification='detail_no_card';if(found)classification=mapIds.has(c.competitionId)?'map_contains_card_but_entry_missing':'detail_contains_card_map_missing';else if(mapIds.has(c.competitionId))classification='already_in_map_no_anna';detailFindings.push({...c,inTournamentMap:mapIds.has(c.competitionId),alreadyInAnnaEntries:currentAnnaSet.has(c.competitionId),classification,participantsScanned,lists,annaHit:found||null,detailTitle:d?.Description||c.tournamentName,detailStart:iso(d?.From)||c.startDate,detailEnd:iso(d?.To)||c.endDate,sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(c.competitionId)})}catch(e){detailErrors.push({...c,classification:'detail_error',error:e.message})}}
const annaHits=detailFindings.filter(x=>x.classification==='detail_contains_card_map_missing'||x.classification==='map_contains_card_but_entry_missing');
const out={version:'cw-v3-fitp-map-gap-diagnostic',generatedAt:NOW,playerId:ANNA_ID,playerName:'Anna Gambarini',membershipCard:ANNA_CARD,currentAnnaEntries:currentAnna.length,mapTournaments:mapIds.size,listedCandidates:candidates.length,detailsChecked:checked,annaHitsFound:annaHits.length,classificationCounts:detailFindings.reduce((a,x)=>{a[x.classification]=(a[x.classification]||0)+1;return a},{}),annaHits,detailFindings,detailErrors,listErrors};
await writeJson('dist/v3/fitp_map_gap_diagnostic.json',out);
console.log(JSON.stringify({...out,detailFindings:undefined},null,2));
if(detailErrors.length>80)process.exitCode=1;
