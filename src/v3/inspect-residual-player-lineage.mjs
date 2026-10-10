import fs from 'node:fs/promises';
// D1_WRITE_POLICY: read-only
import {assertReadOnlyQuery} from '../../cloudflare/app-api/lib/read-only-d1-query.mjs';
import {unresolvedSources} from '../../cloudflare/app-api/scripts/repair-archived-player-profiles.mjs';
import {normalizePlayerName} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
import {sqlString} from './itf-draw-document-d1.mjs';
import {publicCookiePair} from '../../cloudflare/app-api/lib/live-profile-evidence.mjs';
const base='https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database';
const headers={Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'};
const list=await fetch(base+'?name=courtwatch-app&per_page=100',{headers}),body=await list.json();
if(!list.ok||!body.success)throw Error('lineage_database_list_failed');
const database=body.result.find(d=>d.name==='courtwatch-app'),id=database?.uuid||database?.id;
if(!id)throw Error('lineage_existing_database_missing');
async function query(sql){
 assertReadOnlyQuery(sql);
 const r=await fetch(base+'/'+id+'/query',{method:'POST',headers,body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();
 if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('lineage_query_failed');
 return j.result[0].results||[];
}
const rows=(await unresolvedSources(query)).filter(r=>r.circuit==='tennis-europe'&&!r.official_id),groups=new Map();
for(const r of rows){const n=normalizePlayerName(r.display_name),group=groups.get(n)||[];group.push(r);groups.set(n,group);}
const results=[];let index=0;
for(const [name,sources]of groups){
 const variants=[name,name.toLowerCase(),name.split(' ').reverse().join(' '),name.split(' ').reverse().join(' ').toLowerCase()];
 const participants=await query('SELECT p.source_player_id,p.participant_key,p.payload,m.payload AS match_payload,t.source_tournament_id FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=\'tennis-europe\' AND p.normalized_name IN ('+variants.map(sqlString).join(',')+') LIMIT 1000');
 const refs=new Map();
 for(const p of participants){
  const raw=JSON.parse(p.payload||'{}'),match=JSON.parse(p.match_payload||'{}');
  const ids=Object.fromEntries(Object.entries(raw).filter(([k,v])=>/^(id|playerId|sourcePlayerId|source_player_id|participantId|teProfileId|profileId|membershipCode)$/i.test(k)&&['string','number'].includes(typeof v)));
  const urls=Object.values(raw).filter(v=>typeof v==='string'&&/^(https:\/\/te\.tournamentsoftware\.com)?\/(sport\/player|player-profile)/i.test(v));
  const reference={sourcePlayerId:p.source_player_id,participantKey:p.participant_key,sourceTournamentId:p.source_tournament_id,fields:Object.keys(raw),ids,urls,matchFields:Object.keys(match),competitionId:match.competitionId||null};
  refs.set(JSON.stringify(reference),reference);
 }
 const result={index:index++,sourceKeys:sources.map(r=>r.source_key),links:sources.length,matches:participants.length,references:[...refs.values()]};results.push(result);
 console.log(JSON.stringify({index:result.index,links:result.links,matches:result.matches,referenceShapes:[...new Set(result.references.map(r=>r.fields.join(',')))]}));
}
await fs.mkdir('tmp/residual-player-lineage',{recursive:true});
await fs.writeFile('tmp/residual-player-lineage/lineage.json',JSON.stringify({generatedAt:new Date().toISOString(),rows:rows.length,names:groups.size,results}));
console.log(JSON.stringify({readOnly:true,rows:rows.length,names:groups.size}));
const cookies=new Map();
async function publicPage(url,options={}){
 let method=options.method||'GET',body=options.body;
 for(let hop=0;hop<6;hop++){
  if(new URL(url).hostname!=='te.tournamentsoftware.com')throw Error('lineage_foreign_redirect');
  const r=await fetch(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});
  for(const c of r.headers.getSetCookie()){const pair=publicCookiePair(c);if(pair)cookies.set(...pair)}
  const text=await r.text(),next=r.headers.get('location');
  if(next&&r.status>=300&&r.status<400){url=new URL(next,url).href;method='GET';body=undefined;continue}
  if(r.status!==200)throw Error('lineage_native_http_'+r.status);return{url,text};
 }throw Error('lineage_native_redirect_limit');
}
let consent=await publicPage('https://te.tournamentsoftware.com/tournaments');
if(consent.url.includes('/cookiewall'))await publicPage('https://te.tournamentsoftware.com/cookiewall/Save',{method:'POST',body:new URLSearchParams({ReturnUrl:'/tournaments',SettingsOpen:'false',CookiePurposes:'1'}).toString()});
const urls=new Map();
for(const result of results)for(const ref of result.references)for(const href of ref.urls){
 const url=new URL(href,'https://te.tournamentsoftware.com');
 if(url.hostname==='te.tournamentsoftware.com'&&url.pathname==='/sport/player.aspx'&&url.searchParams.get('id')?.toLowerCase()===String(ref.sourceTournamentId).toLowerCase()&&url.searchParams.get('player')===String(ref.sourcePlayerId))urls.set(url.href,{href:url.href,indices:[...(urls.get(url.href)?.indices||[]),result.index]});
}
const inputs=[...urls.values()],pages=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<inputs.length){const index=cursor++,input=inputs[index],result={...input,index};try{
 const page=await publicPage(input.href),links=new Set();
 for(const m of page.text.matchAll(/href=["']([^"']+)["']/gi)){const url=new URL(m[1].replaceAll('&amp;','&'),page.url);if(url.hostname==='te.tournamentsoftware.com'&&/^\/player-profile\/[a-f0-9-]{36}\/?$/i.test(url.pathname))links.add(url.href)}
 if(new URL(page.url).hostname==='te.tournamentsoftware.com'&&/^\/player-profile\/[a-f0-9-]{36}\/?$/i.test(new URL(page.url).pathname))links.add(page.url);
 result.finalUrl=page.url;result.profileLinks=[...links];result.bytes=page.text.length;
 if(index<3){const masked=page.text.replace(/>[\s\S]*?</g,m=>'>[text:'+m.slice(1,-1).trim().length+']<').replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,'PROFILE_ID');await fs.writeFile('tmp/residual-player-lineage/native-page-'+index+'.html',masked);}
 }catch(e){result.error=e.message}pages.push(result);console.log(JSON.stringify({nativeIndex:index,indices:result.indices,profileLinks:result.profileLinks?.length,error:result.error}));}}));
await fs.writeFile('tmp/residual-player-lineage/native-player-pages.json',JSON.stringify({generatedAt:new Date().toISOString(),pages}));
