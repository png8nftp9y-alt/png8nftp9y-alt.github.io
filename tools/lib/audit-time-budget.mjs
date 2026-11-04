export function auditTimeBudget({seconds=360,now=()=>Date.now(),fetcher=globalThis.fetch}={}){
 if(!Number.isInteger(seconds)||seconds<30||seconds>1200)throw Error('audit_invalid_time_budget');
 const start=now(),deadline=start+seconds*1000;
 const remaining=()=>Math.max(0,deadline-now());
 const check=()=>{if(!remaining())throw Error('audit_time_budget_exceeded');};
 return {seconds,remaining,expired:()=>!remaining(),check,
  fetch:async(url,options={})=>{check();const timeout=AbortSignal.timeout(Math.max(1,Math.floor(remaining()))),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;return fetcher(url,{...options,signal});}
 };
}
