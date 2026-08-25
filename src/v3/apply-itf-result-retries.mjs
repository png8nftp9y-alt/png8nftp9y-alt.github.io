import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
const dir='dist/v3/shards/itf',patches=[];
for(const f of await fs.readdir(dir))if(/^retry-\d+\.json\.gz$/.test(f))patches.push(JSON.parse(gunzipSync(await fs.readFile(`${dir}/${f}`))));
if(!patches.length)throw new Error('No ITF retry artifacts found.');
if(patches.some(p=>p.version!==2))throw new Error('Refusing retry artifacts without section-level resolution metadata.');
const retryKey=x=>x.event?`${x.competitionId}|draw|${x.event}`:`${x.competitionId}|events`,resolved=new Set(patches.flatMap(p=>p.resolvedKeys||[])),replacements=new Map();
for(const item of patches.flatMap(p=>p.retryQueue||[]))replacements.set(retryKey(item),item);
const patchMatches=patches.flatMap(p=>p.matches||[]),patchPlayers=patches.flatMap(p=>p.players||[]),sections=patches.flatMap(p=>p.sections||[]);
let originalRetries=0,remainingRetries=0,resolvedRetries=0;
for(const f of await fs.readdir(dir))if(/^results-\d+\.json\.gz$/.test(f)){
 const d=JSON.parse(gunzipSync(await fs.readFile(`${dir}/${f}`))),owned=new Set((d.retryQueue||[]).map(x=>x.competitionId).filter(Boolean)),kept=[];originalRetries+=(d.retryQueue||[]).length;
 for(const item of d.retryQueue||[]){const key=retryKey(item);if(resolved.has(key)){resolvedRetries++;continue}if(replacements.has(key)){kept.push(replacements.get(key));replacements.delete(key)}else kept.push(item)}
 for(const [key,item] of [...replacements])if(owned.has(item.competitionId)){kept.push(item);replacements.delete(key)}
 d.matches.push(...patchMatches.filter(m=>owned.has(m.competitionId)));d.matches=[...new Map((d.matches||[]).map(m=>[m.matchId||[m.competitionId,m.event,m.roundNumber,m.round].join('|'),m])).values()];
 d.players=[...new Map([...(d.players||[]),...patchPlayers].map(p=>[p.id||p.name,p])).values()];d.retryQueue=[...new Map(kept.map(x=>[retryKey(x),x])).values()];remainingRetries+=d.retryQueue.length;d.retryReview={version:2,appliedAt:new Date().toISOString(),sectionLevel:true};d.version=5;await fs.writeFile(`${dir}/${f}`,gzipSync(JSON.stringify(d)));
}
if(replacements.size)throw new Error(`${replacements.size} retry replacements could not be assigned to an original result shard.`);
const audit={version:3,generatedAt:new Date().toISOString(),status:remainingRetries?'itf_section_retry_incomplete':'itf_section_retry_complete',patches:patches.length,originalRetries,resolvedRetries,remainingRetries,summary:{populated:sections.filter(x=>x.status==='populated').length,publishedEmptyPending:sections.filter(x=>x.status==='published_empty_pending').length,concludedEmptyAnomalies:sections.filter(x=>x.status==='published_empty_anomaly').length,missingOrUnreadable:sections.filter(x=>x.status==='missing_or_unreadable').length},sections};
await fs.writeFile('dist/v3/source_itf_retry_audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({...audit.summary,patches:patches.length,originalRetries,resolvedRetries,remainingRetries,status:audit.status},null,2));if(remainingRetries)process.exitCode=2;
