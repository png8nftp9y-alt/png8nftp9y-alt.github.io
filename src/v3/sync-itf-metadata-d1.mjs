import fs from 'node:fs/promises';
import {metadataRows,metadataPlan,metadataSQL,verifyMetadata} from './itf-metadata-d1.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan, payload guards and verified readback.
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const rows=metadataRows(await Promise.all(['dist/v3/source_itf_history_tournaments.json','dist/v3/source_itf_tournaments.json'].map(read)),await read('history/itf_official_metadata.json'));
const config=await read('cloudflare/app-api/wrangler.generated.jsonc'),db=config.d1_databases.find(x=>x.binding==='DB')?.database_id;
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token||!db)throw Error('ITF metadata D1 configuration missing');
const metrics={rowsRead:0,rowsWritten:0},report={status:'started',targeted:rows.length,verified:0,inserts:0,updates:0,unchanged:0,metrics};
async function query(sql){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});
 const body=await response.json();if(!response.ok||!body.success||!body.result?.every(r=>r.success))throw Error('ITF metadata D1 query failed HTTP '+response.status);
 for(const result of body.result){metrics.rowsRead+=Number(result.meta?.rows_read||0);metrics.rowsWritten+=Number(result.meta?.rows_written||0);}
 return body.result.flatMap(x=>x.results||[]);
}
const select=batch=>"SELECT id,circuit,source_tournament_id,start_date,end_date,payload FROM tournaments WHERE id IN ("+batch.map(x=>"'"+x.id+"'").join(',')+");";
try{
 for(let i=0;i<rows.length;i+=50){const batch=rows.slice(i,i+50),current=await query(select(batch)),plan=metadataPlan(batch,current);
  report.inserts+=plan.inserts.length;report.updates+=plan.updates.length;report.unchanged+=plan.unchanged.length;
  const statements=metadataSQL(plan);if(statements.length)await query(statements.join('\n'));
  report.verified+=verifyMetadata(batch,await query(select(batch)));
 }
 report.status='verified';
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1;}
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-metadata-d1.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_METADATA_D1='+JSON.stringify(report));
