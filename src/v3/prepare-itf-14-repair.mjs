import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {documentRecord} from './itf-draw-document-d1.mjs';
import {requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
export const targets=[['J-J200-TUR-2026-002','G-S-Q-KO'],['J-J30-ALG-2026-004','G-S-Q-KO'],['J-J30-DOM-2026-001','G-S-Q-KO'],['J-J30-DOM-2026-002','G-S-Q-KO'],['J-J30-INA-2026-004','G-S-Q-KO'],['J-J30-MAD-2026-002','B-S-Q-KO'],['J-J30-POR-2026-004','G-S-Q-KO'],['J-J30-TUR-2026-006','G-S-Q-KO'],['J-J30-VIE-2026-008','G-S-Q-KO'],['J-J60-MEX-2026-011','G-S-Q-KO'],['J-J60-FIJ-2026-005','B-D-M-KO'],['J-J60-FIJ-2026-005','G-D-M-KO'],['J-J60-NZL-2026-002','B-D-M-KO'],['J-J60-NZL-2026-002','G-D-M-KO']];
const key=d=>d.competitionId+'|'+d.event;
const safeEmpty=d=>Array.isArray(d.players)&&Array.isArray(d.matches)&&d.matches.length>0&&!d.players.some(p=>String(p?.name||p?.id||'').trim())&&!d.matches.some(m=>(m.teams||[]).some(t=>(t.players||[]).some(p=>String(p?.name||p?.id||'').trim())))&&((d.status==='complete'&&!d.error)||(d.status==='retry'&&d.error==='draw_not_published_or_incomplete'));
export function classifyTargets(coverage,docs,wanted=targets){
 const valid=new Map(),empty=new Map();
 for(const d of docs){const r=documentRecord(d);if(r?.acquisitionState==='complete'){const old=valid.get(key(d));if(!old||r.observedAt>documentRecord(old).observedAt)valid.set(key(d),d);}else if(safeEmpty(d)){const old=empty.get(key(d));if(!old||String(d.generatedAt||'')>String(old.generatedAt||''))empty.set(key(d),d);}}
 const selected=new Map(),resolved=[],pending=[];
 for(const [id,event]of wanted){const k=id+'|'+event;if(valid.has(k)){selected.set(k,valid.get(k));continue;}
 const row=coverage.tournaments?.find(t=>t.competitionId===id),declared=(row?.events||[]).filter(e=>e.family===event[0]+'-S-M'),required=requiredAuditEvents(declared),d=empty.get(k);
 if(/^[BG]-S-Q-KO$/.test(event)&&d&&required.length&&required.every(e=>valid.has(id+'|'+e.event))){selected.set(k,d);for(const e of required)selected.set(id+'|'+e.event,valid.get(id+'|'+e.event));resolved.push({drawKey:k,resolution:'empty_singles_qualification',mainEvents:required.map(e=>e.event),evidence:'empty source and complete same-sex main artifacts, all declared RR groups required'});}else pending.push({drawKey:k,reason:!d?'no_complete_or_safe_empty_document':!required.length?'main_inventory_missing':'main_document_missing_or_incomplete'});}
 return{selected,resolved,pending};
}
if(process.argv[2]==='prepare'){
 const coverage=JSON.parse(await fs.readFile(process.argv[3],'utf8')),root=process.argv[4],out=process.argv[5],docs=[];
 async function walk(dir){for(const i of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,i.name);if(i.isDirectory())await walk(p);else if(i.name.endsWith('.json.gz'))docs.push(JSON.parse(gunzipSync(await fs.readFile(p))));}}
 await walk(root);const plan=classifyTargets(coverage,docs);for(const d of ['complete','resolved'])await fs.mkdir(path.join(out,d),{recursive:true});
 let n=0;for(const [k,d]of plan.selected){const dir=plan.resolved.some(r=>r.drawKey===k)?'resolved':'complete';await fs.writeFile(path.join(out,dir,String(n++)+'.json.gz'),gzipSync(JSON.stringify(d)));}
 await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-14-repair-scope.json',JSON.stringify({generatedAt:new Date().toISOString(),coverageGeneratedAt:coverage.generatedAt,targets:targets.map(([id,e])=>id+'|'+e),resolved:plan.resolved,pending:plan.pending,selected:[...plan.selected.keys()]},null,2)+'\n');
 if(!plan.selected.size)throw new Error('No target has valid evidence; no import');
}else if(process.argv[2]==='finalize'){
 const scope=JSON.parse(await fs.readFile('dist/v3/audits/itf-14-repair-scope.json','utf8')),file='dist/v3/audits/itf-draw-d1-sync.json',audit=JSON.parse(await fs.readFile(file,'utf8')),resolved=new Set(scope.resolved.map(r=>r.drawKey));
 for(const r of audit.documents)if(resolved.has(r.drawKey)){if(r.acquisitionState!=='archived_unverified')throw new Error('Unexpected resolution state');r.acquisitionState='resolved_empty_qualification';}
 audit.resolvedEmptyQualifications=[...new Set([...(audit.resolvedEmptyQualifications||[]),...resolved])];audit.archivedUnverified=audit.archivedUnverified.filter(k=>!resolved.has(k));audit.pendingTasks=audit.pendingTasks.filter(k=>!resolved.has(k));audit.retryDocuments=audit.pendingTasks.length;audit.qualificationResolutionEvidence=scope.resolved;await fs.writeFile(file,JSON.stringify(audit,null,2)+'\n');
}else if(process.argv[2]==='check'){
 const scope=JSON.parse(await fs.readFile('dist/v3/audits/itf-14-repair-scope.json','utf8')),v=JSON.parse(await fs.readFile('dist/v3/audits/itf-draw-d1-content-verification.json','utf8'));
 if(scope.pending.length||v.missingOrCorrupt.length||v.expectedDocuments!==v.verifiedDocuments||!v.expectedDocuments)throw new Error('14-target repair incomplete: '+JSON.stringify({pending:scope.pending,verification:v.status}));console.log('ITF_14_REPAIR_VERIFIED: all targets stored and reread; empty qualifications do not certify players');
}
