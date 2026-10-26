// Resume only validated, complete tournament records from an explicit source artifact.
export function resumeBackfill(source,queue,{shard,total,cutoff,today}){
  if(!source)return{completed:[],pending:queue};
  const fail=()=>{throw new Error('Incompatible or incomplete backfill checkpoint; no acquisition started')};
  if(source.version!=='te-oop-backfill-shard-v1'||source.shard!==shard||source.totalShards!==total||source.cutoff!==cutoff||source.evaluatedOn!==today||!Array.isArray(source.tournaments)||!Array.isArray(source.failures))fail();
  const expected=new Map(queue.map(t=>[t.competitionId,t])),seen=new Set(),completed=[];
  for(const t of source.tournaments){
    const original=expected.get(t.competitionId);
    if(!original||seen.has(t.competitionId)||t.startDate!==original.startDate||t.endDate!==original.endDate||!Array.isArray(t.matches)||!Array.isArray(t.dates)||!t.drawRecovery)fail();
    const ids=new Set();
    for(const m of t.matches){
      if(m.competitionId!==t.competitionId||!m.id||ids.has(m.id)||!Array.isArray(m.players)||![2,4].includes(m.players.length)||!['completed','scheduled'].includes(m.status)||m.status==='completed'&&!m.winnerPlayerIds?.length)fail();
      ids.add(m.id);
    }
    seen.add(t.competitionId);completed.push(t);
  }
  const failed=new Set();
  for(const f of source.failures){if(!expected.has(f.competitionId)||seen.has(f.competitionId)||failed.has(f.competitionId))fail();failed.add(f.competitionId)}
  if(seen.size+failed.size!==expected.size||source.counts?.queued!==expected.size||source.counts?.processed!==seen.size)fail();
  return{completed,pending:queue.filter(t=>!seen.has(t.competitionId))};
}
