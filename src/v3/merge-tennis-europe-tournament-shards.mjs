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
const rollingWindowAdvanced=FROM<=expectedFrom&&UNTIL>=expectedUntil;
const continuityComparable=previousMap.status==='tennis_europe_sharded_tournament_map_complete'&&(previousMap.tournaments||[]).length>=100;
if(continuityComparable&&retentionRate<0.9&&missing.length>10)errors.push({type:'map_continuity_regression',previousComparable:previousComparable.length,retained:retained.length,missing:missing.length,retentionRate});
if(!rollingWindowAdvanced)errors.push({type:'rolling_window_not_current',coverageFrom:FROM,coverageUntil:UNTIL,expectedFrom,expectedUntil});
const continuity={status:errors.some(e=>['map_continuity_regression','rolling_window_not_current'].includes(e.type))?'blocked':'ok',previousGeneratedAt:previousMap.generatedAt||'',previousCount:(previousMap.tournaments||[]).length,previousComparable:previousComparable.length,retained:retained.length,missing:missing.length,retentionRate:Number(retentionRate.toFixed(4)),rollingWindowAdvanced,expectedFrom,expectedUntil,consecutiveSuccessfulCycles:(previousMap.continuity?.consecutiveSuccessfulCycles||0)+1,sampleMissing:missing.slice(0,50).map(t=>({competitionId:t.competitionId,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate}))};
const categoriesByCompetitionId={...previousMap.categoriesByCompetitionId};
for(const t of byId.values())if(t.tournamentCategory)categoriesByCompetitionId[t.competitionId]=t.tournamentCategory;
const verifiedCategoriesByAge = {
  // Robey FOCUS tennis academy open 2026 — tenniseurope.org/calendarevent/89607/, tenniseurope.org/calendarevent/89608/
  'E6C27FE1-A487-440E-9C38-AE8717B4FDE5': [[12, 2], [14, 3]],
  // Development Championships 2026 (week 1) CLOSED EVENT — tenniseurope.org/calendarevent/90865/
  '4120A62D-908D-4D9A-ACEF-EBD0E59B41C2': [[14, 2]],
  // Development Championships 2026 (week 2) CLOSED EVENT — tenniseurope.org/calendarevent/90866/
  '422BCB8C-525F-4CE0-A798-C833EEF6FD8F': [[14, 2]],
  // Hanko Cup — tenniseurope.org/calendarevent/90595/, tenniseurope.org/calendarevent/90596/
  '4F8DB737-D813-473C-BC8D-6C8AA2628B33': [[12, 2], [14, 3]],
  // Amstelpark Tennis Academy Trophy 2026 — tenniseurope.org/calendarevent/90074/, tenniseurope.org/calendarevent/90075/
  'F3FB64C2-0BB4-40B1-B86E-215E9C8CDF4D': [[12, 2], [14, 3]],
  // Koblenz Junior Open — tenniseurope.org/calendarevent/90396/, tenniseurope.org/calendarevent/90397/
  'FB2EB43B-864C-43F6-918A-D23C00FDB65E': [[12, 1], [14, 2]],
  // Austrian Youth Open Kufstein — tenniseurope.org/calendarevent/90841/, tenniseurope.org/calendarevent/90842/
  '72B85BEB-F56D-48F3-AA67-88C1F293C970': [[12, 1], [14, 2]],
  // Kottingbrunn Open 2026 — tenniseurope.org/calendarevent/90862/, tenniseurope.org/calendarevent/90861/
  '36EF59E5-9E3D-4E14-9776-290A130096F2': [[14, 3], [16, 2]],
  // Zahnärzte Ebenbeck Cup — tenniseurope.org/calendarevent/90995/, tenniseurope.org/calendarevent/90996/
  '3E1A18DE-2228-4DF5-8542-BD3611310D83': [[12, 1], [16, 2]],
  // Passau Open — tenniseurope.org/calendarevent/91496/, tenniseurope.org/calendarevent/91495/
  '5FF8792E-6CA1-4624-968B-24DAE81D884C': [[14, 3], [16, 2]],
  // Gran Canaria Yellow Bowl — tenniseurope.org/calendarevent/91351/, tenniseurope.org/calendarevent/91352/
  'C26D5B98-C00A-4F39-A207-237B6810D614': [[12, 1], [14, 2]],
  // Robey FOCUS tennis academy open 2027 — tenniseurope.org/calendarevent/92749/ and /92750/
  '7A2FC9C8-FD64-4C81-A396-8501BA60940D': [[12, 2], [14, 3]],
};
for (const [id, pairs] of Object.entries(verifiedCategoriesByAge)) {
  categoriesByCompetitionId[id] = pairs.map(([age, grade]) => 'U'+age+' · Category '+grade).join(' / ');
}
for (const t of tournaments) {
  const category = categoriesByCompetitionId[t.competitionId];
  if (category) t.tournamentCategory = category;
}
if(!Object.keys(categoriesByCompetitionId).length)errors.push({type:'official_tournament_categories_missing'});
const out={categoriesByCompetitionId,version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'tennis_europe_sharded_tournament_merge_blocked':'tennis_europe_sharded_tournament_map_complete',source:'Merged overlapping Tennis Europe rolling time shards; each cycle is compared with the previous valid map on their common interval. Regressions preserve the last known good map.',coverageMode:'rolling_window_with_permanent_database_and_cross_cycle_continuity',coverageFrom:FROM,coverageUntil:UNTIL,shards,tournamentsFound:tournaments.length,genericTitleCount:generic,incompleteMetadataCount:incomplete,continuity,tournaments,errors};
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded.json',out);
await writeJson('dist/v3/source_tennis_europe_tournaments_sharded_audit.json',{...out,tournaments:tournaments.slice(0,300)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length)process.exit(2);
