import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const TODAY=NOW.slice(0,10);
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}} async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function goodTitle(v){const x=String(v||'').trim();return x&&!/^(tennis europe|tournamentsoftware|tournament|events|acceptance list)$/i.test(x)}
const dir='dist/v3/shards/tennis-europe';let files=[];try{files=(await fs.readdir(dir)).filter(f=>/^tournaments-.+\.json$/.test(f))}catch{}
const previousMap=await readJson('dist/v3/source_tennis_europe_tournaments_sharded.json',{tournaments:[]});
const byId=new Map(), shards=[], errors=[]; let FROM='', UNTIL='';
for(const f of files){const d=await readJson(`${dir}/${f}`,{});shards.push({file:f,shard:d.shard,status:d.status,tournamentsFound:(d.tournaments||[]).length,errors:(d.errors||[]).length});for(const t of d.tournaments||[]){if(!t.competitionId)continue;const cur=byId.get(t.competitionId)||{};const name=goodTitle(t.tournamentName)?t.tournamentName:(goodTitle(cur.tournamentName)?cur.tournamentName:t.searchTournamentName||cur.searchTournamentName||t.tournamentName);byId.set(t.competitionId,{...cur,...t,tournamentName:name,searchTournamentName:t.searchTournamentName||cur.searchTournamentName,location:t.location||cur.location,startDate:t.startDate||cur.startDate,endDate:t.endDate||cur.endDate,discoveryModes:[...new Set([...(cur.discoveryModes||[]),...(t.discoveryModes||[])])]});}}
for(const f of files){const d=await readJson(`${dir}/${f}`,{});if(!FROM)FROM=d.coverageFrom||'';if(!UNTIL)UNTIL=d.coverageUntil||'';if(d.coverageFrom!==FROM||d.coverageUntil!==UNTIL)errors.push({type:'inconsistent_rolling_coverage',file:f,coverageFrom:d.coverageFrom,coverageUntil:d.coverageUntil,expectedFrom:FROM,expectedUntil:UNTIL});}
const tournaments=[...byId.values()].filter(t=>t.startDate&&(!t.endDate||t.endDate>=FROM)).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.tournamentName).localeCompare(String(b.tournamentName)));
const generic=tournaments.filter(t=>!goodTitle(t.tournamentName)).length;
if(files.length!==4)errors.push({type:'missing_tournament_shards',expected:4,files:files.length});
for(const s of shards)if(s.status!=='te_tournament_shard_complete'||s.errors)errors.push({type:'invalid_tournament_shard',...s});
if(tournaments.length<100)errors.push({type:'too_few_tournaments',count:tournaments.length,minimum:100});
const incomplete=tournaments.filter(t=>!goodTitle(t.tournamentName)||!t.startDate||!t.endDate||!t.location).length;
if(incomplete)errors.push({type:'incomplete_tournament_metadata',count:incomplete});
if(generic>Math.max(10,Math.round(tournaments.length*.05)))errors.push({type:'too_many_generic_titles',generic,total:tournaments.length});
const previousComparable=(previousMap.tournaments||[]).filter(t=>t.competitionId&&(!t.endDate||t.endDate>=FROM)&&(!t.startDate||t.startDate<=UNTIL));
const currentIds=new Set(tournaments.map(t=>t.competitionId));
const retained=previousComparable.filter(t=>currentIds.has(t.competitionId));
const missing=previousComparable.filter(t=>!currentIds.has(t.competitionId));
const retentionRate=previousComparable.length?retained.length/previousComparable.length:1;
const expectedFrom=new Date(Date.parse(TODAY+'T00:00:00Z')-240*864e5).toISOString().slice(0,10);
const expectedUntil=new Date(Date.parse(TODAY+'T00:00:00Z')+730*864e5).toISOString().slice(0,10);
const rollingWindowAdvanced=FROM===expectedFrom&&UNTIL===expectedUntil;
const continuityComparable=previousMap.status==='tennis_europe_sharded_tournament_map_complete'&&(previousMap.tournaments||[]).length>=100;
if(continuityComparable&&retentionRate<0.9&&missing.length>10)errors.push({type:'map_continuity_regression',previousComparable:previousComparable.length,retained:retained.length,missing:missing.length,retentionRate});
if(!rollingWindowAdvanced)errors.push({type:'rolling_window_not_current',coverageFrom:FROM,coverageUntil:UNTIL,expectedFrom,expectedUntil});
const continuity={status:errors.some(e=>['map_continuity_regression','rolling_window_not_current'].includes(e.type))?'blocked':'ok',previousGeneratedAt:previousMap.generatedAt||'',previousCount:(previousMap.tournaments||[]).length,previousComparable:previousComparable.length,retained:retained.length,missing:missing.length,retentionRate:Number(retentionRate.toFixed(4)),rollingWindowAdvanced,expectedFrom,expectedUntil,consecutiveSuccessfulCycles:(previousMap.continuity?.consecutiveSuccessfulCycles||0)+1,sampleMissing:missing.slice(0,50).map(t=>({competitionId:t.competitionId,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate}))};
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'tennis_europe_sharded_tournament_merge_blocked':'tennis_europe_sharded_tournament_map_complete',source:'Merged overlapping Tennis Europe rolling time shards; each cycle is compared with the previous valid map on their common interval. Regressions preserve the last known good map.',coverageMode:'rolling_window_with_permanent_database_and_cross_cycle_continuity',coverageFrom:FROM,coverageUntil:UNTIL,shards,tournamentsFound:tournaments.length,genericTitleCount:generic,incompleteMetadataCount:incomplete,continuity,tournaments,errors};
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded.json',out);
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded_audit.json',{...out,tournaments:tournaments.slice(0,300)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length)process.exit(2);
