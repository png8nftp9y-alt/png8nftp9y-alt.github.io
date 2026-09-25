import { spawnSync } from 'node:child_process';

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error('Missing Cloudflare audit credentials');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const now = new Date();
const billingDay = Math.min(28, Math.max(1, Number(process.env.CLOUDFLARE_BILLING_DAY || 15)));
const isoDate = value => value.toISOString().slice(0, 10);
function billingWindow(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), billingDay));
  if (date < start) start.setUTCMonth(start.getUTCMonth() - 1);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
const cycle = billingWindow(now), from = isoDate(cycle.start), to = isoDate(now), target = isoDate(cycle.end);
const elapsedDays = Math.max(1 / 24, (now - cycle.start) / 86400000);
const cycleDays = (cycle.end - cycle.start) / 86400000;
const remainingDays = Math.max(0, (cycle.end - now) / 86400000);

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, success: Boolean(payload.success), result: payload.result ?? null, errors: payload.errors ?? [] };
}
async function graphql(name, query) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers, body: JSON.stringify({ query, variables: { accountTag: account, from, to } }) });
  const body = await response.json().catch(() => ({}));
  return { name, status: response.status, success: response.ok && !body.errors?.length, data: body.data ?? null, errors: body.errors ?? [] };
}
const d1 = await graphql('d1', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date databaseId}sum{rowsRead rowsWritten}}}}}`);
const workers = await graphql('workers', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptive(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date scriptName status}sum{requests errors subrequests duration}}}}}`);
const r2Operations = await graphql('r2_operations', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){r2OperationsAdaptiveGroups(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date bucketName actionType}sum{requests responseBytes}}}}}`);
const [subscriptions, databases, buckets, kv, queues, scripts] = await Promise.all([api('/subscriptions'),api('/d1/database?per_page=100'),api('/r2/buckets'),api('/storage/kv/namespaces?per_page=100'),api('/queues?per_page=100'),api('/workers/scripts')]);
const safeList = value => Array.isArray(value) ? value : [];
const accountData = result => result.data?.viewer?.accounts?.[0] || {};
const sumGroups = (groups, fields) => { const out=Object.fromEntries(fields.map(field=>[field,0]));for(const group of groups||[])for(const field of fields)out[field]+=Number(group.sum?.[field]||0);return out };
const daily = (groups, fields) => Object.entries((groups||[]).reduce((out,group)=>{const date=group.dimensions?.date||'unknown';out[date]||=Object.fromEntries(fields.map(field=>[field,0]));for(const field of fields)out[date][field]+=Number(group.sum?.[field]||0);return out},{})).map(([date,totals])=>({date,...totals})).sort((a,b)=>a.date.localeCompare(b.date));
const project = (value,limit) => {const total=Number(value||0),projected=elapsedDays?total/elapsedDays*cycleDays:total;return{total,last24hBudget:Math.max(0,limit-total)/Math.max(1,remainingDays),dailyAverage:total/elapsedDays,projected:Math.round(projected),limit,utilization:total/limit,projectedUtilization:projected/limit,status:projected<=limit*.8?'green':projected<=limit?'yellow':'red'}};
const d1Groups=accountData(d1).d1AnalyticsAdaptiveGroups||[],workerGroups=accountData(workers).workersInvocationsAdaptive||[],r2Groups=accountData(r2Operations).r2OperationsAdaptiveGroups||[];
const d1Totals=sumGroups(d1Groups,['rowsRead','rowsWritten']),workerTotals=sumGroups(workerGroups,['requests','errors','subrequests','duration']),r2Totals=sumGroups(r2Groups,['requests','responseBytes']);
const inventory={d1Databases:safeList(databases.result).length,d1StoredBytes:safeList(databases.result).reduce((sum,row)=>sum+Number(row.file_size||0),0),r2Buckets:safeList(buckets.result?.buckets??buckets.result).length,kvNamespaces:safeList(kv.result).length,queues:safeList(queues.result).length,workerScripts:safeList(scripts.result).length};

function auditR2Structure(){
  const bucket=process.env.R2_BUCKET,endpoint=`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  if(!bucket||!process.env.R2_ACCOUNT_ID||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY)return{success:false,reason:'missing_r2_credentials'};
  const env={...process.env,AWS_ACCESS_KEY_ID:process.env.R2_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY:process.env.R2_SECRET_ACCESS_KEY,AWS_DEFAULT_REGION:'auto'},aws=args=>spawnSync('aws',['--endpoint-url',endpoint,...args],{encoding:'utf8',env,maxBuffer:64*1024*1024});
  const listed=aws(['s3api','list-objects-v2','--bucket',bucket,'--output','json']);if(listed.status!==0)return{success:false,reason:'list_failed',status:listed.status};
  const objects=JSON.parse(listed.stdout||'{}').Contents||[],referenced=new Map(),prefixes=new Map(),duplicates=new Map();
  for(const item of objects){const match=String(item.Key||'').match(/^([^/]+\/[^/]+)\/pointers\/(?:current|backup-1|backup-2)\.json$/);if(!match)continue;const read=aws(['s3','cp',`s3://${bucket}/${item.Key}`,'-','--only-show-errors']);if(read.status!==0)continue;try{const generation=JSON.parse(read.stdout).generation;if(generation){let keep=referenced.get(match[1]);if(!keep){keep=new Set();referenced.set(match[1],keep)}keep.add(generation)}}catch{}}
  for(const item of objects){const key=String(item.Key||''),prefix=key.split('/').slice(0,2).join('/')||'(root)',size=Number(item.Size||0),row=prefixes.get(prefix)||{objects:0,bytes:0,generations:new Map(),nonGenerationBytes:0};row.objects++;row.bytes+=size;const generation=key.match(/^[^/]+\/[^/]+\/generations\/([^/]+)\//);if(generation)row.generations.set(generation[1],(row.generations.get(generation[1])||0)+size);else row.nonGenerationBytes+=size;prefixes.set(prefix,row);const etag=String(item.ETag||'').replaceAll('"','');if(etag){const id=`${size}:${etag}`,dup=duplicates.get(id)||{count:0,size};dup.count++;duplicates.set(id,dup)}}
  const result={};for(const[prefix,row]of prefixes){const keep=referenced.get(prefix)||new Set(),unused=[...row.generations].filter(([generation])=>!keep.has(generation));result[prefix]={objects:row.objects,bytes:row.bytes,generations:row.generations.size,referencedGenerations:keep.size,unreferencedGenerations:unused.length,unreferencedGenerationBytes:unused.reduce((sum,[,bytes])=>sum+bytes,0),nonGenerationBytes:row.nonGenerationBytes}}
  return{success:true,objects:objects.length,bytes:objects.reduce((sum,row)=>sum+Number(row.Size||0),0),duplicateBytes:[...duplicates.values()].reduce((sum,row)=>sum+(row.count>1?(row.count-1)*row.size:0),0),prefixes:result};
}
function persistR2Snapshot(snapshot){
  const bucket=process.env.R2_BUCKET,accountId=process.env.R2_ACCOUNT_ID;
  if(!bucket||!accountId||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY)return{success:false,reason:'missing_r2_credentials'};
  const env={...process.env,AWS_ACCESS_KEY_ID:process.env.R2_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY:process.env.R2_SECRET_ACCESS_KEY,AWS_DEFAULT_REGION:'auto'};
  const result=spawnSync('aws',['--endpoint-url',`https://${accountId}.r2.cloudflarestorage.com`,'s3','cp','-',`s3://${bucket}/monitoring/cloudflare-usage/current.json`,'--content-type','application/json','--only-show-errors'],{encoding:'utf8',env,input:JSON.stringify(snapshot),maxBuffer:4*1024*1024});
  return{success:result.status===0,status:result.status,reason:result.status===0?null:'r2_upload_failed',stderr:String(result.stderr||'').slice(0,500)};
}
const r2Structure=auditR2Structure(),subscriptionRows=safeList(subscriptions.result);
const snapshot={schemaVersion:1,generatedAt:now.toISOString(),cycle:{start:from,end:target,billingDay,elapsedDays,remainingDays},subscriptions:{active:subscriptionRows.filter(row=>String(row.status).toLowerCase()==='active').length,listed:subscriptionRows.length,recurringPrice:Number(subscriptionRows.reduce((sum,row)=>sum+Number(row.price||0),0).toFixed(2)),currencies:[...new Set(subscriptionRows.map(row=>row.rate_plan?.currency).filter(Boolean))]},d1:{success:d1.success,totals:d1Totals,daily:daily(d1Groups,['rowsRead','rowsWritten']),storedBytes:inventory.d1StoredBytes,rowsRead:project(d1Totals.rowsRead,25_000_000_000),rowsWritten:project(d1Totals.rowsWritten,50_000_000),storage:project(inventory.d1StoredBytes,5_000_000_000)},workers:{success:workers.success,totals:workerTotals,daily:daily(workerGroups,['requests','errors','subrequests','duration']),requests:project(workerTotals.requests,10_000_000),cpu:project(workerTotals.duration,30_000_000)},r2:{success:r2Operations.success&&r2Structure.success,totals:r2Totals,daily:daily(r2Groups,['requests','responseBytes']),structure:r2Structure,operations:project(r2Totals.requests,1_000_000),storage:project(r2Structure.bytes||0,10_000_000_000),note:'Operations use the conservative Class A allowance; Class B has a higher allowance.'},inventory,endpoints:{subscriptions:subscriptions.status,databases:databases.status,buckets:buckets.status,kv:kv.status,queues:queues.status,scripts:scripts.status}};
const persisted=persistR2Snapshot(snapshot);
console.log('CLOUDFLARE_USAGE_SNAPSHOT='+JSON.stringify(snapshot));
console.log('CLOUDFLARE_USAGE_PERSISTED='+JSON.stringify({...persisted,key:'monitoring/cloudflare-usage/current.json'}));
if(!d1.success||!workers.success||!r2Operations.success||!persisted.success)process.exitCode=2;
