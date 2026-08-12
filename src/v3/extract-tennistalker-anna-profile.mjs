import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const API='https://api.tennistalker.it/api';
const PLAYER_ID='304952';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function getJson(path){const r=await fetch(API+path,{headers:{'user-agent':'Mozilla/5.0 CourtWatch TennisTalker profile extract','accept':'application/json','origin':'https://www.tennistalker.it','referer':'https://www.tennistalker.it/giocatore/'+PLAYER_ID}});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return{status:r.status,contentType:r.headers.get('content-type')||'',text,json}}
function summarizeMatch(m){return{ id:m?.id, result:m?.result, has_won:m?.has_won, date:m?.date||m?.played_at||m?.match_date||m?.created_at, tournament:m?.tournament||m?.competition||m?.fit_tournament||m?.tournament_name||m?.competition_name, draw:m?.draw||m?.draw_name, first_opponent:m?.first_opponent, second_opponent:m?.second_opponent, rawKeys:m&&typeof m==='object'?Object.keys(m):[] }}
const profileRes=await getJson(`/fit-player-profiles/${PLAYER_ID}`);
const statsRes=await getJson(`/fit-player-profiles/${PLAYER_ID}/stats`);
const profile=profileRes.json||{};
const stats=statsRes.json||{};
const out={version:'cw-v3-tennistalker-anna-profile-extract',generatedAt:NOW,profileStatus:profileRes.status,statsStatus:statsRes.status,identity:{id:profile.id,name:profile.name,card_number:profile.card_number,anagrafica_code:profile.anagrafica_code,rank:profile.rank,category:profile.category,club:profile.club},counts:{matches:profile.matches,competitions_counter:stats.competitions_counter,matches_per_tournament:stats.matches_per_tournament,matches_per_competition:stats.matches_per_competition,available_years:stats.available_years,last_match_year:profile.last_match_year,fit_year:profile.fit_year},active_competitions:profile.active_competitions||[],last_matches:(profile.last_matches||[]).map(summarizeMatch),last_competition:stats.last_competition||null,profileKeys:Object.keys(profile),statsKeys:Object.keys(stats)};
await writeJson('dist/v3/tennistalker_anna_profile_extract.json',out);
console.log(JSON.stringify(out,null,2));
