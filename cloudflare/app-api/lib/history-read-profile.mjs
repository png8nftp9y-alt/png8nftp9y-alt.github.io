// Numeric aggregates only, scoped to one snapshot. No logs, storage or queries.
const phase=sql=>sql.includes('WITH candidate_matches AS MATERIALIZED')?'matches':/\bFROM match_participants p CROSS JOIN matches\b/.test(sql)?'aliases':/\bplayer_identity_people\b/.test(sql)?'identities':'other';
export function historyReadProfile(binding,now=()=>performance.now()){
 const phases=new Map();const started=now();let active=0,peak=0,requests=0,players=0,playerActive=0,playerPeak=0,lastStart=0,jobMax=0,jobErrors=0;
 async function read(sql,operation){
  const name=phase(sql),stat=phases.get(name)||{calls:0,reads:0,sum:0,max:0,db:0,dbSamples:0,rows:0,rowSamples:0,errors:0};phases.set(name,stat);
  stat.calls++;stat.reads+=(sql.match(/ AS __cw_history_slot/g)||[]).length||1;requests++;peak=Math.max(peak,++active);const began=now();
  try{
   const result=await operation(),ms=result?.meta?.timings?.sql_duration_ms??result?.meta?.duration,rows=result?.meta?.rows_read;
   if(Number.isFinite(ms)&&ms>=0){stat.db+=ms;stat.dbSamples++}
   if(Number.isFinite(rows)&&rows>=0){stat.rows+=rows;stat.rowSamples++}
   return result;
  }catch(error){stat.errors++;throw error}
  finally{const elapsed=Math.max(0,now()-began);stat.sum+=elapsed;stat.max=Math.max(stat.max,elapsed);active--;}
 }
 const wrap=(statement,sql)=>({bind:(...values)=>wrap(statement.bind(...values),sql),all:(...args)=>read(sql,()=>statement.all(...args)),first:(...args)=>read(sql,()=>statement.first(...args))});
 return{
  db:{prepare:sql=>wrap(binding.prepare(sql),sql)},
  async player(operation){players++;playerPeak=Math.max(playerPeak,++playerActive);lastStart=Math.max(lastStart,Math.max(0,now()-started));const began=now();try{return await operation()}catch(error){jobErrors++;throw error}finally{jobMax=Math.max(jobMax,Math.max(0,now()-began));playerActive--}},
  report(timing){
   timing.record('hist_last_start',lastStart,`players=${players} peak=${playerPeak} errors=${jobErrors}`);
   timing.record('hist_job_max',jobMax,`requests=${requests} ioPeak=${peak} unfinished=${active}`);
   for(const name of ['matches','aliases','identities','other']){
    const s=phases.get(name);if(!s)continue;
    timing.record('hist_'+name,s.sum,`requests=${s.calls} reads=${s.reads} maxMs=${s.max.toFixed(1)} dbMs=${s.db.toFixed(1)} dbSamples=${s.dbSamples} rowsRead=${s.rows} rowSamples=${s.rowSamples} errors=${s.errors}`);
   }
  }
 };
}
