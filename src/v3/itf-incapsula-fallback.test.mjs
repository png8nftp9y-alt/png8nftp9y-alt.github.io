import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ITF_ACQUISITION_URL='https://acquirer.invalid/v1/fetch';
process.env.ITF_ACQUIRER_TOKEN='test-token';
process.env.ITF_REQUEST_DELAY_MS='0';
const {drawsheet}=await import('./itf-common.mjs');

test('Incapsula fallback covers qualifying, knockout and round robin draws',async()=>{
 const originalFetch=globalThis.fetch;
 const acquired=[];
 globalThis.fetch=async(url,init={})=>{
  if(String(url).startsWith('https://acquirer.invalid/')){
   const request=JSON.parse(String(init.body||'{}'));
   acquired.push(request.url);
   return new Response(JSON.stringify({ok:true,json:{source:'authorized-acquirer'}}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response('<html>Incapsula Additional security check is required</html>',{status:403,headers:{'content-type':'text/html'}});
 };
 try{
  for(const event of[
   {eventClassificationCode:'Q',drawsheetStructureCode:'KO'},
   {eventClassificationCode:'M',drawsheetStructureCode:'KO'},
   {eventClassificationCode:'M',drawsheetStructureCode:'RR'},
  ]){
   const result=await drawsheet({tournamentId:1,tourType:'N',weekNumber:0,playerTypeCode:'B',matchTypeCode:'S',...event});
   assert.equal(result.source,'authorized-acquirer');
  }
 }finally{globalThis.fetch=originalFetch}
 assert.equal(acquired.length,3);
 assert.match(acquired[0],/eventClassificationCode=Q/);
 assert.match(acquired[0],/drawsheetStructureCode=KO/);
 assert.match(acquired[1],/eventClassificationCode=M/);
 assert.match(acquired[1],/drawsheetStructureCode=KO/);
 assert.match(acquired[2],/drawsheetStructureCode=RR/);
});
