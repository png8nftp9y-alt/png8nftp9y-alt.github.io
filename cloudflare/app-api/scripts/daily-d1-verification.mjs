// D1_WRITE_POLICY: incremental; only the daily certificate can change.
// buildIncrementalSyncPlan is unnecessary: source tables are read-only here.
import {setTimeout as delay} from 'node:timers/promises';
import {fullVerificationSql,readVerificationCounts,verificationMetricNames} from '../lib/d1-verification-counts.mjs';
import {readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import {cliD1Query} from '../lib/d1-cli-query.mjs';
async function dailyQuery(sql){
 if(sql!==fullVerificationSql)return cliD1Query(sql);
 const lines=sql.replace(/^SELECT /,'').split('\n');
 const parts=lines.map(line=>line.match(/^\((SELECT .*)\) AS (\w+),?$/));
 if(parts.length!==verificationMetricNames.length||
    parts.some((part,i)=>!part||part[2]!==verificationMetricNames[i])){
  throw Error('Unexpected D1 verification SQL shape');
 }
 const actual={};
 for(const [,select,metric] of parts){
  const read=()=>cliD1Query(`SELECT (${select}) AS ${metric}`);
  try{
   let rows;
   try{rows=await read();}
   catch(error){
    if(!/\b7429\b/.test(String(error?.message)))throw error;
    console.log(`D1 daily count ${metric}: retry after resource limit 7429`);
    await delay(11000);
    rows=await read();
   }
   if(rows.length!==1||!Number.isSafeInteger(rows[0][metric])||rows[0][metric]<0){
    throw Error('invalid count response');
   }
   actual[metric]=rows[0][metric];
  }catch(error){
   throw Error(`D1 daily count ${metric}: ${error.message}`,{cause:error});
  }
 }
 return [actual];
}
const result=await readVerificationCounts(dailyQuery,{version:await readCheckVersion(new URL('../lib/d1-verification-counts.mjs',import.meta.url))});
console.log(JSON.stringify({check:'D1_DAILY_COMPLETE_COUNTS',mode:result.mode,counts:result.value}));
