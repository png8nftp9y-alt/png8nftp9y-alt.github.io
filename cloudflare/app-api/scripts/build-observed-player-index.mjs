import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import crypto from 'node:crypto';
import {requirePlayerCircuitIds} from '../lib/required-player-circuit-id.mjs';
// D1_WRITE_POLICY: incremental; source-bound recovery SELECTs only.
// buildIncrementalSyncPlan is enforced by the downstream importer.
import {playerSourceMetadata} from '../lib/personal-player-metadata.mjs';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const readGz=async file=>JSON.parse(gunzipSync(await fs.readFile(file)));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24);
const monitoredDoc=await read('../../players.json'),monitoredNames=new Set(),monitoredCards=new Set(),monitoredIds=new Set();
for(const p of monitoredDoc.players||[]){for(const name of [p.name,...(p.aliases||[])])if(norm(name))monitoredNames.add(norm(name));if(p.membershipCard)monitoredCards.add(String(p.membershipCard));for(const id of [p.worldTennisId,p.profileSync?.itf?.worldTennisId,p.profileSync?.tennisEurope?.profileId])if(id)monitoredIds.add(String(id))}
const rows=new Map(),now=new Date().toISOString();
function add(circuit,officialId,name,observations=1,extra={}){
  const displayName=clean(name),normalizedName=norm(displayName);if(!normalizedName)return;
  const official=clean(officialId),sourceKey=circuit+'|'+(official?'id:'+official:'name:'+normalizedName),old=rows.get(sourceKey);
  const monitored=(official&&(monitoredIds.has(official)||monitoredCards.has(official)))||monitoredNames.has(normalizedName);
  if(old){old.observations+=Math.max(1,Number(observations)||1);old.monitored=old.monitored||monitored;for(const [key,value] of Object.entries(extra))if(value!==''&&value!=null&&(!old[key]||Date.parse(extra.lastObservedAt||'')>=Date.parse(old.lastObservedAt||'')))old[key]=value;return}
  rows.set(sourceKey,{sourceKey,id:'observed_'+hash(sourceKey),circuit,officialId:official,normalizedName,displayName,monitored:Boolean(monitored),observations:Math.max(1,Number(observations)||1),firstObservedAt:extra.firstObservedAt||'',lastObservedAt:extra.lastObservedAt||now,...extra});
}
const fitp=await readGz('tmp/observed/fitp_participant_cache.json.gz');
for(const snapshot of Object.values(fitp.tournaments||{}))for(const p of snapshot.participants||[])add('fitp',p.membershipCard,p.full1||p.full2,1,{...playerSourceMetadata(p),ranking:p.ranking||'',lastObservedAt:snapshot.fetchedAt||fitp.generatedAt||now});
const te=await readGz('tmp/observed/tennis_europe_participant_index.json.gz');
for(const [name,refs] of Object.entries(te.byName||{})){const first=(refs||[])[0]||{};add('tennis-europe',first.participantId,first.playerName||name,(refs||[]).length,{...playerSourceMetadata(first),lastObservedAt:te.generatedAt||now})}
const itf=await readGz('tmp/observed/itf_participant_cache.json.gz'),itfSourceSlot=(await fs.readFile('tmp/observed/itf-source-slot.txt','utf8')).trim();
for(const p of itf.participants||[]){const name=p.name||p.playerName||[p.firstName,p.lastName].filter(Boolean).join(' '),id=p.worldTennisId||p.id||p.playerId||p.worldTennisNumber||'';add('itf',id,name,1,{...playerSourceMetadata(p),lastObservedAt:p.observedAt||itf.generatedAt||now})}
if(!(itf.participants||[]).length)throw new Error('Selected ITF participant cache is empty');
async function knownSourceIds(sql){
 const config=await read('wrangler.generated.jsonc'),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw Error('observed_native_id_recovery_credentials_missing');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});
 const result=await response.json();if(!response.ok||!result.success||!result.result?.every(r=>r.success))throw Error('observed_native_id_recovery_failed');return result.result[0].results||[];
}
const required=await requirePlayerCircuitIds(knownSourceIds,[...rows.values()].map(r=>({source_key:r.sourceKey,circuit:r.circuit,official_id:r.officialId,display_name:r.displayName,payload:r})));
const players=required.rows.map(r=>({...r.payload,sourceKey:r.source_key,officialId:r.official_id})).sort((a,b)=>a.circuit.localeCompare(b.circuit)||a.displayName.localeCompare(b.displayName));
const counts=Object.fromEntries(['fitp','tennis-europe','itf'].map(c=>[c,players.filter(p=>p.circuit===c).length]));
await fs.writeFile('observed-players.json',JSON.stringify({version:1,generatedAt:now,counts,total:players.length,sources:{fitp:'current',tennisEurope:'current',itf:itfSourceSlot},players})+'\n');
console.log(JSON.stringify({status:'observed_player_index_built',total:players.length,counts,sources:{fitp:'current',tennisEurope:'current',itf:itfSourceSlot},monitored:players.filter(p=>p.monitored).length,recoveredCircuitIds:required.recovered,excludedRecords:required.excludedRecords}));
