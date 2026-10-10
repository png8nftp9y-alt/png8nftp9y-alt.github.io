// D1_WRITE_POLICY: incremental
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {acceptanceSourceProfiles} from '../lib/acceptance-source-profile-provenance.mjs';
import {legacyAcceptanceProfiles} from '../lib/legacy-acceptance-profile-migration.mjs';
import {publicCookiePair} from '../lib/live-profile-evidence.mjs';
import {unresolvedSources,applyArchiveEvidence} from './repair-archived-player-profiles.mjs';
import {syncPlayerIdentities,profileRecoveryAudit,addD1Metrics} from './sync-player-identities.mjs';
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('D1_minimum_profile_failed_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[]}
const before=await profileRecoveryAudit(query);
const cookies=new Map();
async function publicPage(url,options={}){let method=options.method||'GET',body=options.body;for(let i=0;i<6;i++){if(new URL(url).hostname!=='te.tournamentsoftware.com')throw Error('foreign_official_redirect');const r=await fetch(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',...options.headers,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});for(const v of r.headers.getSetCookie?.()||[]){const p=publicCookiePair(v);if(p)cookies.set(...p)}const text=await r.text(),location=r.headers.get('location');if(location&&r.status>=300&&r.status<400){url=new URL(location,url).href;method='GET';body=undefined;continue}if(r.status!==200)throw Error('official_page_failed');return{url,text}}throw Error('official_redirect_limit')}
const consent=await publicPage('https://te.tournamentsoftware.com/find/player');if(/CookiePurposes|SettingsOpen/.test(consent.text))await publicPage('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false',CookiePurposes:'1'}).toString()});
const doc=JSON.parse(gunzipSync(await fs.readFile(process.env.TE_NATIVE_ACCEPTANCE_CACHE))),sources=(await unresolvedSources(query)).filter(r=>r.circuit==='tennis-europe');
const te=await legacyAcceptanceProfiles(sources,query,publicPage,doc),teDelta=await applyArchiveEvidence(query,sources,{resolve:r=>te.resolved.get(r.source_table+'|'+r.source_key)});
const observedIndex=process.env.TE_NATIVE_PARTICIPANT_INDEX?JSON.parse(gunzipSync(await fs.readFile(process.env.TE_NATIVE_PARTICIPANT_INDEX))):undefined;
const original=await acceptanceSourceProfiles(sources.filter(r=>!te.resolved.has(r.source_table+'|'+r.source_key)),doc,publicPage,observedIndex),originalDelta=await applyArchiveEvidence(query,sources,{resolve:r=>original.resolved.get(r.source_table+'|'+r.source_key)});
const mapping=await syncPlayerIdentities(query,{maxChanges:500}),after=await profileRecoveryAudit(query);
console.log(JSON.stringify({status:after.unresolved?'native_profiles_unresolved':'all_native_profiles_resolved',before:{unresolved:before.unresolved,byCircuit:before.byCircuit},tennisEurope:{...te.report,repaired:teDelta.repaired},originalAcceptance:{...original.report,repaired:originalDelta.repaired},after:{unresolved:after.unresolved,byCircuit:after.byCircuit},mapping:{status:mapping.status,pending:mapping.pending,missingObserved:mapping.missing_observed??0,missingAcquired:mapping.missing_acquired??0},metrics}));
if(mapping.status==='pending')throw Error('identity_mapping_pending');if(after.unresolved)throw Error('native_profiles_unresolved:'+after.unresolved);
