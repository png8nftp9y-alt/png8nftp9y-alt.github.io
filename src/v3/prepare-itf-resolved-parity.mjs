import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {AUDIT_CRITERION,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
import {applyUserQualificationResolutions} from './itf-user-resolved-qualifications.mjs';
import {documentRecord} from './itf-draw-document-d1.mjs';

export function resolvedScope(input,expected=863){
 const audit=applyUserQualificationResolutions(input);
 if(audit.criterion!==AUDIT_CRITERION||!Array.isArray(audit.tournaments))throw new Error('Invalid coverage evidence');
 const complete=audit.tournaments.filter(t=>t.classification==='complete'),cancelled=audit.tournaments.filter(t=>t.classification==='cancelled_no_draws');
 const ids=[...complete,...cancelled].map(t=>t.competitionId);
 if(new Set(ids).size!==ids.length||ids.some(id=>!id))throw new Error('Duplicate or missing tournament identity');
 if(ids.length!==expected)throw new Error(`Scope changed: expected ${expected}, found ${ids.length}. Review the current scope before running.`);
 const wanted=[];
 for(const t of complete){
  const events=requiredAuditEvents(t.events||[]);
  if(!events.length)throw new Error('Complete tournament without inventory: '+t.competitionId);
  for(const e of events){
   if(!e.event||!t.checks?.some(c=>c.event===e.event&&c.acquired===true))throw new Error('Missing acquisition evidence: '+t.competitionId+'|'+e.event);
   wanted.push({competitionId:t.competitionId,event:e.event,drawKey:t.competitionId+'|'+e.event});
  }
 }
 if(new Set(wanted.map(x=>x.drawKey)).size!==wanted.length)throw new Error('Duplicate required draw');
 return {version:1,generatedAt:new Date().toISOString(),coverageGeneratedAt:audit.reconciledAt||audit.generatedAt,expectedResolved:expected,completeTournaments:complete.length,cancelledNoDraws:cancelled.length,tournaments:[...complete,...cancelled].map(t=>({competitionId:t.competitionId,classification:t.classification,resolvedEvents:t.resolvedEvents||[]})),wanted,excluded:audit.tournaments.filter(t=>!ids.includes(t.competitionId)).map(t=>({competitionId:t.competitionId,classification:t.classification,missingEvents:t.missingEvents||[]})),fullPeriodCertified:false};
}

export async function selectDocuments(scope,roots){
 const wanted=new Set(scope.wanted.map(x=>x.drawKey)),selected=new Map();
 async function walk(root){for(const item of await fs.readdir(root,{withFileTypes:true})){
  const file=path.join(root,item.name);if(item.isDirectory()){await walk(file);continue;}if(!item.name.endsWith('.json.gz'))continue;
  const doc=JSON.parse(gunzipSync(await fs.readFile(file))),key=String(doc.competitionId||'').toUpperCase()+'|'+doc.event;
  if(!wanted.has(key))continue;
  const record=documentRecord(doc);if(record?.acquisitionState!=='complete'){
   if(root.includes('itf-parity-live'))throw new Error('Live manifest declares a complete document without full acquisition proof: '+key);
   continue;
  }
  const old=selected.get(key);
  if(!old||record.observedAt>old.observedAt||(record.observedAt===old.observedAt&&record.sha256>old.sha256))selected.set(key,record);
 }}
 for(const root of roots)await walk(root);
 const missing=scope.wanted.filter(x=>!selected.has(x.drawKey));
 return {documents:[...selected.values()].map(({chunks,...record})=>record),missing};
}

async function main(){
 const [mode,...args]=process.argv.slice(2);await fs.mkdir('dist/v3/audits',{recursive:true});
 const file='dist/v3/audits/itf-resolved-parity-scope.json';
 if(mode==='scope'){
  const scope=resolvedScope(JSON.parse(await fs.readFile(args[0],'utf8')),Number(args[1]||863));
  await fs.writeFile(file,JSON.stringify(scope,null,2)+'\n');console.log(JSON.stringify({resolved:scope.expectedResolved,complete:scope.completeTournaments,cancelled:scope.cancelledNoDraws,expectedDraws:scope.wanted.length}));
 }else if(mode==='select'){
  const scope=JSON.parse(await fs.readFile(file,'utf8')),selection=await selectDocuments(scope,args);
  await fs.writeFile(file,JSON.stringify({...scope,missingR2:selection.missing},null,2)+'\n');
  await fs.writeFile('dist/v3/audits/itf-draw-d1-sync.json',JSON.stringify({scope:'863 resolved tournaments; exact source documents; pending tournaments excluded',documents:selection.documents},null,2)+'\n');
  if(selection.missing.length)throw new Error('Missing complete R2 documents: '+JSON.stringify(selection.missing));
 }else if(mode==='finalize'){
  const scope=JSON.parse(await fs.readFile(file,'utf8')),content=JSON.parse(await fs.readFile('dist/v3/audits/itf-draw-d1-content-verification.json','utf8'));
  const parity=Array.isArray(scope.missingR2)&&scope.missingR2.length===0&&content.expectedDocuments===scope.wanted.length&&content.verifiedDocuments===scope.wanted.length&&Array.isArray(content.missingOrCorrupt)&&content.missingOrCorrupt.length===0&&content.status==='verified_acquired_documents';
  const report={...scope,readOnlyD1:true,readOnlyR2:true,databaseParity:parity?'verified':'failed',expectedDocuments:content.expectedDocuments,verifiedDocuments:content.verifiedDocuments,missingOrCorrupt:content.missingOrCorrupt,limitation:'Parità dei tabelloni richiesti per i tornei risolti della copertura acquisita. Cancellazioni verificate nella copertura, non tabelloni D1. Nessuna certificazione di catalogo ufficiale esaustivo o di tornei ancora pendenti.'};
  await fs.writeFile('dist/v3/audits/itf-resolved-parity.json',JSON.stringify(report,null,2)+'\n');
  const summary=JSON.stringify({databaseParity:report.databaseParity,resolved:scope.expectedResolved,complete:scope.completeTournaments,cancelled:scope.cancelledNoDraws,expectedDocuments:content.expectedDocuments,verifiedDocuments:content.verifiedDocuments});console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n\n'+report.limitation+'\n');
  if(!parity)throw new Error('Resolved tournament parity failed');
 }else throw new Error('Use scope, select or finalize');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
