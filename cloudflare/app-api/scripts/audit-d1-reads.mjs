import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Cloudflare credentials missing');
const report={generatedAt:new Date().toISOString(),mode:'read-only',dailyTimezone:'UTC',daily:[],insights:{},errors:[]};
const headers={Authorization:'Bearer '+token,'content-type':'application/json'};
async function call(url,body){
 const response=await fetch(url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(!response.ok||data.success===false||data.errors?.length)throw Error('Cloudflare audit denied or failed: HTTP '+response.status+' '+(data.errors||[]).map(e=>e.message||e.code).join('; ').slice(0,400));
 return data;
}
try{
 const databases=await call('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database?name=courtwatch-app&per_page=100');
 const db=databases.result?.find(d=>d.name==='courtwatch-app');if(!db)throw Error('Existing courtwatch-app not found; nothing created');
 const databaseId=db.uuid||db.id;
 await fs.writeFile('wrangler.audit.json',JSON.stringify({name:'courtwatch-audit',compatibility_date:'2026-10-13',d1_databases:[{binding:'DB',database_name:'courtwatch-app',database_id:databaseId}]}));
 const end=new Date().toISOString().slice(0,10),start=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
 try{
 const daily=await call('https://api.cloudflare.com/client/v4/graphql',{query:'query($accountTag:string!,$start:Date,$end:Date,$databaseId:string){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:100,filter:{date_geq:$start,date_leq:$end,databaseId:$databaseId},orderBy:[date_ASC]){dimensions{date} sum{rowsRead rowsWritten readQueries writeQueries}}}}}',variables:{accountTag:account,start,end,databaseId}});
 report.daily=daily.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups||[];
 }catch(e){report.errors.push({phase:'daily_analytics',reason:e.message});}
 for(const period of ['1d','7d']){
 const result=spawnSync('npx',['wrangler','d1','insights','courtwatch-app','--config','wrangler.audit.json','--timePeriod='+period,'--sort-type=sum','--sort-by=reads','--sort-direction=DESC','--limit=50','--json'],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:90000});
 if(result.status!==0){report.errors.push({phase:'query_insights_'+period,reason:'Insights unavailable: existing token may lack Account Analytics Read; inspect daily error. No credentials or raw response logged.'});continue;}
 try{
 const rows=JSON.parse(result.stdout);
 report.insights[period]=(Array.isArray(rows)?rows:rows?.result||[]).map(row=>{
 const query=String(row.query||''),normalized=query.replace(/'(?:''|[^'])*'/g,"?").replace(/\b\d+(?:\.\d+)?\b/g,"?").replace(/\s+/g,' ').slice(0,1200);
 return {queryHash:crypto.createHash('sha256').update(query).digest('hex').slice(0,16),normalizedQuery:normalized,totalRowsRead:row.totalRowsRead,totalRowsWritten:row.totalRowsWritten,numberOfTimesRun:row.numberOfTimesRun,avgRowsRead:row.avgRowsRead,avgDurationMs:row.avgDurationMs};
 });
 }catch{report.errors.push({phase:'parse_insights_'+period,reason:'Unexpected Wrangler output; raw query text not logged'});}
 }
}catch(e){report.errors.push({phase:'database_lookup',reason:e.message});}
report.status=report.errors.length?'partial_or_blocked':'complete';
await fs.mkdir('audit-output',{recursive:true});await fs.writeFile('audit-output/d1-read-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,daily:report.daily,insightQueries:Object.fromEntries(Object.entries(report.insights).map(([k,v])=>[k,v.length])),errors:report.errors}));
if(!report.daily.length&&!Object.keys(report.insights).length)process.exitCode=1;
