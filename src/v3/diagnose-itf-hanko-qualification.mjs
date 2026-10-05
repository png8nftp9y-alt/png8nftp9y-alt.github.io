import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {tournamentEvents,drawsheet,drawMatchNodes,playerFromApi} from './itf-common.mjs';
import {readTournamentDrawsInBrowser} from './read-itf-draws-browser.mjs';
import {recoveryTask,COMPETITION,EVENT} from './recover-itf-hanko-qualification.mjs';
const baseline=JSON.parse(await fs.readFile('src/v3/itf-audit-baseline-20261001.json','utf8'));
const saved=recoveryTask(baseline),source={competitionId:COMPETITION,sourceUrl:saved.sourceUrl};
const out='dist/v3/audits/hanko-qualification';await fs.mkdir(out,{recursive:true});
const report={competitionId:COMPETITION,event:EVENT,generatedAt:new Date().toISOString(),savedTask:saved,outcomes:[]};
async function capture(label,json){
 await fs.writeFile(out+'/'+label+'.json.gz',gzipSync(JSON.stringify(json)));
 const nodes=drawMatchNodes(json),rawPlayers=nodes.flatMap(x=>(x.match.teams||[]).flatMap(t=>t.players||[]));
 const normalized=rawPlayers.map(playerFromApi).filter(p=>p.name);
 let references=0,namedObjects=[];const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(v.playerId)references++;if(v.givenName||v.familyName||v.firstName||v.lastName||v.playerName)if(namedObjects.length<8)namedObjects.push(v);Object.values(v).filter(x=>x&&typeof x==='object').forEach(walk)}};walk(json);
 const row={label,matches:nodes.length,rawPlayers:rawPlayers.length,normalizedNames:normalized.length,playerReferences:references,namedObjects,teamSamples:nodes.slice(0,2).map(x=>x.match.teams)};
 report.outcomes.push(row);console.log('HANKO_RAW_DIAGNOSTIC='+JSON.stringify(row));
}
let task=saved;
try{const events=await tournamentEvents(source);await fs.writeFile(out+'/fresh-events.json',JSON.stringify(events,null,2));const exact=events.filter(c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-')===EVENT);if(exact.length!==1)throw new Error('Fresh official inventory has '+exact.length+' target combinations');task={...saved,...exact[0],event:EVENT};report.freshTask=task}catch(e){report.inventoryError=e.message}
try{await capture('direct',await drawsheet(task))}catch(e){report.directError=e.message}
try{const result=await readTournamentDrawsInBrowser(source,{tasks:[task]});if(!result.outcomes[0]?.json)throw new Error(result.outcomes[0]?.error||'browser returned no JSON');await capture('browser',result.outcomes[0].json)}catch(e){report.browserError=e.message}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log('HANKO_DIAGNOSTIC_REPORT='+JSON.stringify(report));
if(!report.outcomes.length)process.exitCode=2;
