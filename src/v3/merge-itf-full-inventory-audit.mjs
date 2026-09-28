import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const shardRoot=process.argv[2]||'/tmp/itf-official-inventory-shards',archiveRoot=process.argv[3]||'/tmp/itf-complete-audit';
async function files(root,suffix){const out=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith(suffix))out.push(full)}}await walk(root);return out}
const inventory=[];for(const file of await files(shardRoot,'.json'))inventory.push(...(JSON.parse(await fs.readFile(file,'utf8')).tournaments||[]));
const acquired=new Map();
function add(id,event,populated,source){id=String(id||'').toUpperCase();event=String(event||'');if(!id||!event)return;const key=`${id}|${event}`,previous=acquired.get(key)||{populated:false,sources:[]};previous.populated||=Boolean(populated);if(!previous.sources.includes(source))previous.sources.push(source);acquired.set(key,previous)}
for(const file of await files(archiveRoot,'.json.gz')){try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));add(doc.competitionId,doc.event,doc.status==='complete'&&((doc.players||[]).length>0||(doc.matches||[]).length>0),'r2_history')}catch{}}
const state=JSON.parse(await fs.readFile('history/itf_draw_target_db.json','utf8'));
for(const [id,row] of Object.entries(state.tournaments||{}))for(const [event,value] of Object.entries(row.eventCache||{}))add(id,event,Boolean(value?.populated)&&((value.players||[]).length>0),'live_state');
const tournaments=inventory.map(row=>{
 if(row.status!=='inventoried')return{...row,declaredDraws:null,acquiredDraws:null,missingDraws:null,missingEvents:[],classification:'unverifiable'};
 const families=new Map();for(const item of row.events||[]){const family=families.get(item.family)||{family:item.family,events:[]};family.events.push(item.event);families.set(item.family,family)}
 const checks=[...families.values()].map(family=>{const found=family.events.filter(event=>acquired.get(`${row.competitionId}|${event}`)?.populated);return{...family,acquired:found.length>0,acquiredEvents:found}}),missing=checks.filter(check=>!check.acquired);
 return{...row,declaredDraws:checks.length,acquiredDraws:checks.length-missing.length,missingDraws:missing.length,missingEvents:missing,classification:missing.length?'missing_draws':'complete'};
}).sort((a,b)=>String(a.competitionId).localeCompare(String(b.competitionId)));
const report={version:1,generatedAt:new Date().toISOString(),criterion:'Official ITF event inventory grouped by draw family, compared with populated R2 history and live-state draws.',summary:{catalogChecked:tournaments.length,complete:tournaments.filter(row=>row.classification==='complete').length,missingDrawsTournaments:tournaments.filter(row=>row.classification==='missing_draws').length,unverifiable:tournaments.filter(row=>row.classification==='unverifiable').length,declaredDraws:tournaments.reduce((sum,row)=>sum+(row.declaredDraws||0),0),acquiredDraws:tournaments.reduce((sum,row)=>sum+(row.acquiredDraws||0),0),missingDraws:tournaments.reduce((sum,row)=>sum+(row.missingDraws||0),0)},tournaments};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-official-draw-parity.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_OFFICIAL_DRAW_PARITY='+JSON.stringify(report.summary));if(report.summary.unverifiable)process.exitCode=2;
