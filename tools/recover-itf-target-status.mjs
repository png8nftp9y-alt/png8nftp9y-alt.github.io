import fs from 'node:fs/promises';
import path from 'node:path';
import {tournamentEvents,drawsheet} from '../src/v3/itf-common.mjs';
import {recoverTournament,sectionKey,validateDocument,summarizePair} from './itf-target-status-recovery.mjs';
const target=JSON.parse(await fs.readFile('tools/itf-status-targets.json','utf8'));
const catalog=JSON.parse(await fs.readFile('dist/v3/source_itf_tournaments.json','utf8'));
const saved=new Map();
async function loadSaved(dir){
  let entries;try{entries=await fs.readdir(dir,{withFileTypes:true})}catch(error){if(error.code==='ENOENT')return;throw error}
  for(const entry of entries){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()){await loadSaved(file);continue}
    if(!entry.name.endsWith('.json')||entry.name==='report.json')continue;
    const row=validateDocument(JSON.parse(await fs.readFile(file,'utf8'))),key=sectionKey(row.competitionId,row.event);
    if(saved.has(key)&&JSON.stringify(saved.get(key))!==JSON.stringify(row))throw Error('conflicting_saved_document:'+key);
    saved.set(key,row);
  }
}
await loadSaved('artifacts/previous-itf-status');
const sections=target.sections;
if(new Set(sections.map(s=>sectionKey(s.competitionId,s.event))).size!==sections.length)throw Error('duplicate_target_section');
if(process.argv.includes('--plan')){
  const ids=[...new Set(sections.filter(s=>!saved.has(sectionKey(s.competitionId,s.event))).map(s=>s.competitionId))].sort();
  const matrix={include:ids.length?ids.map(competitionId=>({competitionId})):[{competitionId:'none'}]};
  await fs.appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nremaining=${ids.length}\n`);
  console.log(JSON.stringify({pairs:target.pairs.length,reused:saved.size,remainingSections:sections.filter(s=>!saved.has(sectionKey(s.competitionId,s.event))).length,tournaments:ids.length}));
}else{
  const id=process.env.STATUS_COMPETITION_ID;
  if(!id||!sections.some(s=>s.competitionId===id))throw Error('invalid_target_tournament');
  const tournament=catalog.tournaments.find(t=>t.competitionId===id);
  if(!tournament)throw Error('catalog_missing:'+id);
  const dir=`artifacts/recovered-itf-status/${id}`;await fs.mkdir(dir,{recursive:true});
  const report={competitionId:id,sections:[],pairs:[],failures:[],complete:false};
  const checkpoint=()=>fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
  await checkpoint();
  try{
    const result=await recoverTournament({tournament,events:sections.filter(s=>s.competitionId===id).map(s=>s.event),saved,
      inventory:tournamentEvents,draw:drawsheet,
      browser:async(t,options)=>(await import('../src/v3/read-itf-draws-browser.mjs')).readTournamentDrawsInBrowser(t,{...options,networkFallback:true}),
      onDocument:async row=>{await fs.writeFile(`${dir}/${id}_${row.event}.json`,JSON.stringify(row));report.sections.push({event:row.event,status:'saved'});await checkpoint()}});
    report.failures=result.failures;
    report.sections=result.sections.map(s=>({event:s.event,status:saved.has(sectionKey(id,s.event))?'reused':'saved'}));
    report.pairs=target.pairs.filter(p=>p.competitionId===id).map(p=>summarizePair(p.playerId,result.sections));
    report.complete=!report.failures.length;
  }catch(error){report.failures.push({error:error.message})}
  await checkpoint();console.log(JSON.stringify(report,null,2));
  if(!report.complete)process.exitCode=1;
}
