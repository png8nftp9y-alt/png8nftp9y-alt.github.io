import fs from 'node:fs/promises';

const BASE='https://te.tournamentsoftware.com';
const NOW=new Date();
const TODAY=NOW.toISOString().slice(0,10);
const DAY=86400000;
const OUT='dist/v3/tennis_europe_oop_route_diagnostic.json';

async function readJson(path,fallback={}){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}
function clean(value){return String(value||'').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
function attr(tag,name){return (tag.match(new RegExp(name+'=["\\\']([^"\\\']*)','i'))||[])[1]||''}
function abs(href,base=BASE){try{return new URL(String(href||'').replace(/&amp;/g,'&'),base).toString()}catch{return''}}
function cookiePair(value){return String(value||'').split(';')[0]}
function mergeCookie(old,value){const map=new Map(String(old||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>x.split(/=(.*)/s).slice(0,2)));const pair=cookiePair(value);if(pair){const [k,v]=pair.split(/=(.*)/s);map.set(k,v)}return[...map].map(([k,v])=>k+'='+v).join('; ')}
async function request(method,url,{cookie='',body=null}={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{method,redirect:'manual',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 CourtWatch-Tennis-Europe-OOP-discovery/1.0','accept':'text/html,*/*','accept-language':'en-GB,en;q=0.9','content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-requested-with':'XMLHttpRequest',cookie},body});return{status:response.status,url,location:response.headers.get('location')||'',setCookie:(response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||'']).join(','),text:await response.text()}}finally{clearTimeout(timer)}}
async function acceptedCookie(){const first=await request('GET',BASE+'/tournaments');let cookie=cookiePair(first.setCookie);if(first.location&&/cookiewall/i.test(first.location)){const wall=await request('GET',abs(first.location),{cookie});cookie=mergeCookie(cookie,wall.setCookie);const body=new URLSearchParams({ReturnUrl:'/tournaments',SettingsOpen:'false'});for(const value of ['1','2','3','4'])body.append('CookiePurposes',value);const saved=await request('POST',BASE+'/cookiewall/Save',{cookie,body:body.toString()});cookie=mergeCookie(cookie,saved.setCookie)}return cookie}
function links(html,pageUrl){const rows=[];for(const match of String(html||'').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const url=abs(attr(match[1],'href'),pageUrl),label=clean(match[2]);if(url&&(/match|order.?of.?play|schedule|result|draw/i.test(url+' '+label)))rows.push({url,label})}return[...new Map(rows.map(x=>[x.url,x])).values()]}
function evidence(html){const text=clean(html);return{bytes:String(html||'').length,title:(text.match(/.{0,80}(?:Order of Play|Matches|Results|Schedule).{0,120}/i)||[])[0]||'',matchWords:(text.match(/\b(?:match|court|result|score|winner|order of play)\b/gi)||[]).length,playerLinks:(String(html||'').match(/player-profile|\/player\/|sport\/player|data-player-id/gi)||[]).length,dateTokens:(text.match(/\b\d{1,2}[\/. -]\d{1,2}[\/. -]20\d{2}\b/g)||[]).length,scoreTokens:(text.match(/\b(?:[0-7]-[0-7]|RET|W\/O|walkover|retired)\b/gi)||[]).length}}
function selectSamples(rows){const now=TODAY,t1=new Date(NOW.getTime()+DAY).toISOString().slice(0,10);const concluded=rows.filter(x=>x.endDate&&x.endDate<now).slice(-3),active=rows.filter(x=>x.startDate<=now&&x.endDate>=now).slice(0,3),eligible=rows.filter(x=>x.startDate===t1).slice(0,3);const merged=[...concluded,...active,...eligible];return[...new Map(merged.map(x=>[x.competitionId,x])).values()].map(x=>({...x,sampleClass:x.endDate<now?'concluded':x.startDate<=now?'active':'t-minus-one'}))}
async function probeTournament(t,cookie){const id=t.competitionId,basePages=[t.sourceUrl,t.eventsUrl,BASE+'/sport/tournament?id='+id].filter(Boolean),candidates=new Map();for(const url of basePages){try{const page=await request('GET',url,{cookie});for(const link of links(page.text,url))candidates.set(link.url,{url:link.url,label:link.label,discovered:true});candidates.set(url,{url,label:'tournament page',base:true,status:page.status,evidence:evidence(page.text)})}catch(error){candidates.set(url,{url,label:'tournament page',base:true,error:String(error)})}}
for(const url of [BASE+'/sport/matches.aspx?id='+id,BASE+'/sport/matches?id='+id,BASE+'/tournament/'+id+'/matches',BASE+'/sport/results.aspx?id='+id])if(!candidates.has(url))candidates.set(url,{url,label:'direct candidate'});
const probes=[];for(const candidate of candidates.values()){if(candidate.base){probes.push(candidate);continue}try{const page=await request('GET',candidate.url,{cookie});probes.push({...candidate,status:page.status,location:page.location,evidence:evidence(page.text)})}catch(error){probes.push({...candidate,error:String(error)})}}
return{competitionId:id,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate,sampleClass:t.sampleClass,probes}}
const catalog=await readJson('history/tennis_europe_tournament_catalog.json',{tournaments:{}});
const rows=Object.values(catalog.tournaments||{});
const samples=selectSamples(rows);
const cookie=await acceptedCookie();
const tournaments=[];
for(const tournament of samples)tournaments.push(await probeTournament(tournament,cookie));
const useful=tournaments.flatMap(x=>x.probes).filter(x=>x.status===200&&x.evidence&&(x.evidence.matchWords>2||x.evidence.playerLinks>1));
const diagnostic={version:'te-oop-route-discovery-v1',generatedAt:new Date().toISOString(),status:useful.length?'route_candidates_found':'no_route_candidate_found',catalogTournaments:rows.length,sampleCount:samples.length,usefulCandidateCount:useful.length,tournaments};
await writeJson(OUT,diagnostic);
console.log(JSON.stringify({status:diagnostic.status,catalogTournaments:rows.length,sampleCount:samples.length,usefulCandidateCount:useful.length,output:OUT},null,2));
if(!samples.length)throw new Error('No Tennis Europe tournaments selected for OOP discovery');
if(!useful.length)throw new Error('No Tennis Europe OOP/result route candidate found');
