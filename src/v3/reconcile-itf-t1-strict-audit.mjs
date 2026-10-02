import {withCurrentCoverageCatalog} from './itf-incremental-coverage.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {reconcileCoverageAudit} from './reconcile-itf-coverage-audit.mjs';
import {isCoverageAudit} from './itf-t1-acquisition-state.mjs';
import {strictDrawStatus} from './itf-strict-draw-status.mjs';

async function files(root){
 const out=[];
 async function walk(dir){
  let entries=[];
  try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{return}
  for(const entry of entries){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.json.gz'))out.push(full)}
 }
 await walk(root);
 return out;
}

export function reconcileStrictAudit(audit,documents,{now=new Date().toISOString()}={}){
 const acquired=new Map();
 for(const document of documents){
  const id=String(document?.competitionId||'').toUpperCase(),event=String(document?.event||'').toUpperCase();
  if(!id||!event||document.status!=='complete')continue;
  const status=strictDrawStatus({competitionId:id,event,structure:document.roundRobin?'RR':document.matches?.[0]?.structure,artifact:document});
  if(status.complete)acquired.set(`${id}|${event}`,{...status,document});
 }
 let newlyAcquired=0;
 const tournaments=(audit.tournaments||[]).map(tournament=>{
  if(!Array.isArray(tournament.checks)||!tournament.checks.length)return tournament;
  const id=String(tournament.competitionId||'').toUpperCase();
  const checks=tournament.checks.map(check=>{
   if(check.acquired)return check;
   const result=acquired.get(`${id}|${String(check.event||'').toUpperCase()}`);
   if(!result)return check;
   newlyAcquired++;
   return {...check,acquired:true,reasonCode:result.reasonCode,detail:result.detail,rowParity:result.rowParity||check.rowParity||null,sources:[...new Set([...(check.sources||[]),'t1_acquisition'])]};
  });
  const missingEvents=checks.filter(check=>!check.acquired),classification=missingEvents.length?'missing_draws':'complete';
  return {...tournament,declaredDraws:checks.length,acquiredDraws:checks.length-missingEvents.length,missingDraws:missingEvents.length,missingEvents,checks,classification,reconciledAt:now};
 });
 const unverifiable=tournaments.filter(row=>row.classification==='unverifiable'),today=now.slice(0,10),windowEnd=new Date(Date.parse(today+'T00:00:00Z')+3*864e5).toISOString().slice(0,10),allMissing=tournaments.flatMap(row=>row.missingEvents||[]);
 const missingByReason=Object.fromEntries([...Map.groupBy(allMissing,row=>row.reasonCode)].map(([key,rows])=>[key,rows.length]));
 const summary={...(audit.summary||{}),complete:tournaments.filter(row=>row.classification==='complete').length,cancelledNoDraws:tournaments.filter(row=>row.classification==='cancelled_no_draws').length,missingDrawsTournaments:tournaments.filter(row=>row.classification==='missing_draws').length,unverifiable:unverifiable.length,incapsulaUnverifiable:unverifiable.filter(row=>/incapsula/i.test(String(row.error||''))).length,concludedUnverifiable:unverifiable.filter(row=>String(row.endDate||'')<today).length,activeD3Unverifiable:unverifiable.filter(row=>String(row.endDate||'')>=today&&String(row.startDate||'')<=windowEnd).length,futureUnverifiable:unverifiable.filter(row=>String(row.startDate||'')>windowEnd).length,declaredDraws:tournaments.reduce((sum,row)=>sum+Number(row.declaredDraws||0),0),acquiredDraws:tournaments.reduce((sum,row)=>sum+Number(row.acquiredDraws||0),0),missingDraws:tournaments.reduce((sum,row)=>sum+Number(row.missingDraws||0),0),missingByReason};
 summary.actionableUnverifiable=summary.concludedUnverifiable+summary.activeD3Unverifiable;
 return{audit:{...audit,reconciledAt:now,summary,tournaments},newlyAcquired};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const input=process.argv[2]||process.env.ITF_AUDIT_STATE_FILE,root=process.argv[3]||process.env.ITF_T1_TASK_ROOT||'draw-tasks',output=process.argv[4]||input;
 if(!input||!output)throw new Error('Usage: reconcile-itf-t1-strict-audit.mjs AUDIT_FILE [TASK_ROOT] [OUTPUT_FILE]');
 const audit=await withCurrentCoverageCatalog(JSON.parse(await fs.readFile(input,'utf8'))),documents=[];
 for(const file of await files(root))try{documents.push(JSON.parse(gunzipSync(await fs.readFile(file))))}catch(error){throw new Error(`Unreadable T-1 document ${file}: ${error.message}`)}
 const inventories=[];
 const inventoryRoot=process.argv[5]||'dist/v3/shards/itf/t1-inventory';
 for(const item of await fs.readdir(inventoryRoot,{withFileTypes:true}).catch(()=>[]))if(item.isFile()&&item.name.endsWith('.json'))inventories.push(JSON.parse(await fs.readFile(path.join(inventoryRoot,item.name),'utf8')));
 const baseline=isCoverageAudit(audit)?JSON.parse(await fs.readFile('src/v3/itf-audit-baseline-20261001.json','utf8')):null;
 const result=isCoverageAudit(audit)?reconcileCoverageAudit(audit,documents,{inventories,baseline}):reconcileStrictAudit(audit,documents);
 await fs.writeFile(output,JSON.stringify(result.audit,null,2)+'\n');
 console.log(`ITF_T1_STRICT_AUDIT_RECONCILED=${JSON.stringify({documents:documents.length,newlyAcquired:result.newlyAcquired,acquiredDraws:result.audit.summary?.acquiredDraws,missingDraws:result.audit.summary?.missingDraws})}`);
}
