import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {readJson,writeJson,TODAY} from './itf-common.mjs';
import {recoverMetadata,storedMetadata,enrichTournamentMetadata} from './recover-all-itf-metadata.mjs';
import {browserFactsheet} from './itf-metadata-browser.mjs';
import {reconcileMetadataQueue,selectMetadataBatch,applyMetadataBatch,metadataQueueStatus} from './itf-metadata-queue.mjs';
const statePath='history/itf_metadata_queue.json',statusPath='dist/v3/itf_metadata_queue_status.json',requestedMode=process.env.ITF_META_MODE||'extraordinary',now=()=>new Date().toISOString();
const catalogue=await readJson('dist/v3/source_itf_tournaments.json');
const official=await readJson('history/itf_official_metadata.json',{tournaments:{}});
const saved=storedMetadata(catalogue);for(const [id,row]of Object.entries(storedMetadata(official)))saved[id]={...saved[id],...row};
const original=await readJson(statePath,null);
let state=reconcileMetadataQueue(original,catalogue,saved,TODAY,now());
const mode=requestedMode;
async function persist(){await writeJson(statePath,state);await writeJson(statusPath,metadataQueueStatus(state));}
if(process.argv.includes('--discovery')){
 state=reconcileMetadataQueue(original,catalogue,saved,TODAY,now(),await readJson('/tmp/itf-map-previous.json',catalogue));await persist();
 await fs.appendFile(process.env.GITHUB_OUTPUT,`new_count=${state.newIds.length}\n`);
 await fs.appendFile('docs/CourtWatch_v3_handoff_report.md',`\nITF discovery ${now()}: ${state.newIds.length} newly discovered future tournaments; Meta ordinary only for new IDs; incomplete queue preserved.\n`);
}else if(process.argv.includes('--select')){
 const targets=selectMetadataBatch(state,mode);await writeJson('/tmp/itf-meta-targets.json',targets);
 await fs.appendFile(process.env.GITHUB_OUTPUT,`count=${targets.length}\nordinary_count=${metadataQueueStatus(state).ordinary.total}\nextraordinary_count=${selectMetadataBatch(state,'extraordinary',Infinity).length}\ncleanup=${JSON.stringify(Object.values(original?.tournaments||{}).map(t=>[t.competitionId,t.status,t.nextCheckAt,t.retryCadence,t.alert,t.alertAt]))!==JSON.stringify(Object.values(state.tournaments||{}).map(t=>[t.competitionId,t.status,t.nextCheckAt,t.retryCadence,t.alert,t.alertAt]))}\n`);
}else if(process.argv.includes('--acquire')){
 const targets=await readJson('/tmp/itf-meta-targets.json',[]),attempts=[];
 const require=createRequire(new URL('../../infra/itf-acquirer/package.json',import.meta.url)),{chromium}=require('playwright');
 const context=await chromium.launchPersistentContext('',{headless:true,locale:'en-GB',timezoneId:'Europe/Rome'});
 try{await recoverMetadata(targets,saved,async t=>{const checkedAt=now();try{const result=await browserFactsheet(context,t);attempts.push({competitionId:t.competitionId,checkedAt,reason:result._factsheetStatus==='not_public'?'factsheet_not_public':''});return result;}catch(e){attempts.push({competitionId:t.competitionId,checkedAt,reason:/security_challenge|incapsula/i.test(e.message)?'incapsula_blocked':'technical_error',error:e.message});throw e;}},{maxElapsedMs:12*60*1000,onCheckpoint:result=>writeJson('/tmp/itf-meta-result.json',{...result,attempts,mode})});}finally{await context.close();}
}else if(process.argv.includes('--publish')){
 const result=await readJson('/tmp/itf-meta-result.json',null);if(!result)throw Error('Metadata result missing');
 // Only attempted IDs may be merged; concurrent discovery and unrelated archive records survive.
 for(const attempt of result.attempts){const id=attempt.competitionId;official.tournaments[id]={...official.tournaments[id],...result.metadata[id]};}
 official.updatedAt=now();await writeJson('history/itf_official_metadata.json',official);
 await writeJson('dist/v3/source_itf_tournaments.json',enrichTournamentMetadata(catalogue,official.tournaments));
 state=applyMetadataBatch(state,result,now());state=reconcileMetadataQueue(state,catalogue,{...saved,...official.tournaments},TODAY,now());await persist();
 const nextMode=selectMetadataBatch(state,'ordinary').length?'ordinary':selectMetadataBatch(state,'extraordinary').length?'extraordinary':'';
 await fs.appendFile(process.env.GITHUB_OUTPUT,`next_mode=${nextMode}\nordinary_count=${metadataQueueStatus(state).ordinary.total}\nextraordinary_count=${selectMetadataBatch(state,'extraordinary',Infinity).length}\n`);
 await fs.appendFile('docs/CourtWatch_v3_handoff_report.md',`\nITF Meta ${mode} ${now()}: attempted ${result.attempts.length}, acquired ${result.acquired}, ordinary ${metadataQueueStatus(state).ordinary.total}, extraordinary ${metadataQueueStatus(state).extraordinary.total}. Partial metadata preserved; official D1 sync follows.\n`);
}else if(process.argv.includes('--bootstrap')){await persist();await fs.appendFile('docs/CourtWatch_v3_handoff_report.md',`\nITF Meta ${now()}: queue initialized/reconciled, started tournaments excluded, no historical recovery.\n`);}
