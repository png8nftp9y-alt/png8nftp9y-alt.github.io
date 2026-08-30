import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import crypto from 'node:crypto';
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
  if(old){old.observations+=Math.max(1,Number(observations)||1);old.monitored=old.monitored||monitored;return}
  rows.set(sourceKey,{sourceKey,id:'observed_'+hash(sourceKey),circuit,officialId:official,normalizedName,displayName,monitored:Boolean(monitored),observations:Math.max(1,Number(observations)||1),firstObservedAt:extra.firstObservedAt||'',lastObservedAt:extra.lastObservedAt||now,...extra});
}
const fitp=await readGz('tmp/observed/fitp_participant_cache.json.gz');
for(const snapshot of Object.values(fitp.tournaments||{}))for(const p of snapshot.participants||[])add('fitp',p.membershipCard,p.full1||p.full2,1,{ranking:p.ranking||'',lastObservedAt:snapshot.fetchedAt||fitp.generatedAt||now});
const te=await readGz('tmp/observed/tennis_europe_participant_index.json.gz');
for(const [name,refs] of Object.entries(te.byName||{})){const first=(refs||[])[0]||{};add('tennis-europe',first.participantId,first.playerName||name,(refs||[]).length,{lastObservedAt:te.generatedAt||now})}
const itf=await readGz('tmp/observed/itf_participant_cache.json.gz'),itfSourceSlot=(await fs.readFile('tmp/observed/itf-source-slot.txt','utf8')).trim();
for(const p of itf.participants||[]){const name=p.name||p.playerName||[p.firstName,p.lastName].filter(Boolean).join(' '),id=p.worldTennisId||p.id||p.playerId||p.worldTennisNumber||'';add('itf',id,name,1,{nationality:p.nationality||p.country||'',lastObservedAt:p.observedAt||itf.generatedAt||now})}
if(!(itf.participants||[]).length)throw new Error('Selected ITF participant cache is empty');
const players=[...rows.values()].sort((a,b)=>a.circuit.localeCompare(b.circuit)||a.displayName.localeCompare(b.displayName));
const counts=Object.fromEntries(['fitp','tennis-europe','itf'].map(c=>[c,players.filter(p=>p.circuit===c).length]));
await fs.writeFile('observed-players.json',JSON.stringify({version:1,generatedAt:now,counts,total:players.length,sources:{fitp:'current',tennisEurope:'current',itf:itfSourceSlot},players})+'\n');
console.log(JSON.stringify({status:'observed_player_index_built',total:players.length,counts,sources:{fitp:'current',tennisEurope:'current',itf:itfSourceSlot},monitored:players.filter(p=>p.monitored).length}));
