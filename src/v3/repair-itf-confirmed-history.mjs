import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {configuredItfDrawPresences} from './itf-draw-presence-registry.mjs';
import {mergeConfirmedItfHistory,preserveConfirmedItfTargets,itfTargetEvidence} from './itf-confirmed-history.mjs';
const read=async name=>JSON.parse(await fs.readFile(name,'utf8'));
const write=async(name,data)=>fs.writeFile(name,JSON.stringify(data,null,2)+'\n');
const [source,targets,recovery,previous]=await Promise.all([
 read('dist/v3/source_itf_entries.json'),read('history/itf_draw_target_db.json'),
 read('history/itf-confirmed-draw-recovery.json'),read('dist/v3/entries_itf.json')]);
const today=new Date().toISOString().slice(0,10);
const baseEvidence=[...itfTargetEvidence(targets),...(source.entries||[]),...(previous.entries||[]),...recovery.entries];
const registry=JSON.parse(gunzipSync(await fs.readFile('history/itf-confirmed-draw-presences.json.gz')));
const evidence=[...baseEvidence,...configuredItfDrawPresences(registry.entries||[],baseEvidence)];
const entries=mergeConfirmedItfHistory(source.entries||[],evidence,today);
const nextTargets=preserveConfirmedItfTargets(targets.targets||{},evidence,today);
await write('dist/v3/source_itf_entries.json',{...source,entries,entriesFound:entries.length});
await write('history/itf_draw_target_db.json',{...targets,targets:nextTargets,targetCount:Object.keys(nextTargets).length});
console.log('ITF: retained confirmed begun draw history; recovered documented confirmations:',recovery.entries.length);
