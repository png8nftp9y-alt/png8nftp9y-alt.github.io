import test from 'node:test';
import assert from 'node:assert/strict';
import {observabilityTelemetryUsage,readObservabilityTelemetry,observabilityUsageRows} from '../lib/cloudflare-observability-usage.mjs';
const now=new Date('2026-10-17T12:00:00Z'),window={start:new Date('2026-10-15'),end:new Date('2026-11-15')};
const row=(bin,eventSize=1e9,service='app')=>({bin,dataset:'cloudflare-workers',service,eventSize,count:10});
const response=breakdown=>({success:true,status:200,result:{events:breakdown.reduce((s,r)=>s+r.count,0),breakdown}});
const options={now,window};
test('counts ingestion only within cycle and carries retained bytes from previous six days',()=>{
 const data=observabilityTelemetryUsage(response([row('2026-10-09 00:00:00'),row('2026-10-15 00:00:00'),row('2026-10-16 00:00:00'),row('2026-10-17 00:00:00')]),options);
 assert.equal(data.ingestion.total,3);assert.ok(Math.abs(data.storage.total-7/30)<1e-12);
 assert.equal(data.ingestion.projected,31);assert.equal(data.storageMethod,'dashboard_7_day_retention_estimate');
});
test('successful empty telemetry is zero, failed or incomplete telemetry never is',()=>{
 assert.equal(observabilityTelemetryUsage(response([]),options).storage.total,0);
 for(const result of [{events:0},{events:11,breakdown:[row('2026-10-15 00:00:00')]},{events:10,breakdown:[{...row('2026-10-15'),eventSize:null}]}])assert.equal(observabilityTelemetryUsage({success:true,result},options).ingestion,null);
 const data=observabilityTelemetryUsage({success:false,status:403},options);
 assert.equal(data.reason,'observability_read_required');assert.equal(data.storage,null);
});
test('rejects duplicate, negative and out-of-window bins; sums independent services',()=>{
 const a=row('2026-10-15 00:00:00');
 for(const rows of [[a,a],[{...a,eventSize:-1}],[row('2026-10-08 00:00:00')],[row('2026-10-18 00:00:00')]])assert.equal(observabilityTelemetryUsage(response(rows),options).ingestion,null);
 assert.equal(observabilityTelemetryUsage(response([a,{...a,service:'watchdog'}]),options).ingestion.total,2);
});
test('one read uses official API, main telemetry permission, UTC and six-day carry; no retries',async()=>{
 const calls=[];const data=await readObservabilityTelemetry(async path=>{calls.push(path);return response([])},options);
 assert.equal(data.status,'available');assert.equal(calls.length,1);
 const url=new URL('https://example.test'+calls[0]);assert.equal(url.pathname,'/workers/observability/usage');assert.equal(url.searchParams.get('from'),String(+new Date('2026-10-09')));assert.equal(url.searchParams.get('to'),String(+now));assert.equal(url.searchParams.get('tz'),'UTC');
 let count=0;const missing=await readObservabilityTelemetry(async()=>{count++;throw Error('network')},options);assert.equal(count,1);assert.equal(missing.ingestion,null);
});
test('Admin labels storage estimate and identifies permission required rather than Billing Read',()=>{
 const good=observabilityTelemetryUsage(response([row('2026-10-15 00:00:00')]),options);
 const html=observabilityUsageRows(good,(label)=>'<tr><td><b>'+label+'</b></td></tr>','2026-10-17');
 assert.match(html,/stima con conservazione di 7 giorni/);
 const bad=observabilityUsageRows(observabilityTelemetryUsage({success:false,status:403},options),()=>'', '2026-10-17');assert.match(bad,/Workers Observability Read/);
});
