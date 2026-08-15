import fs from 'node:fs/promises';
const NOW=new Date().toISOString(), FROM='2025-12-18';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}} async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
function goodTitle(v){const x=String(v||'').trim();return x&&!/^(tennis europe|tournamentsoftware|tournament|events|acceptance list)$/i.test(x)}
const dir='dist/v3/shards/tennis-europe';let files=[];try{files=(await fs.readdir(dir)).filter(f=>/^acceptance-\d+\.json$/.test(f))}catch{}
const entries=[],shards=[],errors=[];for(const f of files){const d=await readJson(`${dir}/${f}`,{});shards.push({file:f,shard:d.shard,status:d.status,tournamentsChecked:d.tournamentsChecked,entriesFound:(d.entries||[]).length,errors:(d.errors||[]).length});entries.push(...(d.entries||[]));}
const dedup=[...new Map(entries.filter(e=>e.startDate&&(!e.endDate||e.endDate>=FROM)).map(e=>[`${e.playerId}|${e.competitionId}|${e.acceptanceEvent}|${e.acceptanceList}|${e.acceptancePosition||''}`,e])).values()];
const byPlayer={},byAcceptance={};for(const e of dedup){byPlayer[e.playerId]=(byPlayer[e.playerId]||0)+1;byAcceptance[e.calendarListLabel||e.entryStatus]=(byAcceptance[e.calendarListLabel||e.entryStatus]||0)+1}
const generic=dedup.filter(e=>!goodTitle(e.tournamentName)).length;
if(files.length!==16)errors.push({type:'missing_acceptance_shards',expected:16,files:files.length});
for(const s of shards)if(s.status!=='te_acceptance_shard_complete'||s.errors)errors.push({type:'invalid_acceptance_shard',...s});
if(dedup.length===0)errors.push({type:'zero_te_entries'});
if(generic>Math.max(3,Math.round(dedup.length*.1)))errors.push({type:'too_many_generic_entry_titles',generic,total:dedup.length});
for(const e of dedup){if(/\b\(OA\)/.test(e.acceptanceRow||'')&&/-(1)$/.test(e.calendarListLabel||'')&&!/^1\s/.test(e.acceptanceRow||''))errors.push({type:'oa_label_regression',player:e.playerName,row:e.acceptanceRow,label:e.calendarListLabel});}
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'tennis_europe_sharded_acceptance_blocked':'tennis_europe_acceptance_complete',source:'Merged sharded acceptance output with guards for titles, counts and row-leading OA label parsing.',coverageFrom:FROM,shards,tournamentsChecked:shards.reduce((a,s)=>a+(s.tournamentsChecked||0),0),entriesFound:dedup.length,byPlayer,byAcceptance,entries:dedup.sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||a.playerName.localeCompare(b.playerName)),errors};
await writeJson('dist/v3/source_tennis_europe_entries_sharded.json',out);
await writeJson('dist/v3/source_tennis_europe_acceptance_sharded_audit.json',{...out,entries:out.entries.slice(0,300)});
console.log(JSON.stringify({...out,entries:out.entries.slice(0,30)},null,2));
if(errors.length)process.exit(2);
