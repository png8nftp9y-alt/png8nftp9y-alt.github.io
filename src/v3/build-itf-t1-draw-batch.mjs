import fs from 'node:fs/promises';
import path from 'node:path';
import {readJson,writeJson} from './itf-common.mjs';
import {eventKey,sectionId,taskId} from './itf-draw-identity.mjs';
import {isKnownUnusedDraw} from './itf-known-unused-draws.mjs';

const root=process.env.ITF_T1_INVENTORY_ROOT||'dist/v3/shards/itf/inventory';
const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}}),docs=[];
async function walk(dir){let items=[];try{items=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const item of items){const full=path.join(dir,item.name);if(item.isDirectory())await walk(full);else if(item.name.endsWith('.json'))docs.push(await readJson(full,null))}}
await walk(root);

const tasks=[],inventories=[];
for(const doc of docs.filter(Boolean)){
 const id=doc.competitionId,previous=state.tournaments?.[id]||{},cache=previous.eventCache||{};
 const declared=doc.status==='complete'?(doc.events||[]).map(item=>({...item,event:item.event||eventKey(item),sectionId:item.sectionId||sectionId(item)})):[];
 const eventCounts=new Map();for(const item of declared)eventCounts.set(item.event,(eventCounts.get(item.event)||0)+1);
 const cached=item=>cache[item.sectionId]||(eventCounts.get(item.event)===1?cache[item.event]:null);
 const knownUnused=item=>isKnownUnusedDraw(id,item.event);
 const resolved=item=>Boolean(cached(item)?.populated||cached(item)?.terminalAlternative||knownUnused(item));
 const status=item=>cached(item)?.populated?'acquired':knownUnused(item)||cached(item)?.resolution==='declared_but_unused'?'declared_but_unused':cached(item)?.terminalAlternative?'unused_alternative_structure':'pending';
 const sections=declared.map((item,index)=>({index,event:item.event,sectionId:item.sectionId,acquired:Boolean(cached(item)?.populated),resolved:resolved(item),status:status(item),combo:item}));
 const fallbackSections=!sections.length?(previous.eventInventory||[]).map((item,index)=>{const combo=item.combo||{},event=item.event||eventKey(combo);let unique=item.sectionId||event;try{unique=item.sectionId||sectionId(combo)}catch{}return{index,event,sectionId:unique,acquired:Boolean(cache[unique]?.populated||cache[event]?.populated),resolved:Boolean(cache[unique]?.populated||cache[unique]?.terminalAlternative||cache[event]?.populated||cache[event]?.terminalAlternative||isKnownUnusedDraw(id,event)),status:cache[unique]?.populated||cache[event]?.populated?'acquired':isKnownUnusedDraw(id,event)||cache[unique]?.resolution==='declared_but_unused'||cache[event]?.resolution==='declared_but_unused'?'declared_but_unused':cache[unique]?.terminalAlternative||cache[event]?.terminalAlternative?'unused_alternative_structure':'pending',combo:{...combo,event,sectionId:unique}}}):sections;
 const inventory={version:5,generatedAt:new Date().toISOString(),mode:'live_t_minus_one_historical_batch',competitionId:id,tournamentName:doc.tournament?.tournamentName||'',tournament:doc.tournament||{},declaredSections:fallbackSections.length,alreadyAcquiredSections:fallbackSections.filter(item=>item.acquired).length,alreadyResolvedSections:fallbackSections.filter(item=>item.resolved).length,unusedAlternativeSections:fallbackSections.filter(item=>item.status==='unused_alternative_structure').length,requestedSections:sections.filter(item=>!item.resolved).length,inventoryError:doc.status==='complete'?null:(doc.error||'event_inventory_retry_required'),sections:fallbackSections};
 inventories.push(inventory);await writeJson(`dist/v3/shards/itf/t1-inventory/${id}.json`,inventory);
 if(doc.status==='complete')for(const item of declared)if(!resolved(item))tasks.push({...item,index:tasks.length,competitionId:id,taskId:taskId(id,item)});
}
if(tasks.length>240)throw new Error('ITF T-1 draw batch exceeds safe matrix size: '+tasks.length);
const matrix={include:tasks.length?tasks.map(task=>({index:task.index,competitionId:task.competitionId,event:task.event,sectionId:task.sectionId,task:Buffer.from(JSON.stringify(task)).toString('base64')})):[{skip:true,index:0,competitionId:'none',event:'none',sectionId:'none',task:''}]};
await writeJson('dist/v3/itf_t1_draw_batch.json',{version:2,generatedAt:new Date().toISOString(),tournaments:inventories.length,tasks:tasks.length,inventoryErrors:inventories.filter(item=>item.inventoryError).length});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\ntasks='+tasks.length+'\ntournaments='+inventories.length+'\n');
console.log(JSON.stringify({tournaments:inventories.length,tasks:tasks.length,inventoryErrors:inventories.filter(item=>item.inventoryError).length},null,2));
