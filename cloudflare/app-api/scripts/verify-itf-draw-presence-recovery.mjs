// D1_READ_ONLY: exact native identity keys, bounded batches, no document or match scans.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {mergeItfDrawPresences,missingItfDrawPresences} from '../../../src/v3/itf-draw-presence-registry.mjs';
const doc=JSON.parse(gunzipSync(await fs.readFile('../../history/itf-confirmed-draw-presences.json.gz')));
const expected=mergeItfDrawPresences([],doc.entries||[]),ids=[...new Set(expected.map(e=>e.id))],profiles=[],metrics={queries:0,rowsRead:0,rowsWritten:0};
const {query}=await openReadOnlyD1({onMetrics:results=>{for(const r of results){metrics.queries++;metrics.rowsRead+=Number(r.meta?.rows_read)||0;metrics.rowsWritten+=Number(r.meta?.rows_written)||0;}}});
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
for(let offset=0;offset<ids.length;offset+=100){
 const keys=ids.slice(offset,offset+100).map(quote).join(',');
 const rows=await query(`SELECT circuit,source_player_id,payload FROM opponent_entry_profiles WHERE circuit='itf' AND source_player_id IN (${keys})`);
 profiles.push(...rows);
}
const missing=missingItfDrawPresences(expected,profiles);
const report={status:missing.length?'incomplete':'complete',expectedPresences:expected.length,expectedPlayers:ids.length,checkedProfiles:profiles.length,missingCount:missing.length,missing,metrics};
await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/itf-draw-presence-recovery-report.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_DRAW_PRESENCE_RECOVERY='+JSON.stringify({...report,missing:missing.slice(0,20)}));
if(missing.length||metrics.rowsWritten)throw Error('ITF confirmed draw recovery verification incomplete');
