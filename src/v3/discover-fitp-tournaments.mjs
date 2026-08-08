import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS_DISCIPLINE='4332';
const SOURCES=[{cod:'1',name:'TORNEI FITP'},{cod:'3',name:'CAMPIONATI A SQUADRE'}];
const WINDOW_DAYS=[7,14,31];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-reliable-tournament-discovery/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,220));return t?JSON.parse(t):null}
function it(d){return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`}
function iso(v){const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()}
function sourceKey(r){return String(r.guid||r.competitionId||'').toUpperCase()}
function wrongCircuit(name){const n=norm(name);if(/CAMPIONATI ITALIANI|QUALIFICAZIONE AI CAMPIONATI|CAMPIONATI REGIONALI/.test(n))return false;return /^TE\s|\bTENNIS EUROPE\b|\bTEJT\b|\bITF\b|CORETENNIS|\b(PESCARA|CREMA|SASSUOLO|AGNO|KOPER)\b/.test(n)}
function exclusionReason(r){if(!r.guid||r.guid==='11111111-1111-1111-1111-111111111111')return 'invalid_guid';if(String(r.id_disciplina||'')!==TENNIS_DISCIPLINE)return 'not_tennis_discipline';if(!['1','3'].includes(String(r.cod_fonte||'')))return 'not_fitp_tournament_or_team_championship';if(wrongCircuit(r.nome_torneo||r.name||''))return 'wrong_international_circuit_marker';return ''}
const start0=new Date(FROM+'T00:00:00Z'), limit=new Date(Date.now()+420*864e5);
const specs=[];for(const days of WINDOW_DAYS){for(let s=new Date(start0);s<=limit;s=new Date(s.getTime()+days*864e5)){const e=new Date(Math.min(limit.getTime(),s.getTime()+(days-1)*864e5));for(const source of SOURCES)specs.push({days,start:s,end:e,source})}}
function payload(s,skip){return{guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS_DISCIPLINE,sesso:'',data_inizio:it(s.start),data_fine:it(s.end),tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:s.source.cod,id_fonte:s.source.name,rowstoskip:skip,fetchrows:100,sortcolumn:'',sortorder:''}}
const rawRows=[],queries=[],errors=[];let si=0;
async function worker(){while(si<specs.length){const s=specs[si++];let skip=0,total=Infinity,page=0;while(skip<total&&page<200){try{const r=await post('/api/v3/tornei/puc/list',payload(s,skip));const got=r?.competizioni||[];total=Number(r?.record||got.length||0);rawRows.push(...got.map(x=>({...x,_windowDays:s.days,_querySource:s.source.cod,_queryStart:it(s.start),_queryEnd:it(s.end)})));queries.push({windowDays:s.days,source:s.source.cod,start:it(s.start),end:it(s.end),skip,rows:got.length,total});if(got.length<100)break;skip+=100;page++}catch(e){errors.push({windowDays:s.days,source:s.source.cod,start:it(s.start),end:it(s.end),skip,error:e.message});break}}}}
await Promise.all(Array.from({length:12},worker));
const rawById=new Map();const appearances={};for(const r of rawRows){const k=sourceKey(r);if(!k)continue;if(!rawById.has(k))rawById.set(k,r);appearances[k]=(appearances[k]||0)+1}
const excluded=[];const accepted=[];for(const r of rawById.values()){const reason=exclusionReason(r);if(reason)excluded.push({competitionId:r.guid||'',tournamentName:r.nome_torneo||r.name||'',disciplineId:String(r.id_disciplina||''),sourceCode:String(r.cod_fonte||''),sourceName:r.id_fonte||'',reason});else accepted.push(r)}
function statusOf(startDate,endDate){if(endDate&&endDate<TODAY)return 'finished';if(startDate&&startDate>TODAY)return 'upcoming';return 'active_or_open'}
const tournaments=accepted.map(r=>{const startDate=iso(r.data_inizio),endDate=iso(r.data_fine);return{circuit:'fitp',competitionId:r.guid,tournamentName:r.nome_torneo||'',location:[r.citta,r.sigla_provincia||r.provincia].filter(Boolean).join(' '),startDate,endDate,status:statusOf(startDate,endDate),disciplineId:String(r.id_disciplina||''),sourceCode:String(r.cod_fonte||''),sourceName:r.id_fonte||'',categoryAge:r.cat_eta||'',categoryClass:r.cat_class||'',tournamentType:r.tipo_torneo||'',club:r.tennisclub||'',onlineRegistration:r.iscrizione_online,authorized:r.torneo_autorizzato,sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(r.guid),discoveryMethod:'structured_puc_tournament_list_only_multi_window_reconciled',dependsOnDraw:false,dependsOnOrderOfPlay:false,dependsOnResults:false,appearanceCount:appearances[sourceKey(r)]||1,lastSeen:NOW}}).filter(t=>!t.endDate||t.endDate>=FROM).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||a.tournamentName.localeCompare(b.tournamentName));
const duplicateRows=rawRows.length-rawById.size;
const bySource=tournaments.reduce((a,t)=>{a[t.sourceName||t.sourceCode]=(a[t.sourceName||t.sourceCode]||0)+1;return a},{});
const byStatus=tournaments.reduce((a,t)=>{a[t.status]=(a[t.status]||0)+1;return a},{});
const byWindow=queries.reduce((a,q)=>{const k=`${q.windowDays}d`;a[k]=(a[k]||0)+q.rows;return a},{});
const qc={rawRows:rawRows.length,uniqueRawCompetitions:rawById.size,duplicateRows,accepted:tournaments.length,excluded:excluded.length,queries:queries.length,failedQueries:errors.length,emptyQueries:queries.filter(q=>q.rows===0).length,coverageFrom:FROM,coverageUntil:limit.toISOString().slice(0,10),usesKeywords:false,usesDraws:false,usesOrderOfPlay:false,usesResults:false,windowDays:WINDOW_DAYS};
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'fitp_tournament_discovery_complete_with_query_errors':'fitp_tournament_discovery_reliable_complete',source:'FITP P.U.C. reliable tournament search only: id_disciplina=4332 tennis; cod_fonte=1 Tornei FITP or 3 Campionati a squadre; freetext empty; reconciled 7/14/31-day windows; no draws; no order of play; no results',coverageFrom:FROM,coverageUntil:qc.coverageUntil,queries:queries.length,tournamentsFound:tournaments.length,bySource,byStatus,quality:qc,tournaments,errors};
const audit={...out,tournaments:undefined,queries,excluded,rawSample:[...rawById.values()].slice(0,50).map(r=>({competitionId:r.guid,tournamentName:r.nome_torneo,disciplineId:r.id_disciplina,sourceCode:r.cod_fonte,sourceName:r.id_fonte,startDate:iso(r.data_inizio),endDate:iso(r.data_fine),appearances:appearances[sourceKey(r)]||1}))};
await writeJson('dist/v3/source_fitp_tournaments.json',out);
await writeJson('dist/v3/source_fitp_tournaments_audit.json',audit);
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(tournaments.length<200||errors.length)process.exitCode=1;
