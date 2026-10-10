// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan is enforced by applyArchiveEvidence; verified readback preserves source keys.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {evidenceCatalog} from '../lib/archived-profile-evidence.mjs';
import {itfSearchEvidence,teDirectoryEvidence} from '../lib/live-profile-evidence.mjs';
import {unresolvedSources,applyArchiveEvidence} from './repair-archived-player-profiles.mjs';
import {syncPlayerIdentities,profileRecoveryAudit,addD1Metrics} from './sync-player-identities.mjs';
async function main(){
 await fs.mkdir('tmp/live-profile-recovery',{recursive:true});
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsWritten:0,rowsRead:0},report={startedAt:new Date().toISOString(),metrics,requests:[]};
 async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(x=>x.success))throw Error('live_profile_d1_failed:'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[]}
 const cookies=new Map();
 async function publicPage(url,options={}){
  let current=url,method=options.method||'GET',body=options.body;
  for(let hop=0;hop<6;hop++){const r=await fetch(current,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
   for(const v of r.headers.getSetCookie?.()||[]){const [key,value]=v.split(';')[0].split('=');if(key)cookies.set(key,value)}
   const text=await r.text(),location=r.headers.get('location');
   if(location&&r.status>=300&&r.status<400){current=new URL(location,current).href;method='GET';body=undefined;continue}
   if(r.status!==200)throw Error('official_source_http_'+r.status);
   return {url:current,text};
  }throw Error('official_source_redirect_limit');
 }
 try{
  const rows=await unresolvedSources(query),catalog=evidenceCatalog(),known=JSON.parse(await fs.readFile(new URL('../data/verified-profile-evidence-20261010.json',import.meta.url),'utf8'));report.before=(await profileRecoveryAudit(query)).unresolved;catalog.add(known);
  for(const r of rows.filter(r=>r.circuit==='itf'&&!catalog.resolve(r))){
   const url='https://www.itftennis.com/tennis/api/PlayerApi/GetPlayerSearch?'+new URLSearchParams({searchString:r.display_name,circuitCode:'JT'});
   try{const p=await publicPage(url),json=JSON.parse(p.text),e=itfSearchEvidence(json,r.official_id);catalog.add(e);report.requests.push({circuit:'itf',officialId:r.official_id,evidence:e.length,status:'read'});await fs.writeFile('tmp/live-profile-recovery/itf-'+r.official_id+'.json',JSON.stringify(json));}catch(e){report.requests.push({circuit:'itf',officialId:r.official_id,status:'unreadable',error:e.message})}
  }
  // Discover the official directory response before issuing thousands of speculative lookups.
  try{
   let page=await publicPage('https://te.tournamentsoftware.com/find/player');
   if(/CookiePurposes|SettingsOpen/.test(page.text)){
    const fields=new URLSearchParams({ReturnUrl:'/find/player',SettingsOpen:'false'});fields.append('CookiePurposes','1');
    await publicPage('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:fields.toString()});page=await publicPage('https://te.tournamentsoftware.com/find/player');
   }
   await fs.writeFile('tmp/live-profile-recovery/te-directory.html',page.text);
   const fields=[...page.text.matchAll(/<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi)].map(m=>({name:m[1],tag:m[0]}));
   report.directory={url:page.url,bytes:page.text.length,inputNames:fields.map(x=>x.name),scripts:[...page.text.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],page.url).href)};
   const evidence=teDirectoryEvidence(page.text);catalog.add(evidence);report.directory.evidence=evidence.length;
  }catch(e){report.directory={status:'unreadable',error:e.message}}
  Object.assign(report,await applyArchiveEvidence(query,rows,catalog));report.mapping=await syncPlayerIdentities(query,{allowBulk:true});const after=await profileRecoveryAudit(query);report.after={unresolved:after.unresolved,byCircuit:after.byCircuit};await fs.writeFile('tmp/live-profile-recovery/player-profile-unresolved.json',JSON.stringify(after));report.status=after.unresolved?'unresolved_official_evidence':'complete_zero_verified';
 }catch(e){report.status='failed';report.error=e.message;throw e}
 finally{report.finishedAt=new Date().toISOString();await fs.writeFile('tmp/live-profile-recovery/report.json',JSON.stringify(report));console.log(JSON.stringify({...report,records:undefined}));}
 if(report.status!=='complete_zero_verified')throw Error('official_profiles_still_unresolved:'+report.after.unresolved);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
