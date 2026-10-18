import {FRONTEND_DOCUMENTS} from './runtime-document-reader.mjs';

// Run with a read-only DB adapter: authentication and the real Worker routes
// must work without device registration, mutations or external data services.
export async function verifyRuntimeAppReaders(worker,db,email){
 const documentRoutes={},snapshots={};
 async function read(path,group='main'){
  const response=await worker.fetch(new Request('https://runtime-check.invalid/app/api/'+path,{headers:{'Cf-Access-Authenticated-User-Email':email,'X-CourtWatch-Group':group}}),{DB:db},{});
  if(response.status!==200)throw Error('runtime_app_route_failed:'+path+':'+group+':'+response.status);
  const payload=await response.json();
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('runtime_app_payload_invalid:'+path);
  return payload;
 }
 for(const name of FRONTEND_DOCUMENTS){
  const payload=await read('documents/'+name);
  if(name==='players.json'&&(!Array.isArray(payload.players)||!payload.players.length))throw Error('runtime_document_route_empty');
  documentRoutes[name]=200;
 }
 for(const group of ['main','others']){
  const payload=await read('app-snapshot',group);
  if(payload.group!==group||['players','tournaments','matches'].some(key=>!Array.isArray(payload[key])))throw Error('runtime_snapshot_invalid:'+group);
  const sample=payload.players.find(player=>typeof player.id==='string'&&player.id);
  if(sample){
   const scoped=await read('app-snapshot?playerId='+encodeURIComponent(sample.id),group);
   if(scoped.group!==group||scoped.playerId!==sample.id||!Array.isArray(scoped.players)||!scoped.players.some(player=>player.id===sample.id)||['tournaments','matches'].some(key=>!Array.isArray(scoped[key])))throw Error('runtime_player_snapshot_invalid:'+group);
  }
  snapshots[group]={players:payload.players.length,tournaments:payload.tournaments.length,matches:payload.matches.length,playerProfileChecked:Boolean(sample)};
 }
 return{documentRoutes,snapshots};
}
