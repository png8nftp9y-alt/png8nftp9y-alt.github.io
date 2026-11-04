// Transport failures leave a failed checkpoint; they never become missing history.
export async function auditOpponentAttempt({run,transportFailures,onTransportFailure}){
 const before=transportFailures();
 try{await run();return true;}catch(error){
  const direct=String(error.message)==='diagnostic_d1_request_failed:http_500:codes_7500';
  const api=String(error.message)==='audit_api_status_500:opponent-profile'&&transportFailures()>before;
  if(!direct&&!api)throw error;
  await onTransportFailure(error);return false;
 }
}
export function auditOpponentFailures(){
 let consecutive=0;
 return {run:async options=>{
  const completed=await auditOpponentAttempt(options);
  consecutive=completed?0:consecutive+1;
  if(consecutive>=3)throw Error('audit_transport_outage_three_consecutive_profiles');
  return completed;
 }};
}
