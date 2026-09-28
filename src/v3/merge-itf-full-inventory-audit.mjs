import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const shardRoot=process.argv[2]||'/tmp/itf-official-inventory-shards',archiveRoot=process.argv[3]||'/tmp/itf-complete-audit',previousFile=process.argv[4]||'';
async function files(root,suffix){const out=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith(suffix))out.push(full)}}await walk(root);return out}
const current=[];for(const file of await files(shardRoot,'.json'))current.push(...(JSON.parse(await fs.readFile(file,'utf8')).tournaments||[]));
let previous={tournaments:[]};if(previousFile)try{previous=JSON.parse(await fs.readFile(previousFile,'utf8'))}catch{}
const inventoryById=new Map((previous.tournaments||[]).map(row=>[String(row.competitionId||'').toUpperCase(),row]));
for(const row of current){const id=String(row.competitionId||'').toUpperCase(),old=inventoryById.get(id);if(row.status==='inventoried'||!old||old.classification==='unverifiable')inventoryById.set(id,row)}
const inventory=[...inventoryById.values()];
const acquired=new Map();
function add(id,event,populated,source){id=String(id||'').toUpperCase();event=String(event||'');if(!id||!event)return;const key=`${id}|${event}`,previous=acquired.get(key)||{populated:false,sources:[]};previous.populated||=Boolean(populated);if(!previous.sources.includes(source))previous.sources.push(source);acquired.set(key,previous)}
for(const file of await files(archiveRoot,'.json.gz')){try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));add(doc.competitionId,doc.event,doc.status==='complete'&&((doc.players||[]).length>0||(doc.matches||[]).length>0),'r2_history')}catch{}}
const state=JSON.parse(await fs.readFile('history/itf_draw_target_db.json','utf8'));
for(const [id,row] of Object.entries(state.tournaments||{}))for(const [event,value] of Object.entries(row.eventCache||{}))add(id,event,Boolean(value?.populated)&&((value.players||[]).length>0),'live_state');
const tournaments=inventory.map(row=>{
 if(row.status!=='inventoried')return{...row,declaredDraws:null,acquiredDraws:null,missingDraws:null,missingEvents:[],classification:'unverifiable'};
 const checks=(row.events||[]).map(item=>{const stored=acquired.get(`${row.competitionId}|${item.event}`),roundRobin=item.structure==='RR';return{event:item.event,family:item.family,structure:item.structure,acquired:Boolean(stored?.populated),sources:stored?.sources||[],roundRobinGroupCertificationRequired:roundRobin}}),missing=checks.filter(check=>!check.acquired),roundRobinPending=checks.filter(check=>check.acquired&&check.roundRobinGroupCertificationRequired);
 const classification=missing.length?'missing_draws':roundRobinPending.length?'round_robin_groups_unverified':'complete';
 return{...row,declaredDraws:checks.length,acquiredDraws:checks.filter(check=>check.acquired).length,missingDraws:missing.length,missingEvents:missing,roundRobinDrawsPendingCertification:roundRobinPending.map(check=>check.event),checks,classification};
}).sort((a,b)=>String(a.competitionId).localeCompare(String(b.competitionId)));
const today=new Date().toISOString().slice(0,10),windowEnd=new Date(Date.parse(today+'T00:00:00Z')+3*864e5).toISOString().slice(0,10),unverifiable=tournaments.filter(row=>row.classification==='unverifiable'),concludedUnverifiable=unverifiable.filter(row=>String(row.endDate||'')<today),activeD3Unverifiable=unverifiable.filter(row=>String(row.endDate||'')>=today&&String(row.startDate||'')<=windowEnd),futureUnverifiable=unverifiable.filter(row=>String(row.startDate||'')>windowEnd);
const report={version:3,generatedAt:new Date().toISOString(),criterion:'Strict parity: every official ITF event must be populated. A Round Robin event is never complete until every declared group is separately certified.',summary:{catalogChecked:tournaments.length,complete:tournaments.filter(row=>row.classification==='complete').length,missingDrawsTournaments:tournaments.filter(row=>row.classification==='missing_draws').length,roundRobinGroupsUnverified:tournaments.filter(row=>row.classification==='round_robin_groups_unverified').length,unverifiable:unverifiable.length,concludedUnverifiable:concludedUnverifiable.length,activeD3Unverifiable:activeD3Unverifiable.length,actionableUnverifiable:concludedUnverifiable.length+activeD3Unverifiable.length,futureUnverifiable:futureUnverifiable.length,declaredDraws:tournaments.reduce((sum,row)=>sum+(row.declaredDraws||0),0),acquiredDraws:tournaments.reduce((sum,row)=>sum+(row.acquiredDraws||0),0),missingDraws:tournaments.reduce((sum,row)=>sum+(row.missingDraws||0),0)},tournaments};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-official-draw-parity.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_OFFICIAL_DRAW_PARITY='+JSON.stringify(report.summary));
