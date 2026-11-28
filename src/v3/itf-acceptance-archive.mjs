import {createHash} from 'node:crypto';
export const ACCEPTANCE_PREFIX='itf/acceptance-lists';
export const validItfTournament=id=>/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/.test(id);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
export function buildItfAcceptanceArchives(cache){
 if(!Array.isArray(cache?.participants)||!cache.participants.length)throw Error('acceptance_cache_missing_or_empty');
 const groups=new Map();
 for(const p of cache.participants){
  const id=clean(p.competitionId).toUpperCase();if(!validItfTournament(id)||!clean(p.name||p.playerName))continue;
  const rows=groups.get(id)||[];rows.push(p);groups.set(id,rows);
 }
 if(!groups.size)throw Error('acceptance_cache_has_no_valid_tournaments');
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([competitionId,rows])=>{
  const dates=[...new Set(rows.map(p=>timestamp(p.observedAt)).filter(Boolean))].sort();
  const entries=rows.map(p=>{
   const withdrawn=p.withdrawn===true||/withdrawn/i.test(String(p.entryStatus||''));
   const id=clean(p.worldTennisId||p.id||p.playerId),position=Number(p.acceptancePosition),rank=Number(p.singlesRank);
   return {id:/^800\d{6}$/.test(id)?id:'',name:clean(p.name||p.playerName),nationality:clean(p.nationalityCode||p.country),
    gender:clean(p.gender||p.playerTypeCode),section:withdrawn?'W':clean(p.acceptanceCode).toUpperCase()||'OTHER',
    position:Number.isInteger(position)&&position>0?position:null,ranking:Number.isInteger(rank)&&rank>0?rank:null};
  }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const document={version:1,circuit:'itf',competitionId,name:clean(rows[0].tournamentName)||competitionId,
   acquiredAt:dates.length===1&&rows.every(p=>timestamp(p.observedAt))?dates[0]:null,
   sourceAcquiredFrom:dates[0]||null,sourceAcquiredTo:dates.at(-1)||null,
   kind:'last_nonempty_acquired_acceptance',entries};
  const body=JSON.stringify(document);if(entries.length>20000||Buffer.byteLength(body)>4*1024*1024)throw Error('acceptance_tournament_archive_too_large');
  const hash=createHash('sha256').update(body).digest('hex');
  return {competitionId,document,body,hash,key:`${ACCEPTANCE_PREFIX}/current/${competitionId}.json`};
 });
}
export async function publishItfAcceptanceArchives(candidates,{readIndex,writeDocument,writeIndex,bootstrap=false}){
 const old=await readIndex();
 if(old===null&&!bootstrap)return {status:'awaiting_initial_archive',changed:0,writes:0};
 if(old!==null&&(old.version!==1||!old.tournaments||typeof old.tournaments!=='object'||Array.isArray(old.tournaments)))throw Error('invalid_acceptance_archive_index');
 const index=old?structuredClone(old):{version:1,tournaments:{}};
 const pending=candidates.filter(c=>{
  const prior=index.tournaments[c.competitionId];if(prior?.hash===c.hash)return false;
  // A fallback/older cache must never replace a newer acquired list.
  if(prior?.sourceAcquiredTo&&(!c.document.sourceAcquiredTo||prior.sourceAcquiredTo>c.document.sourceAcquiredTo))return false;
  return true;
 });
 let writes=0,changed=0;
 for(let start=0;start<pending.length;start+=20){
  const batch=pending.slice(start,start+20);
  for(let i=0;i<batch.length;i+=4)await Promise.all(batch.slice(i,i+4).map(async c=>{await writeDocument(c);writes++;}));
  for(const c of batch)index.tournaments[c.competitionId]={hash:c.hash,sourceAcquiredTo:c.document.sourceAcquiredTo,entries:c.document.entries.length};
  await writeIndex(index);writes++;changed+=batch.length;
 }
 return {status:'complete',tournaments:Object.keys(index.tournaments).length,changed,writes};
}
