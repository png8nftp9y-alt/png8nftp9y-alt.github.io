import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const API='https://dp-fit-prod-function.azurewebsites.net/api/v6/player/sheet/simple';
function enc(card){return Buffer.from(String(card||''),'utf8').toString('base64')}
function normRanking(s){return String(s||'').replace(/\s+/g,'').replace(/^([1-4])NC$/i,'$1.NC').toUpperCase()}
function normClub(s){const t=String(s||'').replace(/\s+/g,' ').trim();const u=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(u.includes('TENNIS CLUB LECCO'))return 'Tennis Club Lecco';return t}
async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'))}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function fetchSheet(card){const body={cardNumber:enc(card)};const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-v3-player-club-updater/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(enc(card))},body:JSON.stringify(body)});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return {status:r.status,text,json}}
const data=await readJson('players.json');
const recovered=[];const errors=[];
for(const p of data.players||[]){
 if(!p.membershipCard)continue;
 try{
  const res=await fetchSheet(p.membershipCard);
  const raw=res.json?.player?.tennis_club_name || res.json?.player?.TennisClubName || res.json?.player?.club || '';
  const club=normClub(raw || p.club || '');
  const ranking=normRanking(res.json?.player?.ranking || res.json?.player?.Ranking || res.json?.player?.classification || res.json?.player?.classifica || '');
  const before=p.club||'',beforeRanking=p.ranking||'';
  if(club) p.club=club;
  if(ranking) p.ranking=ranking;
  recovered.push({playerId:p.id,playerName:p.name,membershipCard:p.membershipCard,status:res.status,rawClub:raw,club:p.club||'',changed:before!==p.club,ranking:p.ranking||'',rankingChanged:beforeRanking!==(p.ranking||''),previousRanking:beforeRanking});
 }catch(e){errors.push({playerId:p.id,playerName:p.name,error:e.message})}
}
data.profileSyncUpdatedAt=NOW;
await fs.writeFile('players.json',JSON.stringify(data,null,2)+'\n');
await writeJson('dist/v3/fitp_player_clubs_recovered.json',{generatedAt:NOW,playersInput:(data.players||[]).length,profilesChecked:recovered.length,clubsRecovered:recovered.filter(r=>r.club).length,changed:recovered.filter(r=>r.changed).length,rankingsChanged:recovered.filter(r=>r.rankingChanged).length,results:recovered,errors});
console.log(JSON.stringify({generatedAt:NOW,clubsRecovered:recovered.filter(r=>r.club).length,changed:recovered.filter(r=>r.changed).length,rankingsChanged:recovered.filter(r=>r.rankingChanged).length,errors},null,2));

