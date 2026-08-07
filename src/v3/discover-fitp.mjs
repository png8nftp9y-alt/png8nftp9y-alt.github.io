import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,160));return t?JSON.parse(t):null}
function it(d){return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`}
function iso(v){const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}
function matchPlayer(full,players){const n=norm(full);return players.find(p=>norm(p.name)===n||(p.aliases||[]).some(a=>norm(a)===n))}
function circuitMismatch(name){const n=norm(name);if(/CAMPIONATI ITALIANI|QUALIFICAZIONE AI CAMPIONATI|CAMPIONATI REGIONALI/.test(n))return false;return /^TE\s|\bTENNIS EUROPE\b|\bTEJT\b|\bITF\b|CORETENNIS|\b(PESCARA|CREMA|SASSUOLO|AGNO|KOPER|CORREGGIO|MILANO)\b/.test(n)}
const players=(await readJson('players.json',{players:[]})).players||[];
const fitpPlayers=players.filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='FITP'));
const start0=new Date(FROM+'T00:00:00Z'), limit=new Date(Date.now()+420*864e5);
const terms=['','JUNIOR','UNDER','U10','U11','U12','U13','U14','U16','U18','NEXT GEN','CAMPIONATI','QUALIFICAZIONE','KINDER','ITALIANI','RODEO','TORNEO'];
const specs=[];for(let s=new Date(start0);s<=limit;s=new Date(s.getTime()+14*864e5)){const e=new Date(Math.min(limit.getTime(),s.getTime()+13*864e5));for(const term of terms)specs.push({term,start:s,end:e})}
const all=[],queries=[],errors=[];let si=0;
function payload(s,skip){return{guid:'',profilazione:'',freetext:s.term,id_regione:'',id_provincia:'',id_stato:'',id_disciplina:'',sesso:'',data_inizio:it(s.start),data_fine:it(s.end),tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',rowstoskip:skip,fetchrows:100,sortcolumn:'',sortorder:''}}
async function listWorker(){while(si<specs.length){const s=specs[si++];let skip=0,total=Infinity;while(skip<total&&skip<1000){try{const r=await post('/api/v3/tornei/puc/list',payload(s,skip));const rows=r?.competizioni||[];total=Number(r?.record||rows.length||0);const official=rows.filter(x=>x.guid&&x.guid!=='11111111-1111-1111-1111-111111111111');all.push(...official);queries.push({term:s.term||'ALL',start:it(s.start),end:it(s.end),skip,rows:rows.length,official:official.length});if(rows.length<100)break;skip+=100}catch(e){errors.push(`list ${s.term} ${it(s.start)}: ${e.message}`);break}}}}
await Promise.all(Array.from({length:16},listWorker));
const comps=[...new Map(all.map(c=>[String(c.guid).toUpperCase(),c])).values()].filter(c=>!circuitMismatch(c.nome_torneo||c.name||''));
const entries=[];let ci=0;
async function detailWorker(){while(ci<comps.length){const c=comps[ci++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:c.guid});const hits=new Map();for(const draw of d?.Tournaments||[])for(const q of draw.Participants||[]){const full=`${q.Name||''} ${q.Surname||''}`.trim(), alt=`${q.Surname||''} ${q.Name||''}`.trim();const p=matchPlayer(full,fitpPlayers)||matchPlayer(alt,fitpPlayers);if(!p)continue;const h=hits.get(p.id)||{player:p,draws:[],ranking:q.Ranking||'',membershipCard:q.MembershipCard||''};h.draws.push(draw.TournamentDescription);hits.set(p.id,h)}for(const h of hits.values()){const st=iso(d.From||c.data_inizio), en=iso(d.To||c.data_fine);if(en&&en<FROM)continue;entries.push({playerId:h.player.id,playerName:h.player.name,circuit:'fitp',competitionId:c.guid,tournamentName:d.Description||c.nome_torneo||'',location:[d.Municipality||c.citta,d.Province||c.provincia].filter(Boolean).join(' '),startDate:st,endDate:en,draws:[...new Set(h.draws)],ranking:h.ranking,membershipCard:h.membershipCard,sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(c.guid),source:'FITP P.U.C. official detail',lastSeen:NOW})}}catch(e){errors.push(`detail ${c.guid}: ${e.message}`)}}}
await Promise.all(Array.from({length:16},detailWorker));
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'complete',source:'ex novo FITP P.U.C. discovery, independent from v1/v2/data.json',coverageFrom:FROM,queries:queries.length,competitionsChecked:comps.length,entriesFound:entries.length,entries,errors:errors.slice(0,200)};
await writeJson('dist/v3/source_fitp_entries.json',out);
console.log(JSON.stringify({...out,entries:undefined},null,2));
