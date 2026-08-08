import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS='4332';
const SOURCE={cod:'1',name:'TORNEI FITP'};
const FETCH=100;
const MAX_PAGES=80;
const HORIZON_DAYS=430;
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(body){const r=await fetch(BASE+'/api/v3/tornei/puc/list',{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-individual-discovery/3.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(r.status+' '+text.slice(0,220));return text?JSON.parse(text):null}
const dd=n=>String(n).padStart(2,'0');
function it(d){return `${dd(d.getUTCDate())}/${dd(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`}
function iso(v){const s=String(v||'').trim();let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/^(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${dd(m[2])}-${dd(m[1])}`:''}
function addDays(d,n){return new Date(d.getTime()+n*864e5)}
function key(r){return String(r?.guid||r?.competitionId||'').toUpperCase()}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim()}
function basePayload(){return{guid:'',profilazione:'',freetext:'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS,sesso:'',data_inizio:'',data_fine:'',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:SOURCE.cod,id_fonte:SOURCE.name,rowstoskip:0,fetchrows:FETCH,sortcolumn:'',sortorder:''}}
function makeSpecs(){
  const out=[];const start=new Date(FROM+'T00:00:00Z');const limit=addDays(new Date(TODAY+'T00:00:00Z'),HORIZON_DAYS);
  // Daily is the canonical pass. Wider windows are reconciliation only, not a replacement.
  for(let s=new Date(start);s<=limit;s=addDays(s,1))out.push({mode:'daily',start:new Date(s),end:new Date(s)});
  for(const days of [3,7,14,31])for(let s=new Date(start);s<=limit;s=addDays(s,days)){const e=new Date(Math.min(limit.getTime(),addDays(s,days-1).getTime()));out.push({mode:`${days}d`,start:new Date(s),end:e})}
  // Additional current/open-search probes with no date, because public P.U.C. can expose registered/open tournaments outside date semantics.
  out.push({mode:'no_date_all',start:null,end:null});
  for(const text of ['JUNIOR NEXT GEN','UNDER','RODEO','CAMPIONATI ITALIANI','CAMPIONATI REGIONALI','OPEN','LOMB.','VENETO','TOS - T.'])out.push({mode:'freetext_'+text,start:null,end:null,freetext:text});
  return out;
}
function payload(spec,skip){const p=basePayload();p.rowstoskip=skip;if(spec.start){p.data_inizio=it(spec.start);p.data_fine=it(spec.end)}if(spec.freetext)p.freetext=spec.freetext;return p}
function accept(r){const id=key(r);if(!id||id==='11111111-1111-1111-1111-111111111111')return ['invalid_guid'];if(String(r.id_disciplina||'')!==TENNIS)return ['not_tennis'];if(String(r.cod_fonte||'')!==SOURCE.cod)return ['not_individual_fitp'];return []}
function statusOf(a,b){if(b&&b<TODAY)return 'finished';if(a&&a>TODAY)return 'upcoming';return 'active_or_open'}
const specs=makeSpecs();const byId=new Map(), seenQueryPages=new Set(), appearances={}, coverage={}, queries=[], errors=[], excludedMap=new Map();let i=0;
async function runSpec(spec){let prevSig='';for(let skip=0,page=0;page<MAX_PAGES;page++,skip+=FETCH){const body=payload(spec,skip);let j;try{j=await post(body)}catch(e){errors.push({mode:spec.mode,start:spec.start?it(spec.start):'',end:spec.end?it(spec.end):'',skip,error:e.message});break}const rows=j?.competizioni||[];const total=Number(j?.record||rows.length||0);const sig=rows.map(r=>key(r)).join('|');queries.push({mode:spec.mode,start:spec.start?it(spec.start):'',end:spec.end?it(spec.end):'',skip,rows:rows.length,total,first:key(rows[0]),last:key(rows.at(-1)),repeatedPage:sig&&sig===prevSig});if(!rows.length)break;if(sig&&sig===prevSig)break;prevSig=sig;const qKey=[spec.mode,spec.start?it(spec.start):'',spec.end?it(spec.end):'',skip,sig].join('~');if(seenQueryPages.has(qKey))break;seenQueryPages.add(qKey);for(const r of rows){const reasons=accept(r);const k=key(r);if(reasons.length){if(k&&!excludedMap.has(k))excludedMap.set(k,{competitionId:k,tournamentName:r.nome_torneo||r.name||'',disciplineId:String(r.id_disciplina||''),sourceCode:String(r.cod_fonte||''),sourceName:r.id_fonte||'',reasons});continue}if(!byId.has(k))byId.set(k,r);appearances[k]=(appearances[k]||0)+1;coverage[k]=coverage[k]||new Set();coverage[k].add(spec.mode)}if(rows.length<FETCH)break;if(total&&skip+FETCH>=total+FETCH)break}}
async function worker(){while(i<specs.length){const spec=specs[i++];await runSpec(spec)}}
await Promise.all(Array.from({length:8},worker));
const tournaments=[...byId.values()].map(r=>{const startDate=iso(r.data_inizio),rawEnd=iso(r.data_fine),endDate=rawEnd==='1900-01-01'?'':rawEnd,k=key(r);return{circuit:'fitp',competitionId:k,tournamentName:r.nome_torneo||'',location:[r.citta,r.sigla_provincia||r.provincia].filter(Boolean).join(' '),startDate,endDate,status:statusOf(startDate,endDate),disciplineId:String(r.id_disciplina||''),sourceCode:String(r.cod_fonte||''),sourceName:r.id_fonte||'',categoryAge:r.cat_eta||'',categoryClass:r.cat_class||'',tournamentType:r.tipo_torneo||'',club:r.tennisclub||'',onlineRegistration:r.iscrizione_online,authorized:r.torneo_autorizzato,sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(k),discoveryMethod:'fitp_individual_puc_list_rewritten_multi_strategy_no_player_keywords',dependsOnDraw:false,dependsOnOrderOfPlay:false,dependsOnResults:false,appearanceCount:appearances[k]||1,coverageModes:[...(coverage[k]||new Set())].sort(),lastSeen:NOW}}).filter(t=>!t.endDate||t.endDate>=FROM).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||a.tournamentName.localeCompare(b.tournamentName));
const byStatus=tournaments.reduce((a,t)=>{a[t.status]=(a[t.status]||0)+1;return a},{});
const byMode={};for(const modes of Object.values(coverage))for(const m of modes)byMode[m]=(byMode[m]||0)+1;
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'fitp_individual_tournament_discovery_rewritten_with_errors':'fitp_individual_tournament_discovery_rewritten_complete',source:'FITP individual tournaments only: official P.U.C. list, id_disciplina=4332 tennis, cod_fonte=1 Tornei FITP, no team championships, no player keywords for tournament universe, no draws, no OOP, no results. Multi-strategy date reconciliation plus public-list freetext categories; entries are confirmed later through official detail Participants.',coverageFrom:FROM,coverageUntil:addDays(new Date(TODAY+'T00:00:00Z'),HORIZON_DAYS).toISOString().slice(0,10),queries:queries.length,tournamentsFound:tournaments.length,bySource:{'TORNEI FITP':tournaments.length},byStatus,quality:{specs:specs.length,failedQueries:errors.length,emptyQueries:queries.filter(q=>q.rows===0).length,uniqueAccepted:tournaments.length,excluded:excludedMap.size,usesPlayerKeywords:false,usesDraws:false,usesOrderOfPlay:false,usesResults:false,individualOnly:true,teamChampionshipsIncluded:false,byMode},tournaments,errors};
const audit={...out,tournaments:undefined,queries,excluded:[...excludedMap.values()].slice(0,500),sample:tournaments.slice(0,100)};
await writeJson('dist/v3/source_fitp_tournaments.json',out);
await writeJson('dist/v3/source_fitp_tournaments_audit.json',audit);
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(tournaments.length<500||errors.length>100)process.exitCode=1;
