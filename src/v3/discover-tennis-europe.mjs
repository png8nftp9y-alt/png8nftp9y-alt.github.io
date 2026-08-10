import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
const HOSTS=['https://te.tournamentsoftware.com','https://www.tournamentsoftware.com'];
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function profileId(url){return (String(url).match(/player-profile\/([0-9A-F-]{36})/i)||[])[1]||''}
function tourId(url){return (String(url).match(/sport\/tournament(?:\.aspx)?\?id=([0-9A-F-]{36})/i)||[])[1]||''}
function absUrl(href,base='https://te.tournamentsoftware.com'){try{return new URL(String(href).replace(/&amp;/g,'&'),base).toString()}catch{return ''}}
function textClean(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function isoFromAny(s){s=String(s||'');let m=s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;return ''}
function dateRange(s){const dates=[...String(s||'').matchAll(/(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})/g)].map(x=>isoFromAny(x[0])).filter(Boolean);return {startDate:dates[0]||'',endDate:dates.at(-1)||dates[0]||''}}
async function get(url,attempt=0){try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-tennis-europe-discovery/1.0','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en,it;q=0.8'}});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,120));return t}catch(e){if(attempt<2){await sleep(500*(attempt+1));return get(url,attempt+1)}throw e}}
function tournamentLinks(html,base){const out=[];const re=/<a\b[^>]*href=["']([^"']*(?:sport\/tournament|tournament\.aspx)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){const url=absUrl(m[1],base);const id=tourId(url);if(!id)continue;out.push({id,url,title:textClean(m[2])})}return [...new Map(out.map(x=>[x.id,x])).values()]}
function playerNameHit(html,player){const n=norm(html);const names=[player.name,...(player.aliases||[])].map(norm).filter(Boolean);return names.some(x=>x&&n.includes(x))}
async function tournamentEntryForPlayer(link,player){const html=await get(link.url);if(!playerNameHit(html,player))return null;const pageText=textClean(html);const {startDate,endDate}=dateRange(pageText);const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];let tournamentName=textClean(title)||link.title||'Tennis Europe tournament';tournamentName=tournamentName.replace(/\s*-\s*TournamentSoftware.*$/i,'').trim();return {playerId:player.id,playerName:player.name,circuit:'tennis-europe',competitionId:link.id,tournamentName,teTournamentId:link.id,startDate,endDate,sourceUrl:link.url,source:'Tennis Europe / TournamentSoftware official tournament page scanned from player profile',entryStatus:'entry_confirmed_by_official_tournamentsoftware_player_hit',confirmationSource:'official_tournamentsoftware_page_contains_player',lastSeen:NOW}}
const players=(await readJson('players.json',{players:[]})).players||[];
const tePlayers=players.filter(p=>(p.circuits||[]).some(c=>/tennis europe/i.test(String(c))));
const entries=[],errors=[];
for(const p of tePlayers){
  const urls=[p.profileSync?.tennisEurope?.url,...(p.officialUrls?.tennisEurope||[])].filter(Boolean).filter(u=>/player-profile\/[0-9A-F-]{36}/i.test(u));
  const unique=[...new Set(urls)];
  if(!unique.length){errors.push({playerId:p.id,playerName:p.name,type:'missing_te_profile_id'});continue}
  for(const profileUrl of unique){
    const pid=profileId(profileUrl);
    entries.push({playerId:p.id,playerName:p.name,circuit:'tennis-europe',teProfileId:pid,tournamentName:'Tennis Europe profile monitor',competitionId:pid,startDate:'',endDate:'',sourceUrl:profileUrl,source:'Tennis Europe official profile seed',status:'profile_scanned_for_tournaments',lastSeen:NOW});
    try{
      const html=await get(profileUrl);
      let links=tournamentLinks(html,profileUrl);
      if(!links.length){for(const h of HOSTS){try{links=links.concat(tournamentLinks(await get(`${h}/player-profile/${pid}`),`${h}/player-profile/${pid}`))}catch{}}}
      links=[...new Map(links.map(x=>[x.id,x])).values()];
      for(const link of links){try{const e=await tournamentEntryForPlayer(link,p);if(e&&(e.endDate===''||e.endDate>=FROM))entries.push(e)}catch(e){errors.push({playerId:p.id,profileId:pid,tournamentId:link.id,type:'tournament_fetch_failed',error:e.message})}}
      if(!links.length)errors.push({playerId:p.id,profileId:pid,type:'no_tournament_links_found'});
    }catch(e){errors.push({playerId:p.id,profileId:pid,type:'profile_fetch_failed',error:e.message})}
  }
  for(const c of p.confirmedOfficialTournaments||[]){if(/tournamentsoftware\.com|tenniseurope\.org/i.test(c.url||'')){const id=tourId(c.url)||profileId(c.url)||c.url;entries.push({playerId:p.id,playerName:p.name,circuit:'tennis-europe',competitionId:id,tournamentName:c.name||'Tennis Europe tournament',startDate:c.startDate||'',endDate:c.endDate||'',sourceUrl:c.url,source:'Tennis Europe official tournament seed from players.json',entryStatus:c.entryStatus||'official_seed',lastSeen:NOW})}}
}
const byPlayer={};for(const e of entries.filter(e=>e.entryStatus))byPlayer[e.playerId]=(byPlayer[e.playerId]||0)+1;
const dedup=[...new Map(entries.map(e=>[`${e.playerId}|${e.competitionId}|${e.entryStatus||e.status||''}`,e])).values()];
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'tennis_europe_profile_tournament_scan_complete',source:'Ex novo Tennis Europe engine: scans official TournamentSoftware player profiles, follows official tournament links, confirms entry only when the official tournament page contains the tracked player. No FITP P.U.C., no v1/v2/data.json.',coverageFrom:FROM,profiles:tePlayers.length,entriesFound:dedup.filter(e=>e.entryStatus).length,profileSeeds:dedup.filter(e=>e.status).length,byPlayer,entries:dedup,errors};
await writeJson('dist/v3/source_tennis_europe_entries.json',out);
console.log(JSON.stringify({...out,entries:undefined},null,2));
