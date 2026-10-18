// D1_WRITE_POLICY: incremental; executes the caller's guarded SQL once and retains provider counters.
import {spawnSync} from 'node:child_process';
export async function cliD1Query(sql,{execute=spawnSync,log=console.log}={}){
 const run=execute('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',sql,'--json'],{encoding:'utf8',maxBuffer:16*1024*1024});
 if(run.status!==0)throw Error(run.stderr||run.stdout||'d1_cli_query_failed');
 const parsed=JSON.parse(run.stdout);
 if(!Array.isArray(parsed)||!parsed.length||!parsed.every(r=>r.success===true))throw Error('d1_cli_invalid_query_result');
 const metrics={queries:parsed.length,rowsRead:0,rowsWritten:0};
 for(const r of parsed){if(!r.meta||!Number.isFinite(r.meta.rows_read)||!Number.isFinite(r.meta.rows_written))throw Error('d1_cli_metrics_unavailable');metrics.rowsRead+=r.meta.rows_read;metrics.rowsWritten+=r.meta.rows_written;}
 log('D1_QUERY_METRICS='+JSON.stringify(metrics));
 return parsed.flatMap(r=>r.results||[]);
}
