import {officialItfDrawLinks} from './official-itf-draw-links.mjs';
// Public draw metadata only. Never cache user membership or player filtering here.
const guid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const decode=value=>String(value||'').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&nbsp;/gi,' ');
export function europeCatalogueDraws(html,id){
 const found=new Map();
 for(const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let url;try{url=new URL(decode(match[1]),'https://te.tournamentsoftware.com');}catch{continue;}
  if(url.protocol!=='https:'||url.hostname!=='te.tournamentsoftware.com')continue;
  const modern=url.pathname.match(/^\/tournament\/([^/]+)\/draw\/(\d+)\/?$/i),legacy=/^\/sport\/draw\.aspx$/i.test(url.pathname);
  const tournament=modern?.[1]||(legacy?url.searchParams.get('id'):''),number=modern?.[2]||(legacy?url.searchParams.get('draw'):'');
  if(String(tournament).toUpperCase()!==id.toUpperCase()||!/^\d+$/.test(number||''))continue;
  const event=decode(match[2].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
  if(!/\b(?:[BGX][SD]\d{2}|boys?|girls?|singles?|doubles?)\b/i.test(event))continue;
  if(found.has(number)&&found.get(number).event.length>=event.length)continue;
  found.set(number,{event,drawId:number,drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/${number}`});
 }
 return [...found.values()].sort((a,b)=>Number(a.drawId)-Number(b.drawId));
}
export function itfCatalogueDraws(audit,tournament){
 const id=tournament.competitionId.toUpperCase(),row=audit?.tournaments?.find(t=>String(t.competitionId||'').toUpperCase()===id);
 if(!row)return {draws:[],complete:false};
 if(row.classification==='cancelled_no_draws')return {draws:[],complete:true};
 const official=String(tournament.drawsResultsUrl||tournament.sourceUrl||'').replace(/\/(?:draws-and-results|acceptance-list)\/?$/,'/').replace(/\/?$/,'/draws-and-results/');
 let parsed;try{parsed=new URL(official);}catch{return {draws:[],complete:false};}
 if(parsed.protocol!=='https:'||!['www.itftennis.com','itftennis.com'].includes(parsed.hostname)||!parsed.pathname.toUpperCase().split('/').includes(id))throw Error('invalid_itf_draw_source');
 const events=[...new Set((row.checks||[]).filter(c=>c.acquired===true&&/^[BG]-[SD]-[MQ]-(?:KO|RR)$/.test(c.event)).map(c=>c.event))];
 return {draws:events.map(event=>({event,drawUrl:parsed.href})),complete:row.classification==='complete'};
}
export function createTournamentDrawCatalogue(){
 const cache=new Map(),pending=new Map();
 let itfSnapshot=null,itfLoadedAt=0,itfPending=null,itfArchive=null;
 async function itfAudit(archive){
  if(itfSnapshot&&itfArchive===archive&&Date.now()-itfLoadedAt<300000)return itfSnapshot;
  if(itfPending&&itfArchive===archive)return itfPending;
  itfArchive=archive;
  const request=(async()=>{
   if(!archive)throw Error('itf_draw_archive_unavailable');
   const object=await archive.get('itf/audits/official-draw-parity/coverage-v3-current.json');
   if(!object)throw Error('itf_draw_inventory_unavailable');
   const audit=await object.json();if(!Array.isArray(audit.tournaments))throw Error('itf_draw_inventory_invalid');
   itfSnapshot=audit;itfLoadedAt=Date.now();return audit;
  })();itfPending=request;try{return await request;}finally{if(itfPending===request)itfPending=null;}
 }
 return async function load(tournament,{archive,fetcher=fetch}={}){
  const circuit=tournament.circuit,id=String(tournament.competitionId||''),key=circuit+'|'+id.toUpperCase();
  if(circuit==='itf'){
   if(!/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/i.test(id))throw Error('invalid_draw_tournament');
   const saved=cache.get(key);if(saved&&Date.now()-saved.at<300000)return saved.value;
   if(pending.has(key))return pending.get(key);
   const request=(async()=>{
    let stored={draws:[],complete:false};
    try{stored=itfCatalogueDraws(await itfAudit(archive),tournament);}catch{}
    let result=stored;
    if(!stored.complete)try{result=await officialItfDrawLinks(tournament,{fetcher,known:stored.draws});}catch{}
    const value={circuit,competitionId:id,...result};
    if(result.complete){cache.set(key,{at:Date.now(),value});if(cache.size>40)cache.delete(cache.keys().next().value);}
    return value;
   })();pending.set(key,request);try{return await request;}finally{if(pending.get(key)===request)pending.delete(key);}
  }
  if(circuit!=='tennis-europe'||!guid.test(id))throw Error('invalid_draw_tournament');
  const saved=cache.get(key);if(saved&&Date.now()-saved.at<300000)return saved.value;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   const response=await fetcher(`https://te.tournamentsoftware.com/tournament/${id}/draws`,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)throw Error('europe_draw_catalogue_unavailable');
   const html=await response.text();
   if(/incapsula|captcha|access denied|verify you are human|sign in to continue/i.test(html))throw Error('europe_draw_catalogue_blocked');
   const draws=europeCatalogueDraws(html,id);
   if(!draws.length&&!/no draws|no draws available|draws have not|geen schema/i.test(html))throw Error('europe_draw_catalogue_unverified');
   const value={circuit,competitionId:id,draws,complete:true};cache.set(key,{at:Date.now(),value});if(cache.size>40)cache.delete(cache.keys().next().value);return value;
  })();pending.set(key,request);try{return await request;}finally{if(pending.get(key)===request)pending.delete(key);}
 };
}
export const loadTournamentDrawCatalogue=createTournamentDrawCatalogue();
