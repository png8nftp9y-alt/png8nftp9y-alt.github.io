// D1_READ_ONLY: one-shot GET snapshot replay + indexed SELECT evidence; no dispatch, polling or D1 writes.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectObservedEuropeHistory} from './lib/observed-europe-history-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),phase=process.argv[2];
if(!['before','after'].includes(phase))throw Error('audit_phase_required');
const directory=path.join(root,'cloudflare/app-api/tmp');await fs.mkdir(directory,{recursive:true});
const file=path.join(directory,'observed-europe-history-'+phase+'.json');
try {
 const snapshots={};
 for(const group of ['main','others']) {
  const snapshot=path.join(directory,'europe-audit-snapshot-'+group+'.json');
  try {
   const run=spawnSync(process.execPath,['tools/replay-others-real-snapshot.mjs'],{cwd:root,env:{...process.env,COURTWATCH_AUDIT_EUROPE:'1',COURTWATCH_REPLAY_GROUP:group,COURTWATCH_OTHERS_SNAPSHOT_PATH:snapshot},encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
   const summary=run.stdout?.split('\n').find(x=>x.startsWith('OTHERS_READ_ONLY_RESULT='));if(summary)console.log(group+': '+summary);
   if(run.status!==0)throw Error('live_snapshot_read_failed:'+group);
   snapshots[group]=JSON.parse(await fs.readFile(snapshot));
  } finally {await fs.rm(snapshot,{force:true});}
 }
 const registry=JSON.parse(await fs.readFile(path.join(root,'history/tennis-europe-confirmed-presences.json')));
 let before=null;if(phase==='after')before=JSON.parse(await fs.readFile(path.join(directory,'observed-europe-history-before.json')));
 const evidence=[...(registry.entries||[]),...(before?.referenceEvidence||[])];
 for(const data of Object.values(snapshots))evidence.push(...data.europeDrawEvidence,...data.tournaments.filter(t=>t.circuit==='tennis-europe'&&(t.drawConfirmed===true||/draw_confirmed|official_draw/.test(t.entryStatus||''))));
 const source=await fs.readFile(path.join(root,phase==='before'?'tools/fixtures/europe-profile-eligibility-before-permanent.js':'v3.js'),'utf8');
 const result={phase,checkedAt:new Date().toISOString(),...inspectObservedEuropeHistory(snapshots,evidence,source)};
 const key=e=>[e.group,e.playerId,String(e.competitionId).toUpperCase()].join('|'),remaining=new Set(result.missing.map(key));
 result.recoveredCases=(before?.missing||[]).filter(e=>!remaining.has(key(e)));
 result.referenceEvidence=evidence;
 result.historicalConfirmationDowngrades=JSON.parse(await fs.readFile(path.join(root,'history/tennis-europe-confirmation-transition-audit.json')));
 await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
 const {referenceEvidence,...summary}=result;console.log('OBSERVED_EUROPE_HISTORY='+JSON.stringify(summary));
 // The summary is also directly reviewable in Actions, without opening an artifact.
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
  `\n### Tennis Europe — ${phase}\n\nStato: **${result.status}**. Presenze mancanti: **${result.missingCount}**. Conferme perse: **${result.lostConfirmationCount}**. Identità non verificabili: **${result.unverified.length}**.\n\n`+
  result.groups.map(g=>`${g.group==='main'?'TCL':'Altri'}: ${g.visibleCurrentPresences}/${g.expectedConfirmedPresences} presenze confermate visibili.`).join('\n\n')+'\n\n'+
  [...result.missing,...result.lostConfirmations].map(e=>`- ${String(e.name).replace(/[\r\n]/g,' ')} — ${String(e.tournament).replace(/[\r\n]/g,' ')} (${e.group})`).join('\n')+'\n');
 if(phase==='after'&&result.status!=='complete')process.exitCode=1;
} catch(error) {
 const result={phase,status:'not_verified',error:error.message};await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
 console.log('OBSERVED_EUROPE_HISTORY='+JSON.stringify(result));if(phase==='after')process.exitCode=1;
}
