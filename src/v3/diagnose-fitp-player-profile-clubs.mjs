import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://www.fitp.it/Pagina-Giocatore/?cardNumber=';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function card(v){return String(v||'').replace(/\D+/g,'')}
function b64(s){return Buffer.from(String(s||''),'utf8').toString('base64')}
function clean(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function normClub(s){const t=String(s||'').replace(/\s+/g,' ').trim();const u=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(u.includes('TENNIS CLUB LECCO'))return 'Tennis Club Lecco';return t}
function extractClub(html){
  const text=clean(html);
  const pats=[/Circolo\s*(?:di\s*)?(?:appartenenza)?\s*[:\-]?\s*([^|•;]{3,120})/i,/Tesserato\s*(?:presso|per)\s*([^|•;]{3,120})/i,/Societ[aà]\s*[:\-]?\s*([^|•;]{3,120})/i,/Affiliato\s*[:\-]?\s*([^|•;]{3,120})/i];
  for(const p of pats){const m=text.match(p);if(m)return normClub(m[1].replace(/Classifica.*$/i,'').replace(/Categoria.*$/i,'').trim())}
  const jsonMatches=[...html.matchAll(/"(?:club|circolo|societa|society|affiliation|affiliato|denominazione)"\s*:\s*"([^"]{3,160})"/gi)];
  if(jsonMatches[0])return normClub(jsonMatches[0][1]);
  if(text.toUpperCase().includes('TENNIS CLUB LECCO'))return 'Tennis Club Lecco';
  return '';
}
async function fetchPage(cardNumber){const url=BASE+encodeURIComponent(b64(cardNumber));const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-profile-club-diagnostic/1.0','accept':'text/html,application/xhtml+xml'}});const html=await r.text();return {url,status:r.status,html}}
const playersJson=await readJson('players.json',{players:[]});
const players=(playersJson.players||[]).filter(p=>p.membershipCard);
const results=[];const errors=[];
let i=0;async function worker(){while(i<players.length){const p=players[i++];try{const res=await fetchPage(card(p.membershipCard));const club=extractClub(res.html);results.push({playerId:p.id,playerName:p.name,membershipCard:card(p.membershipCard),profileUrl:res.url,status:res.status,currentClub:p.club||'',club,normalizedClub:normClub(club||p.club||''),htmlSignals:{hasTennisClubLecco:/TENNIS\s+CLUB\s+LECCO/i.test(res.html),length:res.html.length,title:(res.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||''}})}catch(e){errors.push({playerId:p.id,playerName:p.name,error:e.message})}}}
await Promise.all(Array.from({length:6},worker));
const out={generatedAt:NOW,playersInput:players.length,profilesChecked:results.length,clubsFound:results.filter(r=>r.club).length,results:results.sort((a,b)=>a.playerId.localeCompare(b.playerId)),errors};
await writeJson('dist/v3/fitp_player_profile_clubs.json',out);
console.log(JSON.stringify(out,null,2));
if(errors.length>5)process.exitCode=1;
