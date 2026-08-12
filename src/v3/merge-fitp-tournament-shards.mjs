import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const SHARDS=['core_dates','core_terms','nw_regions','nw_provinces1','nw_provinces2','nw_terms','ne_regions','ne_provinces1','ne_provinces2','ne_terms','ce_regions','ce_provinces1','ce_provinces2','ce_terms','so_regions','so_provinces1','so_provinces2','so_terms'];
const OWNER='png8nftp9y-alt', REPO='png8nftp9y-alt.github.io';
const BASELINE_COMMIT='59f59a8d801baa0f9df5eb2679fbad926f2d75d2';
const BASELINE_URL=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BASELINE_COMMIT}/dist/v3/source_fitp_tournaments.json`;
const REGRESSION_IDS={feniceBresciaLomb370:'676A77A5-3B55-479E-81E2-45F109C25F98',rossoniKinderImperia:'25C6CC33-AE3A-447E-A55B-FBE66FBAFC80',navaKinderMilano3:'B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'};
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function fetchJson(url){try{const r=await fetch(url,{headers:{'user-agent':'CourtWatch-v3-fitp-hybrid-merger/1.0'}}); if(!r.ok) throw new Error(`${r.status}`); return await r.json()}catch(e){return {error:e.message,tournaments:[]}}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const key=t=>String(t?.competitionId||t?.guid||'').toUpperCase();
const provinceOf=t=>{const loc=String(t.location||''); const m=loc.match(/\b([A-Z]{2})$/); return m?m[1]:''};
const monthOf=t=>String(t.startDate||'').slice(0,7)||'unknown';
function group(arr,fn){const o={}; for(const x of arr){const k=fn(x)||'unknown'; o[k]=(o[k]||0)+1} return Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))}
const byId=new Map(); const shardStats=[]; const errors=[]; const sourcesById={};
const baseline=await fetchJson(BASELINE_URL);
if(baseline.error) errors.push({source:'baseline',error:baseline.error});
for(const t of baseline.tournaments||[]){const k=key(t); if(!k)continue; byId.set(k,{...t,discoveryShards:[...(t.discoveryShards||[]),'baseline_old_micro_sharded'].filter(Boolean),coverageModes:[...(t.coverageModes||[])]}); (sourcesById[k]??=new Set()).add('baseline');}
const baselineIds=new Set([...byId.keys()]);
for(const shard of SHARDS){
 const p=`dist/v3/shards/source_fitp_tournaments_${shard}.json`;
 const j=await readJson(p,null);
 if(!j){errors.push({shard,error:'missing shard output'});continue}
 shardStats.push({shard,generatedAt:j.generatedAt,status:j.status,specs:j.specs,branches:j.branches,queries:j.queries,tournamentsFound:j.tournamentsFound,unresolvedSaturations:j.unresolvedSaturations||0,errors:(j.errors||[]).length,regression:j.regression});
 for(const t of j.tournaments||[]){
  const k=key(t); if(!k)continue;
  if(!byId.has(k)) byId.set(k,{...t,discoveryShards:[],coverageModes:[]});
  const cur=byId.get(k);
  cur.discoveryShards=[...new Set([...(cur.discoveryShards||[]),t.discoveryShard||shard])].sort();
  cur.coverageModes=[...new Set([...(cur.coverageModes||[]),...(t.coverageModes||[])])].sort();
  (sourcesById[k]??=new Set()).add('provincial_window');
 }
}
const tournaments=[...byId.values()].sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.tournamentName||'').localeCompare(String(b.tournamentName||'')));
const currentIds=new Set(); for(const shard of SHARDS){const j=await readJson(`dist/v3/shards/source_fitp_tournaments_${shard}.json`,{}); for(const t of j.tournaments||[]) currentIds.add(key(t));}
const addedByProvincial=tournaments.filter(t=>currentIds.has(key(t))&&!baselineIds.has(key(t)));
const baselineOnly=tournaments.filter(t=>baselineIds.has(key(t))&&!currentIds.has(key(t)));
const byStatus={}; for(const t of tournaments)byStatus[t.status]=(byStatus[t.status]||0)+1;
const ids=new Set(tournaments.map(key)); const regression={}; for(const [name,id] of Object.entries(REGRESSION_IDS)) regression[name]={present:ids.has(id),source:[...(sourcesById[id]||new Set())].sort()};
const out={version:'cw-v3-fitp-provincial-window-hybrid',generatedAt:NOW,status:errors.length?'fitp_hybrid_tournament_map_with_errors':'fitp_hybrid_tournament_map_complete',source:'Hybrid safety map: old complete micro-sharded FITP map preserved as baseline, plus new province × rotating-window structured P.U.C. engine. This prevents coverage regression while the provincial engine is hardened. Final dedupe by competitionId. No player keywords are used by the provincial engine.',coverageFrom:'2025-12-18',coverageUntil:tournaments.reduce((m,t)=>t.endDate&&t.endDate>m?t.endDate:m,'2025-12-18'),baseline:{commit:BASELINE_COMMIT,count:(baseline.tournaments||[]).length},provincialWindow:{queries:shardStats.reduce((a,s)=>a+(s.queries||0),0),tournamentsFound:currentIds.size,addedBeyondBaseline:addedByProvincial.length,baselineOnly:baselineOnly.length},queries:shardStats.reduce((a,s)=>a+(s.queries||0),0),tournamentsFound:tournaments.length,bySource:{'TORNEI FITP':tournaments.length},byStatus,regression,quality:{hybridSafety:true,microSharded:true,shards:shardStats,expectedShards:SHARDS.length,failedShards:errors.filter(e=>e.shard).length,individualOnly:true,tennisEuropeExcluded:true,usesPlayerKeywords:false,usesDraws:false,usesOrderOfPlay:false,usesResults:false,baselineOnlyByProvince:group(baselineOnly,provinceOf),baselineOnlyByMonth:group(baselineOnly,monthOf),addedByProvince:group(addedByProvincial,provinceOf),addedByMonth:group(addedByProvincial,monthOf)},tournaments,errors};
await writeJson('dist/v3/source_fitp_tournaments.json',out);
await writeJson('dist/v3/source_fitp_tournaments_audit.json',{...out,tournaments:undefined,sample:tournaments.slice(0,300),baselineOnlySample:baselineOnly.slice(0,300),addedByProvincialSample:addedByProvincial.slice(0,200)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length) process.exitCode=1;
