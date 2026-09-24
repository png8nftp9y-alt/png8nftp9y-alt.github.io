import { spawnSync } from 'node:child_process';

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error('Missing Cloudflare audit credentials');

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const now = new Date();
const from = process.env.CLOUDFLARE_AUDIT_FROM || '2026-09-15';
const to = now.toISOString().slice(0, 10);
const target = '2026-10-15';

async function rest(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { headers });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, success: Boolean(body.success), result: body.result ?? null, errors: body.errors ?? [] };
}
async function graphql(name, query) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers, body: JSON.stringify({ query, variables: { accountTag: account, from, to } }) });
  const body = await response.json().catch(() => ({}));
  return { name, status: response.status, success: response.ok && !body.errors?.length, data: body.data ?? null, errors: body.errors ?? [] };
}
const d1 = await graphql('d1', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date databaseId}sum{rowsRead rowsWritten}}}}}`);
const workers = await graphql('workers', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptive(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date scriptName status}sum{requests errors subrequests duration}}}}}`);
const r2Operations = await graphql('r2_operations', `query($accountTag:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$accountTag}){r2OperationsAdaptiveGroups(limit:10000,filter:{date_geq:$from,date_leq:$to}){dimensions{date bucketName actionType}sum{requests responseBytes}}}}}`);
const [subscriptions, databases, buckets, kv, queues, scripts] = await Promise.all([
  rest('/subscriptions'), rest('/d1/database?per_page=100'), rest('/r2/buckets'),
  rest('/storage/kv/namespaces?per_page=100'), rest('/queues?per_page=100'), rest('/workers/scripts')
]);
const safeList = value => Array.isArray(value) ? value : [];
const sumGroups = (groups, fields) => { const out = Object.fromEntries(fields.map(field => [field, 0])); for (const group of groups || []) for (const field of fields) out[field] += Number(group.sum?.[field] || 0); return out; };
const accountData = result => result.data?.viewer?.accounts?.[0] || {};
const d1Totals = sumGroups(accountData(d1).d1AnalyticsAdaptiveGroups, ['rowsRead', 'rowsWritten']);
const workerTotals = sumGroups(accountData(workers).workersInvocationsAdaptive, ['requests', 'errors', 'subrequests', 'duration']);
const r2Totals = sumGroups(accountData(r2Operations).r2OperationsAdaptiveGroups, ['requests', 'responseBytes']);
const subscriptionRows = safeList(subscriptions.result);
const subscriptionSummary = {
  active: subscriptionRows.filter(row => row.status === 'Active' || row.status === 'active').length,
  listed: subscriptionRows.length,
  recurringPrice: Number(subscriptionRows.reduce((sum, row) => sum + Number(row.price || 0), 0).toFixed(2)),
  currencies: [...new Set(subscriptionRows.map(row => row.rate_plan?.currency).filter(Boolean))]
};
const inventory = {
  d1Databases: safeList(databases.result).length,
  d1StoredBytes: safeList(databases.result).reduce((sum, row) => sum + Number(row.file_size || 0), 0),
  r2Buckets: safeList(buckets.result?.buckets ?? buckets.result).length,
  kvNamespaces: safeList(kv.result).length,
  queues: safeList(queues.result).length,
  workerScripts: safeList(scripts.result).length
};

