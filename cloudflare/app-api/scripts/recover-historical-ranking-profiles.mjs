// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan and optimistic source/readback guards are enforced by applyArchiveEvidence.
import fs from 'node:fs/promises';
import {historicalRankingProfiles} from '../lib/historical-ranking-profile-evidence.mjs';
import {retainedTournamentProfiles} from '../lib/retained-tournament-profile-evidence.mjs';
import {publicCookiePair} from '../lib/live-profile-evidence.mjs';
import {applyArchiveEvidence,unresolvedSources} from './repair-archived-player-profiles.mjs';
import {syncPlayerIdentities,profileRecoveryAudit,addD1Metrics} from './sync-player-identities.mjs';
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('D1_recovery_failed_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[]}
const cookies=new Map();
async function publicPage(url,options={}){let method=options.method||'GET',body=options.body;for(let i=0;i<6;i++){
 if(new URL(url).hostname!=='te.tournamentsoftware.com')throw Error('foreign_official_redirect');
 const r=await fetch(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});for(const v of r.headers.getSetCookie?.()||[]){const p=publicCookiePair(v);if(p)cookies.set(...p)}const text=await r.text(),location=r.headers.get('location');if(location&&r.status>=300&&r.status<400){url=new URL(location,url).href;method='GET';body=undefined;continue}if(r.status!==200)throw Error('official_page_'+r.status);return{url,text};
 }throw Error('official_redirect_limit')}
const before=await profileRecoveryAudit(query),rows=await unresolvedSources(query);
const consent=await publicPage('https://te.tournamentsoftware.com/find/player');if(/CookiePurposes|SettingsOpen/.test(consent.text))await publicPage('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false',CookiePurposes:'1'}).toString()});
const historical=await historicalRankingProfiles(rows,query,publicPage),retained=await retainedTournamentProfiles(rows.filter(r=>!historical.resolved.has(r.source_table+'|'+r.source_key)),query,publicPage),evidence=new Map([...historical.resolved,...retained.resolved]);
const result=await applyArchiveEvidence(query,rows,{resolve:r=>evidence.get(r.source_table+'|'+r.source_key)});
const mapping=await syncPlayerIdentities(query,{maxChanges:500}),after=await profileRecoveryAudit(query);
console.log(JSON.stringify({status:after.unresolved?'unresolved_official_evidence':'complete_zero_verified',before:before.unresolved,repaired:result.repaired,historical:historical.report,retained:retained.report,after:after.unresolved,mapping:{status:mapping.status,pending:mapping.pending,missingObserved:mapping.missing_observed??0,missingAcquired:mapping.missing_acquired??0},metrics}));
if(mapping.status==='pending')throw Error('identity_mapping_pending');
if(after.unresolved)throw Error('official_profiles_still_unresolved:'+after.unresolved);
