// D1_READ_ONLY: guarded
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
// The established transport rejects mutations before sending any request.
export function createRecoveryReader(options={}){
 let client;
 return async(sql,params=[])=>{
  client??=openReadOnlyD1(options).catch(error=>{client=undefined;throw error;});
  return (await client).query(sql,params);
 };
}
export const query=createRecoveryReader();
