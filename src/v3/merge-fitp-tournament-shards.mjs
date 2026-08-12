import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const SHARDS=['core_dates','core_terms','nw_regions','nw_provinces1','nw_provinces2','nw_terms','ne_regions','ne_provinces1','ne_provinces2','ne_terms','ce_regions','ce_provinces1','ce_provinces2','ce_terms','so_regions','so_provinces1','so_provinces2','so_terms'];
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const byId=new Map(); const shardStats=[]; const errors=[];
for(const shard of SHARDS){
 const p=`dist/v3/shards/source_fitp_tournaments_${shard}.json`;
 const j=await readJson(p,null);
 if(!j){errors.push({shard,error:'missing shard output'});continue}
 shardStats.push({shard,generatedAt:j.generatedAt,status:j.status,specs:j.specs,queries:j.queries,tournamentsFound:j.tournamentsFound,errors:(j.errors||[]).length});
 for(const t of j.tournaments||[]){
  const k=String(t.competitionId||'').toUpperCase(); if(!k)continue;
  if(!byId.has(k)) byId.set(k,{...t,discoveryShards:[],coverageModes:[]});
  const cur=byId.get(k);
  cur.discoveryShards=[...new Set([...(cur.discoveryShards||[]),t.discoveryShard||shard])].sort();
  cur.coverageModes=[...new Set([...(cur.coverageModes||[]),...(t.coverageModes||[])])].sort();
 }
}
const tournaments=[...byId.values()].sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||String(a.tournamentName||'').localeCompare(String(b.tournamentName||'')));
const byStatus={}; for(const t of tournaments)byStatus[t.status]=(byStatus[t.status]||0)+1;
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'fitp_individual_tournament_micro_sharded_map_with_missing_shards':'fitp_individual_tournament_micro_sharded_map_complete',source:'FITP individual tournaments only: merged micro-sharded official P.U.C. discovery. Micro-shards by core/date, terms, region, province groups and geographic terms. Tennis Europe excluded. No player keywords, no team championships, no draws, no OOP, no results.',coverageFrom:'2025-12-18',coverageUntil:tournaments.reduce((m,t)=>t.endDate&&t.endDate>m?t.endDate:m,'2025-12-18'),queries:shardStats.reduce((a,s)=>a+(s.queries||0),0),tournamentsFound:tournaments.length,bySource:{'TORNEI FITP':tournaments.length},byStatus,quality:{microSharded:true,shards:shardStats,expectedShards:SHARDS.length,failedShards:errors.length,individualOnly:true,tennisEuropeExcluded:true,usesPlayerKeywords:false,usesDraws:false,usesOrderOfPlay:false,usesResults:false},tournaments,errors};
await writeJson('dist/v3/source_fitp_tournaments.json',out);
await writeJson('dist/v3/source_fitp_tournaments_audit.json',{...out,tournaments:undefined,sample:tournaments.slice(0,300)});
console.log(JSON.stringify({...out,tournaments:undefined},null,2));
if(errors.length) process.exitCode=1;
