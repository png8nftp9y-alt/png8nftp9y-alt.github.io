// D1_WRITE_POLICY: incremental
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {displayPlayerClub} from '../lib/personal-player-metadata.mjs';
export const confirmedYears=[
 {name:'Riccardo Galbiati',year:2008},
 {name:'Paolo Brambilla',year:2009},
 {name:'Camilla Frigerio',year:2017},
];
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const esc=value=>"'"+String(value).replaceAll("'","''")+"'";
export function resolveConfirmedYears(rows){
 return confirmedYears.flatMap(target=>{
  const matches=rows.filter(row=>key(JSON.parse(row.payload).name)===key(target.name));
  if(matches.length>1)throw Error('Ambiguous active selection: '+target.name);
  return matches.map(row=>({row,year:target.year}));
 });
}
export function birthYearUpdateSql(row,year){
 const before=JSON.parse(row.payload),card=String(before.membershipCard||'');
 if(!/^\d+$/.test(card)||row.observed_source_key!=='fitp|id:'+card||displayPlayerClub(before.club)!=='Tennis Club Lecco')throw Error('Incomplete selected identity');
 if(!Number.isInteger(year)||year<1900||year>new Date().getUTCFullYear())throw Error('Incomplete birth-year source');
 if(before.birthYear&&Number(before.birthYear)!==year)throw Error('Conflicting saved birth year');
 if(before.birthDate&&Number(String(before.birthDate).slice(0,4))!==year)throw Error('Conflicting saved birth date');
 const incoming={...before,birthYear:year,birthYearSource:'user-confirmed:2026-10-08'};
 const plan=buildIncrementalSyncPlan({current:[{...row,payload:before}],incoming:[{...row,payload:incoming}],keyOf:item=>item.user_id+'|'+item.courtwatch_id,sourceComplete:Boolean(row.user_id&&row.courtwatch_id&&before.id===row.courtwatch_id)});
 if(!plan.updates.length)return '';
 return `UPDATE user_app_player_additions SET payload=${esc(JSON.stringify(plan.updates[0].after.payload))}
 WHERE user_id=${esc(row.user_id)} AND courtwatch_id=${esc(row.courtwatch_id)} AND observed_source_key=${esc(row.observed_source_key)} AND payload=${esc(row.payload)}
 AND EXISTS (SELECT 1 FROM user_app_players u WHERE u.user_id=user_app_player_additions.user_id AND u.courtwatch_id=user_app_player_additions.courtwatch_id)
 AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=user_app_player_additions.user_id AND r.courtwatch_id=user_app_player_additions.courtwatch_id)`;
}
function run(sql){
 const result=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',sql,'--json'],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||result.stdout);
 return JSON.parse(result.stdout);
}
async function main(){
 const rows=run(`SELECT a.user_id,a.courtwatch_id,a.observed_source_key,a.payload FROM user_app_player_additions a
 JOIN user_app_players u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id
 WHERE a.user_id='user-federico-181099' AND a.created_at<='2026-10-07T22:06:05Z'
 AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=a.user_id AND r.courtwatch_id=a.courtwatch_id)`).flatMap(item=>item.results||[]);
 const resolved=resolveConfirmedYears(rows);
 // Validate every candidate before the first database write.
 const statements=resolved.map(({row,year})=>birthYearUpdateSql(row,year)).filter(Boolean);
 let changed=0;
 for(const sql of statements)changed+=run(sql).reduce((sum,item)=>sum+Number(item.meta?.changes||0),0);
 const after=resolveConfirmedYears(run(`SELECT a.user_id,a.courtwatch_id,a.observed_source_key,a.payload FROM user_app_player_additions a
 JOIN user_app_players u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id
 WHERE a.user_id='user-federico-181099' AND a.created_at<='2026-10-07T22:06:05Z'
 AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=a.user_id AND r.courtwatch_id=a.courtwatch_id)`).flatMap(item=>item.results||[]));
 if(after.some(({row,year})=>Number(JSON.parse(row.payload).birthYear)!==year))throw Error('Birth-year verification failed');
 console.log(JSON.stringify({status:'confirmed_personal_birth_years',matched:resolved.length,verified:after.length,changed,absent:confirmedYears.filter(target=>!resolved.some(({row})=>key(JSON.parse(row.payload).name)===key(target.name))).map(target=>target.name)}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
