import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const players=(await readJson('players.json',{players:[]})).players||[];
const tePlayers=players.filter(p=>(p.circuits||[]).some(c=>/tennis europe/i.test(String(c))));
const entries=[],errors=[];
function profileId(url){return (String(url).match(/player-profile\/([0-9A-F-]{36})/i)||[])[1]||''}
for(const p of tePlayers){const urls=[p.profileSync?.tennisEurope?.url,...(p.officialUrls?.tennisEurope||[])].filter(Boolean).filter(u=>/tournamentsoftware\.com|tenniseurope\.org/i.test(u));for(const u of [...new Set(urls)]){entries.push({playerId:p.id,playerName:p.name,circuit:'tennis-europe',teProfileId:profileId(u),tournamentName:'Tennis Europe profile monitor',competitionId:profileId(u)||p.id,startDate:'',endDate:'',sourceUrl:u,source:'ex novo Tennis Europe official profile seed',status:'profile_seed_needs_tournament_scan',lastSeen:NOW})}for(const c of p.confirmedOfficialTournaments||[]){if(/tournamentsoftware\.com|tenniseurope\.org/i.test(c.url||''))entries.push({playerId:p.id,playerName:p.name,circuit:'tennis-europe',teProfileId:profileId(c.url),tournamentName:c.name||'Tennis Europe tournament',competitionId:profileId(c.url)||c.url,startDate:c.startDate||'',endDate:c.endDate||'',sourceUrl:c.url,source:'ex novo Tennis Europe official tournament seed',status:c.entryStatus||'official_seed',lastSeen:NOW})}}
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'seeded_pending_live_tournamentsoftware_scan',source:'ex novo Tennis Europe discovery; no v1/v2/data.json; official profile/tournament seeds only until live scanner is expanded',coverageFrom:FROM,profiles:tePlayers.length,entriesFound:entries.length,entries,errors};
await writeJson('dist/v3/source_tennis_europe_entries.json',out);
console.log(JSON.stringify({...out,entries:undefined},null,2));
