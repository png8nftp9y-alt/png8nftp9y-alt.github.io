import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {legacyAcceptanceCandidate} from '../lib/legacy-acceptance-profile-migration.mjs';
import {normalizePlayerName} from '../lib/player-circuit-profiles.mjs';
import {unresolvedSources} from './repair-archived-player-profiles.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
import {addD1Metrics} from './sync-player-identities.mjs';
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
async function query(sql){if(!/^SELECT\b/i.test(sql))throw Error("read_only_diagnostic");const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('D1_minimum_profile_failed_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[]}
const doc=JSON.parse(gunzipSync(await fs.readFile(process.env.TE_NATIVE_ACCEPTANCE_CACHE))),sources=(await unresolvedSources(query)).filter(r=>r.circuit==='tennis-europe'),reasons={},results=[];
for(const source of sources){const n=normalizePlayerName(source.display_name),variants=[n,n.toLowerCase(),n.split(' ').reverse().join(' '),n.split(' ').reverse().join(' ').toLowerCase()];const entries=await query("SELECT source_player_id,display_name,payload FROM opponent_entry_profiles WHERE circuit='tennis-europe' AND normalized_name IN ("+variants.map(sqlString).join(',')+') LIMIT 101');const diagnostic={};if(entries.length>100)diagnostic.reason='entry_limit_exceeded';else legacyAcceptanceCandidate(source,entries,doc,diagnostic);reasons[diagnostic.reason]=(reasons[diagnostic.reason]||0)+1;results.push({index:results.length,...diagnostic})}
console.log(JSON.stringify({status:'read_only_evidence_check',examined:sources.length,reasons,results,metrics}));
