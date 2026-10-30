// Official account-wide usage: /accounts/{account_id}/billable-usage.
// ConsumedQuantity includes actual usage; PricingQuantity may contain only paid overage.
const EFFECTIVE='2026-12-01';
const finite=value=>value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
const iso=value=>{const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null;};
export function observabilityService(row){
 const name=[row.ServiceFamilyName,row.ServiceName,row.ChargeDescription].filter(Boolean).join(' ');
 if(/log\s*explorer|legacy/i.test(name))return false;
 return /observability|workers?\s+(?:logs?|traces?)|cloudflare\s+traces?|containers?\s+logs?|r2\s+data\s+access\s+logs?|ai\s+gateway\s+logs?/i.test(name);
}
function meterUnit(row){
 const unit=String(row.ConsumedUnit||'').toLowerCase().replace(/[\s_-]/g,'');
 if(['gb','gigabyte','gigabytes'].includes(unit))return /stor|retention|retain/i.test(row.ServiceName+' '+(row.ChargeDescription||''))?null:['ingestion',1];
 if(['byte','bytes'].includes(unit))return ['ingestion',1e-9];
 if(['gbmonth','gbmonths','gb/month','gigabytemonth','gigabytemonths'].includes(unit))return ['storage',1];
 if(['bytemonth','bytemonths'].includes(unit))return ['storage',1e-9];
 return null;
}
export function observabilityUsage(response,{now=new Date()}={}){
 const checkedAt=now.toISOString(),base={checkedAt,effectiveFrom:EFFECTIVE,scope:'account',source:'cloudflare_billable_usage',updateFrequency:'daily',ingestion:null,storage:null};
 if(!response?.success||!Array.isArray(response.result))return {...base,status:'unavailable',reason:[401,403].includes(response?.status)?'billing_read_required':'billing_api_unavailable',httpStatus:response?.status??null};
 const rows=response.result.filter(observabilityService);
 if(!rows.length)return {...base,status:'unavailable',reason:'volume_meters_not_reported'};
 const starts=[...new Set(rows.map(row=>iso(row.BillingPeriodStart)))];
 if(starts.length!==1||!starts[0]||Date.parse(starts[0])>+now)return {...base,status:'unavailable',reason:'billing_period_unverified'};
 const start=new Date(starts[0]),end=new Date(start);const day=start.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));
 if(+now>=+end)return {...base,status:'unavailable',reason:'billing_period_unverified'};
 const cycle={start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
 const result={...base,cycle,status:'available',reason:null,daily:[],services:[...new Set(rows.map(r=>String(r.ServiceName||'Observability')))].sort()};
 const groups={ingestion:[],storage:[]},invalid=new Set(),seen=new Set();
 for(const row of rows){
  const unit=meterUnit(row);
  if(!unit){invalid.add('ingestion');invalid.add('storage');continue;}
  const [kind,factor]=unit,from=iso(row.ChargePeriodStart),to=iso(row.ChargePeriodEnd);
  if(!finite(row.ConsumedQuantity)||!from||!to||from<start.toISOString()||Date.parse(to)<=Date.parse(from)||Date.parse(from)>+now||Date.parse(to)>+end){invalid.add(kind);continue;}
  const key=JSON.stringify([row.ServiceName,row.ChargeDescription,row.SubscriptionId,row.ZoneId,from,to,row.ConsumedUnit]);
  if(seen.has(key)){invalid.add(kind);continue;}seen.add(key);
  groups[kind].push({value:Number(row.ConsumedQuantity)*factor,from,to});
 }
 const days=new Map();
 for(const [kind,limit] of [['ingestion',50],['storage',10]]){
  const entries=groups[kind];
  if(invalid.has(kind)||!entries.length){result[kind+'Reason']=invalid.has(kind)?'unsupported_or_incomplete_meter':'volume_meter_not_reported';continue;}
  const total=entries.reduce((n,r)=>n+r.value,0),asOf=new Date(Math.min(+now,Math.max(...entries.map(r=>Date.parse(r.to))))),elapsed=(+asOf-+start)/864e5,cycleDays=(+end-+start)/864e5;
  if(elapsed<=0){result[kind+'Reason']='billing_period_unverified';continue;}
  const projected=total/elapsed*cycleDays,remaining=(+end-+asOf)/864e5,stale=+now-+asOf>72*36e5;
  result[kind]={kind:'counter',unit:kind==='ingestion'?'GB':'GB-mese',total,limit,projected,utilization:total/limit,projectedUtilization:projected/limit,last24hBudget:Math.max(0,limit-total)/Math.max(1,remaining),dailyAverage:total/elapsed,status:total>limit?'red':stale?'yellow':projected<=limit*.8?'green':projected<=limit?'yellow':'red',asOf:asOf.toISOString(),stale};
  for(const item of entries){const a=new Date(item.from),b=new Date(item.to);if(+b-+a<=864e5&&a.toISOString().slice(0,10)===new Date(+b-1).toISOString().slice(0,10)){const date=item.from.slice(0,10);if(!days.has(date))days.set(date,{date});const row=days.get(date);row[kind]=(row[kind]||0)+item.value;}}
 }
 result.daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!result.ingestion||!result.storage){result.status='partial';result.reason='volume_meters_incomplete';}
 return result;
}
const reasons={billing_read_required:'Il token del monitoraggio richiede il permesso Billing Read.',billing_api_unavailable:'API consumi Cloudflare non disponibile.',volume_meters_not_reported:'Cloudflare non ha ancora restituito i contatori di volume Observability.',billing_period_unverified:'Periodo di fatturazione non verificabile.',unsupported_or_incomplete_meter:'Contatore non utilizzabile: unità non in GB/GB-mese, dati incompleti o duplicati.',volume_meter_not_reported:'Contatore di volume non ancora restituito da Cloudflare.'};
export function observabilityUsageRows(data,render,today,escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))){
 const cycle=data?.cycle?`${data.cycle.start} → ${data.cycle.end}`:'periodo non disponibile';
 return [['ingestion','Observability · acquisizione log e tracce',' GB'],['storage','Observability · conservazione log e tracce',' GB-mese']].map(([kind,label,unit])=>{
  const metric=data?.[kind];
  if(!metric)return `<tr><td><b>${label}</b></td><td colspan="4">${escape(reasons[data?.[kind+'Reason']||data?.reason]||'In attesa del prossimo audit Cloudflare.')}</td><td><span class="pill warn">non disponibile</span></td></tr>`;
  const detail=`<small>Ciclo ${escape(cycle)} · dati al ${escape(metric.asOf||'—')}${metric.stale?' · dati non recenti':''}</small>`;
  const value=data.daily?.find(row=>row.date===today)?.[kind]??null;
  return render(label,metric,value,unit).replace('</b></td>','</b><br>'+detail+'</td>');
 }).join('');
}
