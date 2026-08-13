import fs from 'node:fs/promises';
const NOW=new Date().toISOString(), FROM='2025-12-18';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}} async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function goodTitle(v){const x=String(v||'').trim();return x&&!/^(tennis europe|tournamentsoftware|tournament|events|acceptance list)$/i.test(x)}
const dir='dist/v3/shards/tennis-europe';let files=[];try{files=(await fs.readdir(dir)).filter(f=>/^tournaments-.+\.json$/.test(f))}catch{}
const byId=new Map(), shards=[], errors=[];
for(const f of files){const d=await readJson(`${dir}/${f}`,{});shards.push({file:f,shard:d.shard,status:d.status,tournamentsFound:(d.tournaments||[]).length,errors:(d.errors||[]).length});for(const t of d.tournaments||[]){if(!t.competitionId)continue;const cur=byId.get(t.competitionId)||{};const name=goodTitle(t.tournamentName)?t.tournamentName:(goodTitle(cur.tournamentName)?cur.tournamentName:t.searchTournamentName||cur.searchTournamentName||t.tournamentName);byId.set(t.competitionId,{...cur,...t,tournamentName:name,searchTournamentName:t.searchTournamentName||cur.searchTournamentName,location:t.location||cur.location,startDate:t.startDate||cur.startDate,endDate:t.endDate||cur.endDate,discoveryModes:[...new Set([...(cur.discoveryModes||[]),...(t.discoveryModes||[])])]});}}
const tournaments=[...byId.values()].filter(t=>t.startDate&&(!t.endDate||t.endDate>=FROM)).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.tournamentName).localeCompare(String(b.tournamentName)));
const generic=tournaments.filter(t=>!goodTitle(t.tournamentName)).length;
if(tournaments.length<100)errors.push({type:'too_few_tournaments',count:tournaments.length});
if(generic>Math.max(10,Math.round(tournaments.length*.05)))errors.push({type:'too_many_generic_titles',generic,total:tournaments.length});
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'tennis_europe_sharded_tournament_merge_blocked':'tennis_europe_sharded_tournament_map_complete',source:'Merged Tennis Europe country shards; preserves search-derived specific tournament title when official detail title is generic.',coverageFrom:FROM,shards,tournamentsFound:tournaments.length,genericTitleCount:generic,tournaments,errors};
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded.json',out);
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded_audit.json',{...out,tournaments:tournaments.slice(0,300)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length)process.exit(2);
