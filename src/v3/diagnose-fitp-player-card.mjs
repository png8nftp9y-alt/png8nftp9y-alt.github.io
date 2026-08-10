import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TARGET={name:'Anna Gambarini',aliases:['ANNA GAMBARINI','GAMBARINI ANNA','GAMBARINI'],knownRanking:'3.4',knownClub:'ASSOCIAZIONE SPORTIVA DILETTANTISTICA TENNIS CLUB LECCO'};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-player-card-diagnostic/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,180));return t?JSON.parse(t):null}
function collectParticipants(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '),surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full1=`${name} ${surname}`.trim(),full2=`${surname} ${name}`.trim();const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',subscriptionDate:node.SubscriptionDate||'',raw:node});for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}return into}
function isTarget(p){const names=[norm(p.full1),norm(p.full2)].filter(Boolean);const aliases=TARGET.aliases.map(norm);return aliases.some(a=>names.includes(a))||names.some(n=>n.includes(norm('GAMBARINI'))&&n.includes(norm('ANNA')))}
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const tournaments=(map.tournaments||[]).filter(t=>t.circuit==='fitp'&&String(t.sourceCode)==='1'&&t.competitionId&&(!t.endDate||String(t.endDate)>='2025-12-18'));
let idx=0,checked=0,errors=[];const hits=[];
async function worker(){while(idx<tournaments.length){const t=tournaments[idx++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});checked++;for(const draw of (d?.Tournaments||[])){for(const p of collectParticipants(draw.Participants||[])){if(!isTarget(p))continue;hits.push({competitionId:t.competitionId,tournamentName:d.Description||t.tournamentName,location:[d.Municipality||'',d.Province||''].filter(Boolean).join(' ')||t.location||'',startDate:d.From||t.startDate||'',endDate:d.To||t.endDate||'',draw:draw.TournamentDescription||draw.Description||'',full1:p.full1,full2:p.full2,membershipCard:p.membershipCard,ranking:p.ranking,subscriptionDate:p.subscriptionDate,sourceUrl:t.sourceUrl||('https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(t.competitionId))});}}}catch(e){errors.push({competitionId:t.competitionId,error:e.message});}}}
await Promise.all(Array.from({length:12},worker));
const byCard={};for(const h of hits){const k=h.membershipCard||'NO_CARD';byCard[k]=(byCard[k]||0)+1}
const out={generatedAt:NOW,target:TARGET,tournamentsInput:tournaments.length,detailsChecked:checked,hitsFound:hits.length,byCard,hits,errors:errors.slice(0,50)};
await writeJson('dist/v3/fitp_player_card_diagnostic.json',out);
console.log(JSON.stringify({...out,hits:hits.slice(0,20)},null,2));
if(!hits.length)process.exitCode=2;
