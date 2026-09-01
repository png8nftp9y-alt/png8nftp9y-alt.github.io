import fs from 'node:fs/promises';
import {readJson,writeJson} from './itf-common.mjs';

const ids=[
 'J-J30-MDV-2026-004','J-J30-MEX-2026-011','J-J30-MKD-2026-003','J-J30-PAN-2026-002','J-J30-ROU-2026-003','J-J30-TJK-2026-005','J-J300-USA-2026-003','J-J60-BRA-2026-004','J-J60-CHI-2026-003','J-J60-CHN-2026-011','J-J60-IND-2026-007','J-J60-MAC-2026-001','J-J60-SGP-2026-005','J-J60-SUI-2026-001','J-J100-ESP-2026-006','J-J60-TTO-2026-002','J-J60-TUN-2026-005'
];
const dir='dist/v3/shards/itf/inventory',docs=[];
try{for(const file of await fs.readdir(dir))if(file.endsWith('.json'))docs.push(await readJson(dir+'/'+file,null))}catch{}
const byId=new Map(docs.filter(Boolean).map(doc=>[doc.competitionId,doc]));
const missing=ids.filter(id=>!byId.has(id)),retry=ids.map(id=>byId.get(id)).filter(doc=>doc&&doc.status!=='complete').map(doc=>({competitionId:doc.competitionId,error:doc.error||''}));
const tasks=ids.flatMap(id=>byId.get(id)?.status==='complete'?(byId.get(id).events||[]):[]).map((event,index)=>({...event,index,taskId:event.competitionId+'__'+event.event}));
const matrix={include:tasks.map(task=>({index:task.index,competitionId:task.competitionId,event:task.event,task:Buffer.from(JSON.stringify(task)).toString('base64')}))};
const status=missing.length||retry.length||!tasks.length?'bridge_inventory_incomplete':'bridge_inventory_complete';
await writeJson('dist/v3/itf_bridge_draw_queue.json',{version:1,generatedAt:new Date().toISOString(),status,expectedTournaments:ids.length,inventoriedTournaments:ids.length-missing.length,missing,retry,taskCount:tasks.length,tasks});
if(process.env.GITHUB_OUTPUT){await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\nexpected='+tasks.length+'\nstatus='+status+'\n')}
console.log(JSON.stringify({status,expectedTournaments:ids.length,inventoriedTournaments:ids.length-missing.length,missing:missing.length,retry:retry.length,tasks:tasks.length},null,2));
if(status!=='bridge_inventory_complete')process.exitCode=2;
