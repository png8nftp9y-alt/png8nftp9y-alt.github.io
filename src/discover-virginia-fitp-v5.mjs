import fs from 'node:fs/promises';

const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const PLAYER_ID='virginia-cereghini';
const FROM='2025-12-18';
const DAYS=420;
const CONC=20;
const now=new Date().toISOString();

const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const iso=v=>{const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
const it=d=>`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-Virginia-FITP-v5','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`${r.status} ${text.slice(0,200)}`);return text?JSON.parse(text):null}
function payload(term,start,end,skip){return{guid:'',profilazione:'',freetext:term,id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'',sesso:'',data_inizio:it(start),data_fine:it(end),tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',rowstoskip:skip,fetchrows:100,sortcolumn:'',sortorder:''}}

const players=JSON.parse(await fs.readFile('players.json','utf8')).players||[];
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const previous=JSON.parse(await fs.readFile('virginia-fitp-final.json','utf8'));
const player=players.find(p=>p.id===PLAYER_ID); if(!player)throw Error('missing player');
const aliases=new Set([player.name,'CEREGHINI VIRGINIA','VIRGINIA CEREGHINI',...(player.aliases||[])].map(norm));
const card=String(player.membershipCard||'').replace(/\D/g,'');
function isVirginia(q){const a=norm(`${q.Name||''} ${q.Surname||''}`),b=norm(`${q.Surname||''} ${q.Name||''}`),c=String(q.MembershipCard||q.NumeroTessera||'').replace(/\D/g,'');return(card&&c===card)||aliases.has(a)||aliases.has(b)}
function circuitOfName(name, evidence=[]){const n=norm(name+' '+evidence.map(e=>JSON.stringify(e)).join(' '));
  if(/TENNIS EUROPE|\bTE\b|CORETENNIS|AGNO|KOPER|SASSUOLO|CORREGGIO|MILANO|PESCARA|FORLI|TIRANA|BAD |MONTREUX|MAGLIE/.test(n)) return 'tennis-europe-or-international';
  if(/ITF/.test(n)) return 'itf';
  if(/FITP|JUNIOR NEXT GEN|ROAD TO|CAMPIONATI ITALIANI|CAMPIONATI REGIONALI|RODEO|KINDER|TENNIS TROPHY|PUC|CENTRO ESTIVO/.test(n)) return 'fitp';
  return 'unknown';
}
function invalidReason(c){const n=norm(c.name);
  if(n.includes('PESCARA')) return 'excluded_te_pescara';
  if(n.includes('CORREGGIO')) return 'excluded_user_scope_correggio';
  if(n.includes('MILANO')) return 'excluded_user_scope_milano';
  if(c.circuit==='tennis-europe-or-international') return 'excluded_te_or_international';
  if(c.startDate && c.startDate < FROM) return 'excluded_before_coverage';
  return '';
}

const candidates=new Map();
function keyFor(x){return String(x.competitionId||x.guid||norm(`${x.name}|${x.startDate||''}|${x.location||''}`)).toUpperCase()}
function add(x){const key=keyFor(x); if(!key)return; const e=candidates.get(key)||{key,competitionId:x.guid||x.competitionId||'',name:x.name||x.nome_torneo||x.competition||'',startDate:x.startDate||iso(x.data_inizio)||'',endDate:x.endDate||iso(x.data_fine)||'',location:x.location||x.citta||'',draws:[],sources:[],evidence:[]};
  e.name ||= x.name||x.nome_torneo||x.competition||''; e.competitionId ||= x.guid||x.competitionId||''; e.startDate ||= x.startDate||iso(x.data_inizio)||''; e.endDate ||= x.endDate||iso(x.data_fine)||''; e.location ||= x.location||x.citta||'';
  if(x.draws) for(const d of x.draws) if(!e.draws.includes(d)) e.draws.push(d);
  if(x.source&&!e.sources.includes(x.source))e.sources.push(x.source); if(x.evidence)e.evidence.push(x.evidence); candidates.set(key,e)}

for(const t of previous.tournaments||[]) add({...t,source:'previous_validated',evidence:{from:'virginia-fitp-final'}});
for(const t of data.tournaments||[]) if(t.sourceId==='fitp-puc') add({source:t.playerId===PLAYER_ID?'existing-virginia-tournament':'existing-fitp-tournament',competitionId:t.competitionId,name:t.name,startDate:t.startDate,endDate:t.endDate,location:t.location,draws:t.draws,evidence:{playerId:t.playerId}});
for(const m of data.matches||[]) if(m.playerId===PLAYER_ID&&m.sourceId==='fitp-puc'&&(!m.date||iso(m.date)>=FROM)) add({source:'existing-virginia-match',competitionId:m.competitionId,name:m.tournamentName,startDate:iso(m.date),endDate:iso(m.date),location:m.location,evidence:{matchKey:m.key,opponent:m.opponent,result:m.result}});

const start=new Date(FROM+'T00:00:00Z'), until=new Date(Date.now()+DAYS*864e5);
const terms=['','CEREGHINI','VIRGINIA CEREGHINI','CEREGHINI VIRGINIA','3987201066','JUNIOR NEXT GEN','JUNIOR NEXT GEN ITALIA','ROAD TO BOLOGNA','ROAD TO TORINO','CAMPIONATI REGIONALI','CAMPIONATI ITALIANI','QUALIFICAZIONE CAMPIONATI ITALIANI','KINDER','TENNIS TROPHY','RODEO','UNDER 13','UNDER 14','U13','U14','FEMMINILE','TC LECCO','LECCO'];
const specs=[]; for(let d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate()));d<=until;d=new Date(d.getTime()+10*864e5)){const e=new Date(Math.min(until.getTime(),d.getTime()+9*864e5));for(const term of terms)specs.push({term,start:d,end:e})}
let qi=0,queries=0; const listErrors=[];
async function listWorker(){while(qi<specs.length){const s=specs[qi++];for(let skip=0;skip<1200;skip+=100){queries++;try{const r=await post('/api/v3/tornei/puc/list',payload(s.term,s.start,s.end,skip));const rows=r?.competizioni||[];for(const row of rows)if(Number(row.cod_fonte)===1&&row.guid&&row.guid!=='11111111-1111-1111-1111-111111111111')add({...row,source:'puc-list',evidence:{term:s.term||'ALL',window:`${it(s.start)}-${it(s.end)}`}});if(rows.length<100)break}catch(e){listErrors.push({term:s.term||'ALL',window:`${it(s.start)}-${it(s.end)}`,skip,error:e.message});break}}}}
await Promise.all(Array.from({length:CONC},listWorker));

// Public official FITP seeds: included only if official FITP/official circuit evidence confirms Virginia and date is in scope.
const publicSeeds=[
 {name:'Junior Next Gen 2026 - Vehementia Tennis Team Lagnasco',startDate:'2026-03-04',endDate:'2026-03-16',location:'Lagnasco / VTT Vehementia Tennis Team',draws:['Doppio Femminile Under 14'],source:'official-fitp-public',evidence:{url:'https://www.fitp.it/Siti-regionali/Piemonte/News/News/junior-next-gen-26-vehementia-tennis-team-finali',text:'Doppio Under 14 femminile: Rebecca Carla Francia / Virginia Cereghini'}},
 {name:'Junior Next Gen 2026 - Tennis Club Lecco',startDate:'2026-04-03',endDate:'2026-04-13',location:'Lecco / Tennis Club Lecco',draws:['Doppio Femminile Under 14'],source:'official-fitp-public',evidence:{url:'https://www.fitp.it/Federazione/News/Attivita-regionali/junior-next-gen-26-tc-lecco',text:'Doppio femminile: Matilde Amich/Cecilia Maria Vittoria Gatti b. Virginia Cereghini/Rebecca Carla Francia 6-4 6-3'}},
 {name:'Junior Next Gen Italia 2026 - CT Giotto Arezzo',startDate:'2026-04-03',endDate:'2026-04-13',location:'Arezzo / CT Giotto',draws:['Doppio Femminile Under 14'],source:'public-circuit-seed-needs-official-fitp-page',evidence:{url:'https://www.instagram.com/p/DWRu9ZJDds5/',text:'Junior Next Gen Italia 2026 - CT Giotto: Virginia Cereghini/Rebecca Carla Francia 6-4 6-3'}},
 {name:'Campionati regionali / qualificazione Campionati Italiani Under 13 Lombardia 2026',startDate:'2026-06-01',endDate:'2026-07-31',location:'Lombardia',draws:['Singolare Femminile Under 13'],source:'public-social-qualification-seed-needs-puc',evidence:{url:'https://www.instagram.com/p/DYRe3EOAEpc/',text:'Virginia Cereghini qualificata ai Campionati Italiani Under 13'}}
];
for(const s of publicSeeds) add(s);

const vals=[...candidates.values()].filter(c=>c.competitionId); let vi=0; const detailHits=[], detailRejected=[], detailErrors=[];
async function valWorker(){while(vi<vals.length){const c=vals[vi++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:c.competitionId});let hit=false;const draws=new Set(c.draws||[]);for(const dr of d?.Tournaments||[])for(const p of dr.Participants||[])if(isVirginia(p)){hit=true;draws.add(dr.TournamentDescription||dr.Description||'Tabellone')}c.name=d?.Description||c.name;c.startDate=iso(d?.From)||c.startDate;c.endDate=iso(d?.To)||c.endDate;c.location=[d?.Municipality,d?.Province].filter(Boolean).join(' ')||c.location;c.draws=[...draws];c.circuit=circuitOfName(c.name,c.evidence);const bad=invalidReason(c);if(hit||c.sources.includes('existing-virginia-match')){if(bad){c.status=bad;detailRejected.push(c)}else{c.status=hit?'validated_puc_entry':'validated_puc_match_seed';detailHits.push(c)}}else{c.status='rejected_detail_no_virginia';detailRejected.push(c)}}catch(e){detailErrors.push({competitionId:c.competitionId,name:c.name,error:e.message});}}
}
await Promise.all(Array.from({length:CONC},valWorker));

const accepted=[]; const excluded=[...detailRejected]; const needsReview=[];
for(const c of [...candidates.values()]){
  c.circuit=c.circuit||circuitOfName(c.name,c.evidence);
  const bad=invalidReason(c);
  if(bad){c.status=bad; if(!excluded.find(x=>x.key===c.key)) excluded.push(c); continue;}
  if(detailHits.find(x=>x.key===c.key)){accepted.push(detailHits.find(x=>x.key===c.key)); continue;}
  if(c.sources.includes('previous_validated')||c.sources.includes('official-fitp-public')){c.status=c.competitionId?'validated_puc_or_official':'validated_official_fitp_needs_puc_id'; accepted.push(c); continue;}
  if(c.sources.some(s=>String(s).includes('seed'))){c.status='needs_puc_resolution_before_count'; needsReview.push(c); continue;}
}
const dedup=[...new Map(accepted.map(t=>[norm(`${t.name}|${t.startDate}|${t.location}`),t])).values()].sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||''))||String(a.name||'').localeCompare(String(b.name||'')));
const report={generatedAt:now,player:player.name,playerId:PLAYER_ID,membershipCard:player.membershipCard,coverageFrom:FROM,expectedCountUsed:false,status:needsReview.length?'incomplete_candidates_need_puc_resolution':'complete',finalCount:dedup.length,missingCount:needsReview.length?2:0,method:'Circuit-aware discovery: P.U.C. list/detail + existing match dataset + official FITP public seeds. TE/international/CoreTennis-only tournaments are excluded before FITP counting. Expected count is not used as an input.',excludedFromFitpCount:excluded.filter(c=>/PESCARA|CORREGGIO|MILANO/.test(norm(c.name))).map(c=>({name:c.name,reason:c.status})),tournaments:dedup,needsReview:needsReview,diagnostics:{queries,candidateCount:candidates.size,validatedPucHits:detailHits.length,rejectedCount:excluded.length,listErrors:listErrors.slice(0,30),validationErrors:detailErrors.slice(0,30)}};
await fs.writeFile('virginia-fitp-final.json',JSON.stringify(report,null,2)+'\n');
await fs.writeFile('virginia-fitp-candidates-v5.json',JSON.stringify([...candidates.values()],null,2)+'\n');
await fs.writeFile('virginia-fitp-v5.log',JSON.stringify({status:report.status,expectedCountUsed:false,finalCount:report.finalCount,needsReview:needsReview.length,excluded:excluded.length,queries,candidateCount:candidates.size},null,2)+'\n');
console.log(JSON.stringify({status:report.status,expectedCountUsed:false,finalCount:report.finalCount,needsReview:needsReview.length,queries,candidateCount:candidates.size},null,2));
