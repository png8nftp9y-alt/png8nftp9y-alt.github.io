import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const FROM='2025-12-18';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-player-club-diagnostic/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,180));return t?JSON.parse(t):null}
function findClub(node){
  if(!node||typeof node!=='object')return '';
  const direct=node.Club||node.ClubName||node.ClubDescription||node.ClubDesc||node.Affiliate||node.AffiliateName||node.Affiliation||node.Affiliazione||node.Circolo||node.CircoloName||node.Societa||node.Society||node.Team||node.Associazione||node.TesseratoClub;
  if(typeof direct==='string'&&direct.trim())return direct.trim();
  for(const [k,v] of Object.entries(node)){
    if(/club|circolo|affili|societ|associaz/i.test(k)){
      if(typeof v==='string'&&v.trim())return v.trim();
      if(v&&typeof v==='object'){
        for(const kk of ['Name','Description','Descrizione','Denominazione','Title','Value']){
          if(typeof v[kk]==='string'&&v[kk].trim())return v[kk].trim();
        }
      }
    }
  }
  return '';
}
function collectParticipants(node,into=[]){
  if(!node||typeof node!=='object')return into;
  if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}
  const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '),surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');
  const full1=`${name} ${surname}`.trim(),full2=`${surname} ${name}`.trim();
  const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);
  const club=findClub(node);
  if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,club,ranking:node.Ranking||node.Classifica||'',rawKeys:Object.keys(node).sort()});
  for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}
  return into;
}
function simplifyClub(v){
  const s=String(v||'').trim().replace(/\s+/g,' ');
  const n=norm(s);
  if(!s)return '';
  if(n.includes('TENNIS CLUB LECCO'))return 'Tennis Club Lecco';
  return s;
}
const playersJson=await readJson('players.json',{players:[]});
const players=(playersJson.players||[]).filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='FITP')).map(p=>({...p,_card:card(p.membershipCard)}));
const byCard=new Map(players.filter(p=>p._card).map(p=>[p._card,p]));
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const tournaments=(map.tournaments||[]).filter(t=>t.circuit==='fitp'&&String(t.sourceCode)==='1'&&t.competitionId&&(!t.endDate||String(t.endDate)>=FROM));
let idx=0,checked=0;const errors=[],hits=[];
async function worker(){while(idx<tournaments.length){const t=tournaments[idx++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});checked++;for(const draw of (d?.Tournaments||[])){for(const p of collectParticipants(draw.Participants||[])){if(!p.membershipCard||!byCard.has(p.membershipCard))continue;const player=byCard.get(p.membershipCard);hits.push({playerId:player.id,playerName:player.name,membershipCard:p.membershipCard,club:simplifyClub(p.club),rawClub:p.club,ranking:p.ranking,competitionId:t.competitionId,tournamentName:d.Description||t.tournamentName,draw:draw.TournamentDescription||draw.Description||'',rawKeys:p.rawKeys});}}}catch(e){errors.push({competitionId:t.competitionId,error:e.message});}}}
await Promise.all(Array.from({length:12},worker));
const byPlayer={};
for(const h of hits){const rec=byPlayer[h.playerId]||{playerName:h.playerName,membershipCard:h.membershipCard,currentClub:simplifyClub(players.find(p=>p.id===h.playerId)?.club||''),clubs:{},examples:[]}; if(h.club)rec.clubs[h.club]=(rec.clubs[h.club]||0)+1; if(rec.examples.length<5)rec.examples.push(h); byPlayer[h.playerId]=rec;}
for(const rec of Object.values(byPlayer)){const sorted=Object.entries(rec.clubs).sort((a,b)=>b[1]-a[1]);rec.suggestedClub=sorted[0]?.[0]||rec.currentClub||'';rec.clubOptions=sorted.map(([club,count])=>({club,count}));}
const out={generatedAt:NOW,tournamentsInput:tournaments.length,detailsChecked:checked,playersInput:players.length,hitsFound:hits.length,playersWithClubSuggestions:Object.values(byPlayer).filter(r=>r.suggestedClub).length,byPlayer,errors:errors.slice(0,50)};
await writeJson('dist/v3/fitp_player_club_diagnostic.json',out);
console.log(JSON.stringify({...out,byPlayer:Object.fromEntries(Object.entries(byPlayer).map(([k,v])=>[k,{...v,examples:v.examples.slice(0,1)}]))},null,2));
if(errors.length>100)process.exitCode=1;
