import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {storageUsageMetric} from '../lib/cloudflare-storage-usage.mjs';

const audit=readFileSync(new URL('../../../.github/scripts/cloudflare-full-cost-audit.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
test('D1 and R2 inventory remain below their thresholds at billing-cycle rollover',()=>{
 for(const [bytes,limit] of [[2491805696,5e9],[911664258,10e9]]){
  const m=storageUsageMetric(bytes,limit);
  assert.equal(m.total,bytes);assert.equal(m.projected,bytes);assert.equal(m.status,'green');
  assert.equal(m.projectedUtilization,bytes/limit);assert.equal(m.last24hBudget,null);assert.equal(m.dailyAverage,null);
 }
});
test('storage still warns near the threshold and turns red only above it',()=>{
 for(const [bytes,status] of [[0,'green'],[800,'green'],[801,'yellow'],[1000,'yellow'],[1001,'red']])assert.equal(storageUsageMetric(bytes,1000).status,status);
 assert.equal(storageUsageMetric(200,1000).status,'green');
});
function auditContext(){
 const ctx={storageUsageMetric,elapsedDays:1/24,cycleDays:31,remainingDays:30.99};
 vm.createContext(ctx);
 const start=audit.indexOf('const project ='),end=audit.indexOf('\n',start);
 vm.runInContext(audit.slice(start,end)+'\nglobalThis.projectCounter=project;',ctx);
 return ctx;
}
test('counter forecasts retain the existing elapsed-cycle formula and genuine red warnings',()=>{
 const ctx=auditContext();
 const reads=ctx.projectCounter(594215,25e9);assert.equal(reads.projected,442095960);assert.equal(reads.status,'green');
 const exceeded=ctx.projectCounter(100,1000);assert.equal(exceeded.status,'red');assert.equal(exceeded.projected,74400);
 assert.equal(exceeded.last24hBudget,900/30.99);
});
test('the real audit snapshot uses inventory levels for storage and forecasts for counters',()=>{
 const ctx=auditContext();
 Object.assign(ctx,{now:new Date('2026-10-15T00:13:07Z'),from:'2026-10-15',target:'2026-11-15',billingDay:15,
  subscriptionRows:[],safeList:x=>x||[],inventory:{d1StoredBytes:2491805696},d1:{success:true},d1Totals:{rowsRead:594215,rowsWritten:680},d1Groups:[],
  workers:{success:true},workerTotals:{requests:8,duration:1.09},workerGroups:[],r2Operations:{success:true},r2Structure:{success:true,bytes:911664258},r2Totals:{requests:308},r2Groups:[],
  daily:()=>[],subscriptions:{status:200},databases:{status:200},buckets:{status:200},kv:{status:200},queues:{status:200},scripts:{status:200}});
 const start=audit.indexOf('const snapshot='),end=audit.indexOf('const persisted=',start);
 vm.runInContext(audit.slice(start,end)+'\nglobalThis.result=snapshot;',ctx);
 assert.equal(ctx.result.d1.storage.projected,2491805696);assert.equal(ctx.result.r2.storage.projected,911664258);
 assert.equal(ctx.result.d1.storage.status,'green');assert.equal(ctx.result.r2.storage.status,'green');
 assert.equal(ctx.result.d1.rowsRead.projected,442095960);assert.equal(ctx.result.d1.rowsWritten.projected,505920);
 assert.equal(ctx.result.workers.requests.projected,5952);assert.equal(ctx.result.r2.operations.projected,229152);
});
function renderer(){
 const ctx={storageUsageMetric,esc:x=>String(x??''),tone:x=>x==='green'?'ok':x==='red'?'bad':'warn'};
 vm.createContext(ctx);
 const start=worker.indexOf('function compactNumber('),a=worker.indexOf('function usageMetricRow(',start),end=worker.indexOf('\n}',a)+2;
 vm.runInContext(worker.slice(start,end),ctx);return ctx.usageMetricRow;
}
test('admin corrects an old red storage snapshot without a new Cloudflare request',()=>{
 const row=renderer()('D1 storage',{total:2491805696,limit:5e9,projected:1853903437824,utilization:.498,projectedUtilization:370.78,status:'red',last24hBudget:80933286},null,' B','storage');
 assert.ok(row.includes('pill ok'));assert.ok(row.includes('50% occupato'));assert.ok(row.includes('Occupato: '));
 assert.ok(!row.includes('previsto'));assert.ok(!row.includes('pill bad'));assert.ok(row.includes('<td>—</td><td>—</td>'));
});
test('admin retains red storage overages and counter forecasts',()=>{
 const render=renderer();
 assert.ok(render('R2 storage',storageUsageMetric(11e9,10e9),null,' B','storage').includes('pill bad'));
 const ctx=auditContext(),metric=ctx.projectCounter(100,1000);
 const row=render('D1 letture',metric,100);assert.ok(row.includes('pill bad'));assert.ok(row.includes('7440% previsto'));assert.ok(!row.includes('occupato'));
});
