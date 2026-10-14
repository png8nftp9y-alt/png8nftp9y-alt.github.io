// D1_READ_ONLY: guarded
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import worker from '../src/index.js';
import {writeFile} from 'node:fs/promises';
const client=await openReadOnlyD1(),users=await client.query("SELECT email FROM app_users WHERE status='active'");
if(!users.length)throw Error('ranking_no_active_account');
const players=new Map(),matches=new Map();
for(const user of users)for(const group of ['main','others']){
 const response=await worker.fetch(new Request('https://ranking-input.invalid/app/api/app-snapshot',{headers:{'Cf-Access-Authenticated-User-Email':user.email,'X-CourtWatch-Group':group}}),{DB:client.db},{});
 if(!response.ok)throw Error('ranking_projection_unavailable');const body=await response.json();
 if(body.group!==group||!Array.isArray(body.players)||!Array.isArray(body.matches))throw Error('ranking_projection_incomplete');
 for(const player of body.players)players.set(player.id,player);
 for(const match of body.matches.filter(m=>m.circuit==='tennis-europe'))matches.set(match.playerId+'|'+(match.matchId||match.id),match);
}
const all={complete:true,players:[...players.values()],matches:[...matches.values()]};
await writeFile('te-ranking-app-projections.json',JSON.stringify(all));
await writeFile('te-ranking-matches.json',JSON.stringify([{results:all.matches.map(m=>({payload:JSON.stringify(m)}))}]));
console.log(JSON.stringify({rankingInput:{players:players.size,matches:matches.size,complete:true}}));
