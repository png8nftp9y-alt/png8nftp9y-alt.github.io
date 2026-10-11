import {allPersonalMembershipsSql} from '../lib/player-list-group.mjs';
// D1_WRITE_POLICY: incremental
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {hydratePersonalCircuitIdentity} from '../lib/courtwatch-player-additions.mjs';
import {playerCircuitIdentities} from '../lib/player-circuit-profiles.mjs';
import {officialFitpClub} from '../lib/personal-player-metadata.mjs';
const esc=value=>"'"+String(value).replaceAll("'","''")+"'";
const run=sql=>{
 const result=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',sql,'--json'],{encoding:'utf8'});
 if(result.status!==0)throw Error('Personal club D1 operation failed');
 return JSON.parse(result.stdout);
};
export async function personalFitpClubCard(db,player){
 const hydrated=await hydratePersonalCircuitIdentity(db,player);
 return playerCircuitIdentities(hydrated).find(link=>link.circuit==='fitp')?.profileId||'';
}
const lookupDb={prepare(sql){return{bind(...values){const bound=sql.replace(/\?/g,()=>esc(values.shift()));return{all:async()=>({results:run(bound).flatMap(x=>x.results||[])})}}}}};
export function clubUpdateSql(row,club){
 const before=JSON.parse(row.payload);
 if(before.club)return '';
 if(typeof club!=='string'||!club.trim())throw Error('Incomplete official club source');
 const current={user_id:row.user_id,courtwatch_id:row.courtwatch_id,payload:before};
 const incoming={...current,payload:{...before,club:club.trim()}};
 const plan=buildIncrementalSyncPlan({current:[current],incoming:[incoming],keyOf:item=>item.user_id+'|'+item.courtwatch_id,sourceComplete:Boolean(row.user_id&&row.courtwatch_id&&club.trim())});
 if(!plan.updates.length)return '';
 return `UPDATE user_app_player_additions SET payload=${esc(JSON.stringify(plan.updates[0].after.payload))}
 WHERE user_id=${esc(row.user_id)} AND courtwatch_id=${esc(row.courtwatch_id)} AND payload=${esc(row.payload)}
 AND EXISTS (SELECT 1 FROM ${allPersonalMembershipsSql} u WHERE u.user_id=user_app_player_additions.user_id AND u.courtwatch_id=user_app_player_additions.courtwatch_id)`;
}
export const personalMissingClubsSql=`SELECT a.user_id,a.courtwatch_id,a.payload FROM user_app_player_additions a
 JOIN ${allPersonalMembershipsSql} u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id
 WHERE COALESCE(json_extract(a.payload,'$.club'),'')=''
 AND (COALESCE(json_extract(a.payload,'$.membershipCard'),'')<>'' OR EXISTS (
  SELECT 1 FROM player_circuit_identities fitp WHERE fitp.circuit='fitp' AND fitp.canonical_id IN (
   SELECT COALESCE(alias.canonical_id,source.canonical_id) FROM player_circuit_identities source
   LEFT JOIN player_identity_aliases alias ON alias.alias_id=source.canonical_id
   WHERE source.source_key=COALESCE(NULLIF(json_extract(a.payload,'$.sourceKey'),''),a.courtwatch_id)
   UNION SELECT canonical_id FROM player_identity_aliases WHERE alias_id=a.courtwatch_id
   UNION SELECT canonical_id FROM player_identity_people WHERE canonical_id=a.courtwatch_id
   AND NOT EXISTS(SELECT 1 FROM player_identity_aliases WHERE alias_id=a.courtwatch_id)
  )))
 ORDER BY a.created_at,a.courtwatch_id LIMIT 100`;
async function main(){
const rows=run(personalMissingClubsSql).flatMap(x=>x.results||[]);
let recovered=0,unavailable=0;
for(const row of rows){
 let club='';
 try{const card=await personalFitpClubCard(lookupDb,JSON.parse(row.payload));if(card)club=await officialFitpClub(card)}catch{console.warn('Personal FITP club source unavailable')}
 if(!club){unavailable++;continue}
 const sql=clubUpdateSql(row,club);
 if(!sql)continue;
 const result=run(sql);
 recovered+=result.reduce((sum,item)=>sum+Number(item.meta?.changes||0),0);
}
console.log(JSON.stringify({status:'personal_fitp_club_sync',checked:rows.length,recovered,unavailable}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();