function auditR2Structure() {
  const bucket = process.env.R2_BUCKET;
  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  if (!bucket || !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) return { success:false, reason:'missing_r2_credentials' };
  const env = { ...process.env, AWS_ACCESS_KEY_ID:process.env.R2_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY:process.env.R2_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION:'auto' };
  const aws = args => spawnSync('aws', ['--endpoint-url', endpoint, ...args], { encoding:'utf8', env, maxBuffer:64*1024*1024 });
  const listed = aws(['s3api','list-objects-v2','--bucket',bucket,'--output','json']);
  if (listed.status !== 0) return { success:false, reason:'list_failed', status:listed.status };
  const objects = JSON.parse(listed.stdout || '{}').Contents || [];
  const referenced = new Map();
  for (const item of objects) {
    const match = String(item.Key || '').match(/^([^/]+\/[^/]+)\/pointers\/(?:current|backup-1|backup-2)\.json$/);
    if (!match) continue;
    const read = aws(['s3','cp',`s3://${bucket}/${item.Key}`,'-','--only-show-errors']);
    if (read.status !== 0) continue;
    try { const generation=JSON.parse(read.stdout).generation;if(generation){let keep=referenced.get(match[1]);if(!keep){keep=new Set();referenced.set(match[1],keep)}keep.add(generation)} } catch {}
  }
  const prefixes = new Map(), duplicateGroups = new Map();
  for (const item of objects) {
    const key=String(item.Key||''), parts=key.split('/'), prefix=parts.slice(0,2).join('/')||'(root)', size=Number(item.Size||0);
    const row=prefixes.get(prefix)||{objects:0,bytes:0,generations:new Map(),nonGenerationBytes:0};row.objects++;row.bytes+=size;
    const generationMatch=key.match(/^[^/]+\/[^/]+\/generations\/([^/]+)\//);
    if(generationMatch)row.generations.set(generationMatch[1],(row.generations.get(generationMatch[1])||0)+size);else row.nonGenerationBytes+=size;
    prefixes.set(prefix,row);
    const etag=String(item.ETag||'').replaceAll('"','');if(etag) { const duplicateKey=`${size}:${etag}`;const dup=duplicateGroups.get(duplicateKey)||{count:0,size};dup.count++;duplicateGroups.set(duplicateKey,dup); }
  }
  const result={};
  for(const [prefix,row] of prefixes){const keep=referenced.get(prefix)||new Set(),unreferenced=[...row.generations].filter(([generation])=>!keep.has(generation));result[prefix]={objects:row.objects,bytes:row.bytes,generations:row.generations.size,referencedGenerations:keep.size,unreferencedGenerations:unreferenced.length,unreferencedGenerationBytes:unreferenced.reduce((sum,[,bytes])=>sum+bytes,0),nonGenerationBytes:row.nonGenerationBytes};}
  const duplicateBytes=[...duplicateGroups.values()].reduce((sum,row)=>sum+(row.count>1?(row.count-1)*row.size:0),0);
  return {success:true,objects:objects.length,bytes:objects.reduce((sum,row)=>sum+Number(row.Size||0),0),duplicateBytes,prefixes:result,note:'Unreferenced generations are candidates for review, not automatic deletion.'};
}

const r2Structure = auditR2Structure();
console.log('CLOUDFLARE_AUDIT_WINDOW='+JSON.stringify({ from, to, target, generatedAt: now.toISOString() }));
console.log('CLOUDFLARE_SUBSCRIPTIONS='+JSON.stringify({ success:subscriptions.success,status:subscriptions.status,result:subscriptionSummary,errors:subscriptions.errors }));
console.log('CLOUDFLARE_INVENTORY='+JSON.stringify(inventory));
console.log('CLOUDFLARE_D1_ANALYTICS='+JSON.stringify({success:d1.success,status:d1.status,totals:d1Totals,errors:d1.errors}));
console.log('CLOUDFLARE_WORKERS_ANALYTICS='+JSON.stringify({success:workers.success,status:workers.status,totals:workerTotals,errors:workers.errors}));
console.log('CLOUDFLARE_R2_OPERATIONS='+JSON.stringify({success:r2Operations.success,status:r2Operations.status,totals:r2Totals,errors:r2Operations.errors}));
console.log('CLOUDFLARE_R2_STRUCTURE='+JSON.stringify(r2Structure));
console.log('CLOUDFLARE_ENDPOINT_STATUS='+JSON.stringify({ subscriptions: subscriptions.status, databases: databases.status, buckets: buckets.status, kv: kv.status, queues: queues.status, scripts: scripts.status }));
if (!d1.success) process.exitCode = 2;
