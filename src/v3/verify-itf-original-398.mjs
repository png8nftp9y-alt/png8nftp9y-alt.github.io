import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
const root=process.argv[2]; if(!root)throw Error('archive_directory_required');
const cohort=JSON.parse(await fs.readFile('src/v3/itf-original-398-cohort.json','utf8'));
if(cohort.tournaments.length!==398)throw Error('cohort_must_contain_398');
const wanted=new Set(cohort.tournaments.map(t=>t.competitionId)),docs=new Map(),unreadable=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.json.gz')){try{const d=JSON.parse(gunzipSync(await fs.readFile(p)));if(wanted.has(d.competitionId)){const k=d.competitionId+'|'+d.event;const arr=docs.get(k)||[];arr.push({doc:d,file:path.relative(root,p)});docs.set(k,arr)}}catch(err){unreadable.push({file:path.relative(root,p),error:err.message})}}}}
await walk(root);
const named=p=>Boolean(String(p?.name||p?.id||'').trim());
function inspect(candidates){
 if(!candidates?.length)return {status:'missing_document',issues:['missing_document'],fullCompletenessCertified:false};
 candidates.sort((a,b)=>(Date.parse(b.doc.generatedAt)||0)-(Date.parse(a.doc.generatedAt)||0)||a.file.localeCompare(b.file));
 const {doc:d,file}=candidates[0],issues=[],matches=Array.isArray(d.matches)?d.matches:[],players=Array.isArray(d.players)?d.players:[];
 if(d.status!=='complete'&&!/^draw_rows_incomplete:/.test(String(d.error||'')))issues.push('document_not_complete');
 if(d.error&&!/^draw_rows_incomplete:/.test(d.error))issues.push('document_error');
 if(!matches.length)issues.push('no_matches');
 if(!players.some(named)&&!matches.some(m=>(m.teams||[]).some(t=>(t.players||[]).some(named))))issues.push('no_players');
 const ids=matches.map(m=>m.matchId).filter(Boolean);if(new Set(ids).size!==ids.length)issues.push('duplicate_match_ids');
 if(matches.some(m=>!Array.isArray(m.teams)||m.teams.length>2))issues.push('invalid_match_teams');
 if(String(d.event).endsWith('-RR')){const r=d.roundRobin;if(!(r?.declaredGroups>0&&r.completeGroups===r.declaredGroups&&Array.isArray(r.missingGroups)&&!r.missingGroups.length))issues.push('rr_groups_not_certified');}
 return {status:issues.length?'anomaly':'structurally_valid_unconfirmed',issues,players:players.length,matches:matches.length,generatedAt:d.generatedAt||null,sourceFile:file,documentVariants:candidates.length,fullCompletenessCertified:false};
}
const tournaments=cohort.tournaments.map(t=>{const draws=t.events.map(event=>({event,...inspect(docs.get(t.competitionId+'|'+event))}));return {...t,events:undefined,draws,status:draws.some(d=>d.issues.length)?'anomaly':'structurally_valid_unconfirmed',fullCompletenessCertified:false}});
const draws=tournaments.flatMap(t=>t.draws),summary={tournaments:tournaments.length,draws:draws.length,tournamentsWithAnomalies:tournaments.filter(t=>t.status==='anomaly').length,drawsWithAnomalies:draws.filter(d=>d.issues.length).length,missingDocuments:draws.filter(d=>d.status==='missing_document').length,structurallyValidDraws:draws.filter(d=>d.status==='structurally_valid_unconfirmed').length,fullyCertifiedTournaments:0,unreadableFiles:unreadable.length};
const report={version:1,generatedAt:new Date().toISOString(),baselineRunId:cohort.baselineRunId,summary,limitation:'Structural archive verification only. No original official response or expected player/match totals are stored; full completeness requires an independent official comparison. No BYE/row parity, no linked singles main KO in RR, no changes to engine queues.',unreadable,tournaments};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-original-398-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
