import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {observabilityUsage,observabilityUsageRows} from '../lib/cloudflare-observability-usage.mjs';
const now=new Date('2026-12-16T00:00:00Z');
const row=(kind,value,extra={})=>({ServiceName:kind==='ingestion'?'Observability Ingestion':'Observability Storage',ServiceFamilyName:'Observability',ConsumedQuantity:value,ConsumedUnit:kind==='ingestion'?'GB':'GB-months',PricingQuantity:0,CumulatedPricingQuantity:0,BillingPeriodStart:'2026-12-01T00:00:00Z',ChargePeriodStart:'2026-12-01T00:00:00Z',ChargePeriodEnd:'2026-12-16T00:00:00Z',...extra});
const get=(rows,options={now})=>observabilityUsage({success:true,status:200,result:rows},options);
test('uses consumed quantities including allowances, separates GB from GB-month and forecasts each against its own threshold',()=>{
 const o=get([row('ingestion',25),row('storage',8)]);assert.equal(o.status,'available');assert.equal(o.ingestion.total,25);assert.equal(o.storage.total,8);assert.equal(o.ingestion.limit,50);assert.equal(o.storage.limit,10);assert.equal(o.ingestion.projected,25/15*31);assert.equal(o.storage.projected,8/15*31);assert.equal(o.ingestion.status,'red');assert.equal(o.storage.status,'red');assert.deepEqual(o.cycle,{start:'2026-12-01',end:'2027-01-01'});
});
test('aggregates account-wide covered datasets but excludes D1, R2 data and legacy Log Explorer',()=>{
 const o=get([row('ingestion',1),row('ingestion',2,{ServiceName:'Workers Logs ingestion'}),row('storage',.5),row('ingestion',999,{ServiceFamilyName:'D1',ServiceName:'D1 storage'}),row('ingestion',999,{ServiceFamilyName:'R2',ServiceName:'R2 storage'}),row('ingestion',999,{ServiceFamilyName:'Observability',ServiceName:'Log Explorer legacy ingestion'})]);assert.equal(o.ingestion.total,3);assert.equal(o.storage.total,.5);assert.equal(o.ingestion.status,'green');assert.equal(o.storage.status,'green');
});
test('403, network errors, missing meters and legacy event counts are unavailable, never zero or green',()=>{
 for(const response of [{success:false,status:403},{success:false,status:null},{success:true,result:[]},{success:true,result:[row('ingestion',250,{ConsumedUnit:'events'})]}]){const o=observabilityUsage(response,{now});assert.equal(o.ingestion,null);assert.equal(o.storage,null);const html=observabilityUsageRows(o,()=>{throw Error('unavailable metric rendered as valid')},'2026-12-16');assert.match(html,/non disponibile/);assert.doesNotMatch(html,/pill ok/);}
 assert.equal(observabilityUsage({success:false,status:403},{now}).reason,'billing_read_required');
});
test('zero explicitly reported is valid; an absent storage meter stays unavailable',()=>{
 const o=get([row('ingestion',0)]);assert.equal(o.ingestion.total,0);assert.equal(o.ingestion.status,'green');assert.equal(o.storage,null);assert.equal(o.status,'partial');
});
test('does not mislabel current storage GB as ingestion, guess units, accept negative values or duplicate charge rows',()=>{
 for(const rows of [[row('storage',2,{ConsumedUnit:'GB'})],[row('ingestion',2,{ConsumedUnit:''})],[row('ingestion',-2)],[row('ingestion',2),row('ingestion',2)]]){const o=get(rows);assert.equal(o.ingestion,null);}
});
test('partial source freshness never extrapolates over the wrong elapsed period; old data warns and actual overages stay red',()=>{
 const rows=[row('ingestion',1,{ChargePeriodEnd:'2026-12-10T00:00:00Z'}),row('storage',11,{ChargePeriodEnd:'2026-12-10T00:00:00Z'})],o=get(rows);assert.equal(o.ingestion.projected,1/9*31);assert.equal(o.ingestion.stale,true);assert.equal(o.ingestion.status,'yellow');assert.equal(o.storage.status,'red');
});
test('billing period mismatches, stale cycles and invalid dates cannot produce a green meter',()=>{
 for(const rows of [[row('ingestion',1,{BillingPeriodStart:'bad'})],[row('ingestion',1),row('storage',1,{BillingPeriodStart:'2026-12-02T00:00:00Z'})],[row('ingestion',1,{BillingPeriodStart:'2026-11-01T00:00:00Z'})],[row('ingestion',1,{ChargePeriodEnd:'2027-02-01T00:00:00Z'})]])assert.equal(get(rows).ingestion,null);
});
test('daily values exist only for daily source rows, and storage GB-month never uses the inventory-level renderer',()=>{
 const o=get([row('ingestion',2,{ChargePeriodStart:'2026-12-15T00:00:00Z'}),row('storage',.2,{ChargePeriodStart:'2026-12-15T00:00:00Z'})]);const calls=[];
 const html=observabilityUsageRows(o,(...args)=>{calls.push(args);return '<tr><td><b>'+args[0]+'</b></td></tr>';},'2026-12-15');assert.equal(calls[0][2],2);assert.equal(calls[1][2],.2);assert.equal(calls[1][3],' GB-mese');assert.equal(calls[1][4],undefined);assert.match(html,/Ciclo 2026-12-01/);assert.match(html,/dati al/);
});
test('audit reads one bounded billing response with existing or dedicated read token and does not make Admin query Cloudflare',()=>{
 const audit=readFileSync(new URL('../../../.github/scripts/cloudflare-full-cost-audit.mjs',import.meta.url),'utf8'),worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8'),workflow=readFileSync(new URL('../../../.github/workflows/courtwatch-cloudflare-full-cost-audit.yml',import.meta.url),'utf8');
 assert.equal((audit.match(/api\('\/billable-usage'/g)||[]).length,1);assert.match(audit,/observabilityUsage\(observabilityBilling,\{now\}\)/);assert.match(audit,/const snapshot=\{observability,/);assert.match(audit,/CLOUDFLARE_BILLING_READ_TOKEN/);assert.match(workflow,/cloudflare-observability-usage.test.mjs/);assert.match(worker,/observabilityUsageRows\(cloudflareUsage.observability/);assert.doesNotMatch(worker,/\/billable-usage/);
});

test('actual authenticated Cloudflare page displays both independent meters from one R2 read with zero D1/HTTP calls',async()=>{
 const {default:worker}=await import('../src/index.js');let reads=0;
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Admin made external request')};
 const snapshot={cycle:{start:'2026-12-01',end:'2027-01-01'},generatedAt:now.toISOString(),observability:get([row('ingestion',1),row('storage',9)])};
 const env={ADMIN_TOKEN:'test',DB:{prepare(){throw Error('Admin queried D1')}},ARCHIVE:{async get(key){assert.equal(key,'monitoring/cloudflare-usage/current.json');reads++;return {json:async()=>snapshot};}}};
 try{
  const response=await worker.fetch(new Request('https://example.test/admin/cloudflare',{headers:{Authorization:'Basic '+btoa('admin:test')}}),env);
  assert.equal(response.status,200);const html=await response.text();assert.equal(reads,1);
  assert.match(html,/Observability · acquisizione log e tracce/);assert.match(html,/Observability · conservazione log e tracce/);assert.match(html,/10 GB-mese/);assert.match(html,/pill bad/);assert.match(html,/pill ok/);assert.match(html,/dati al/);
 }finally{globalThis.fetch=previous;}
});
