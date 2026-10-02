import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {acquiredDrawStatus,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
import {applyUserQualificationResolutions} from './itf-user-resolved-qualifications.mjs';
const [auditFile,out,...roots]=process.argv.slice(2);
const audit=applyUserQualificationResolutions(JSON.parse(await fs.readFile(auditFile,'utf8')));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const from='2025-12-18',rows=audit.tournaments.filter(t=>t.startDate>=from&&t.startDate<=today),wanted=new Map(),pending=[],resolved=[];
for(const row of rows){
 if(row.classification==='cancelled_no_draws'){resolved.push({competitionId:row.competitionId,resolution:'cancelled_no_draws'});continue;}
 if(row.classification==='unverifiable')pending.push({competitionId:row.competitionId,reason:'inventory_unverified'});
 for(const e of requiredAuditEvents(row.events||[])){
  const key=row.competitionId+'|'+e.event,c=row.checks?.find(c=>c.event===e.event);
  if(c?.acquired===true)wanted.set(key,{competitionId:row.competitionId,event:e.event});
  else pending.push({competitionId:row.competitionId,event:e.event,reason:c?.reasonCode||'acquisition_unverified'});
 }
 for(const e of row.resolvedEvents||[])resolved.push({competitionId:row.competitionId,...e});
}
const documents=new Map(),unreadable=[];
async function walk(root){for(const item of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,item.name);if(item.isDirectory())await walk(file);else if(item.name.endsWith('.json.gz')){try{
 const d=JSON.parse(gunzipSync(await fs.readFile(file))),key=d.competitionId+'|'+d.event;if(!wanted.has(key))continue;
 // A manual policy override without an actual populated artifact is not acquisition evidence.
 const named=p=>Boolean(String(p?.name||p?.id||'').trim());
 const populated=(d.players||[]).some(named)||(d.matches||[]).some(m=>(m.teams||[]).some(t=>(t.players||[]).some(named)));
 if(!populated||!d.matches?.length||!acquiredDrawStatus({competitionId:d.competitionId,event:d.event,artifact:d}).complete)continue;
 const old=documents.get(key);
 if(!old||String(d.generatedAt||'')>String(old.generatedAt||''))documents.set(key,d);
 }catch(error){unreadable.push({file,error:error.message});}}}}
for(const root of roots)await walk(root);
await fs.mkdir(out,{recursive:true});
let index=0;const selected=[];
for(const [key,d] of documents){await fs.writeFile(path.join(out,String(index++)+'.json.gz'),gzipSync(JSON.stringify({...d,status:'complete',taskId:key})));selected.push({key,competitionId:d.competitionId,event:d.event,matches:d.matches.length});}
const missingDocuments=[...wanted].filter(([key])=>!documents.has(key)).map(([key,d])=>({key,...d}));
const starts=rows.map(t=>t.startDate).sort(),scope={from,through:today,auditGeneratedAt:audit.generatedAt,firstTournamentStart:starts[0]||null,tournaments:rows.length,expectedDraws:wanted.size,selectedDraws:selected.length,pending,resolved,missingDocuments,unreadable,selected,
 periodCoverageCertified:false,periodLimitation:'La coorte audit non dimostra la completezza del catalogo ufficiale dal 18/12/2025. La parità D1 verifica soltanto gli artefatti identificati in questa coorte.'};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-d1-exact-scope.json',JSON.stringify(scope,null,2)+'\n');
console.log(JSON.stringify({expectedDraws:wanted.size,selectedDraws:selected.length,missingDocuments:missingDocuments.length,pending:pending.length,firstTournamentStart:scope.firstTournamentStart}));
if(!selected.length)throw new Error('No acquired draw artifacts selected');
