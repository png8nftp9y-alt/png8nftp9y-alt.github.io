import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TERMS=['IMPERIA','MILANO 3','MILANO3','MILANO TRE','TENNIS CLUB MILANO 3','TC MILANO 3','TENNIS CLUB IMPERIA','TC IMPERIA','KINDER','KINDER JOY','KINDER JOY OF MOVING'];
const CARDS={virginia_rossoni:'6701107987',alessio_nava:'9076909095'};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const card=v=>String(v||'').replace(/\D+/g,'');
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-missing-diagnostic/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,180));return t?JSON.parse(t):null}
function collectParticipants(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '),surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full1=`${name} ${surname}`.trim(),full2=`${surname} ${name}`.trim();const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',subscriptionDate:node.SubscriptionDate||''});for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}return into}
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const candidates=(map.tournaments||[]).filter(t=>{const s=norm([t.tournamentName,t.location,t.club,t.sourceName].join(' '));return TERMS.some(term=>s.includes(norm(term)))});
const inspected=[];
for(const t of candidates){
  const rec={competitionId:t.competitionId,tournamentName:t.tournamentName,location:t.location,club:t.club,startDate:t.startDate,endDate:t.endDate,coverageModes:t.coverageModes||[],matchedTerms:TERMS.filter(term=>norm([t.tournamentName,t.location,t.club].join(' ')).includes(norm(term)))};
  try{
    const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});
    const participants=[]; for(const draw of (d?.Tournaments||[])){for(const p of collectParticipants(draw.Participants||[]))participants.push({...p,draw:draw.TournamentDescription||draw.Description||''})}
    rec.draws=(d?.Tournaments||[]).map(x=>x.TournamentDescription||x.Description||'');
    rec.participantsCount=participants.length;
    rec.cardHits=Object.fromEntries(Object.entries(CARDS).map(([name,c])=>[name,participants.filter(p=>p.membershipCard===c).map(p=>({draw:p.draw,full1:p.full1,full2:p.full2,ranking:p.ranking,subscriptionDate:p.subscriptionDate}))]));
    rec.nearNameHits=participants.filter(p=>/ROSSONI|NAVA/i.test(`${p.full1} ${p.full2}`)).slice(0,20);
  }catch(e){rec.error=e.message}
  inspected.push(rec);
}
const out={generatedAt:NOW,mapGeneratedAt:map.generatedAt,tournamentsFound:map.tournamentsFound,candidates:candidates.length,terms:TERMS,cards:CARDS,inspected};
await writeJson('dist/v3/fitp_missing_diagnostic.json',out);
console.log(JSON.stringify({...out,inspected:out.inspected.map(x=>({competitionId:x.competitionId,tournamentName:x.tournamentName,location:x.location,matchedTerms:x.matchedTerms,participantsCount:x.participantsCount,cardHits:x.cardHits,nearNameHits:x.nearNameHits,error:x.error}))},null,2));
