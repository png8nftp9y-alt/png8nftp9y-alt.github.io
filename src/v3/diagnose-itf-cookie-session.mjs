import fs from 'node:fs/promises';

const BASE='https://www.itftennis.com',API=BASE+'/tennis/api/TournamentApi';
const competitionId=process.env.ITF_DIAGNOSTIC_TOURNAMENT||'J-J100-ITA-2026-001';
const tournaments=JSON.parse(await fs.readFile('dist/v3/source_itf_tournaments.json','utf8')).tournaments||[];
const tournament=tournaments.find(t=>String(t.competitionId).toUpperCase()===competitionId.toUpperCase());
if(!tournament)throw new Error('diagnostic_tournament_not_found');

const jar=new Map(),chain=[];
function cookiePairs(headers){const values=headers.getSetCookie?.()||[headers.get('set-cookie')||''];return values.flatMap(v=>String(v).split(/,(?=\s*[^;,]+=)/)).map(v=>v.split(';')[0].trim()).filter(Boolean)}
function collect(headers){for(const pair of cookiePairs(headers)){const i=pair.indexOf('=');if(i>0)jar.set(pair.slice(0,i),pair.slice(i+1))}}
function cookie(){return[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}
const browserHeaders={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36','accept-language':'en-GB,en;q=0.9,it;q=0.8','cache-control':'no-cache','pragma':'no-cache'};
async function get(url,{accept='text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',referer=''}={}){
 let current=url;
 for(let hop=0;hop<6;hop++){
  const r=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...browserHeaders,accept,cookie:cookie(),...(referer?{referer}:{}),'sec-fetch-site':referer?'same-origin':'none','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}});
  collect(r.headers);const text=await r.text(),location=r.headers.get('location')||'';
  chain.push({url:current,status:r.status,location,contentType:r.headers.get('content-type')||'',length:text.length,cookieNames:[...jar.keys()],incapsula:/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(text)});
  if(r.status<300||r.status>=400||!location)return{r,text,url:current};
  current=new URL(location,current).toString();
 }
 throw new Error('redirect_limit');
}
async function apiGet(url,referer){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000),headers:{...browserHeaders,accept:'application/json, text/plain, */*',cookie:cookie(),referer,'x-requested-with':'XMLHttpRequest','sec-fetch-site':'same-origin','sec-fetch-mode':'cors','sec-fetch-dest':'empty'}});
 collect(r.headers);const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}
 return{status:r.status,contentType:r.headers.get('content-type')||'',length:text.length,json,incapsula:/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(text),sample:json?'json':text.replace(/\s+/g,' ').slice(0,180)};
}
function combinations(json){const out=[];function walk(v,ctx={}){if(Array.isArray(v)){for(const x of v)walk(x,ctx);return}if(!v||typeof v!=='object')return;const next={...ctx};for(const k of['tournamentId','tourType','circuitCode','weekNumber','playerTypeCode','matchTypeCode','eventClassificationCode','drawsheetStructureCode'])if(v[k]!==undefined&&v[k]!==null&&v[k]!=='')next[k]=v[k];if(v.dataName&&v.valueCode!==undefined)next[v.dataName]=v.valueCode;if(next.tournamentId&&next.playerTypeCode&&next.matchTypeCode&&next.eventClassificationCode&&next.drawsheetStructureCode)out.push(next);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,next)}walk(json);return out}

const pageUrl=tournament.sourceUrl||`${BASE}/en/tournament/x/x/2026/${competitionId.toLowerCase()}/`;
const bootstrap=await get(pageUrl);
const filters=await apiGet(`${API}/GetEventFilters?tournamentKey=${encodeURIComponent(competitionId.toLowerCase())}`,pageUrl);
const combos=filters.json?combinations(filters.json):[];
let draw=null;
if(combos.length){
 const c=combos[0],q=new URLSearchParams({tournamentId:String(c.tournamentId),tourType:String(c.tourType||'N'),weekNumber:String(c.weekNumber||0),playerTypeCode:String(c.playerTypeCode),matchTypeCode:String(c.matchTypeCode),eventClassificationCode:String(c.eventClassificationCode),drawsheetStructureCode:String(c.drawsheetStructureCode)});
 draw=await apiGet(`${API}/GetDrawsheet?${q}`,pageUrl);
}
const out={generatedAt:new Date().toISOString(),competitionId,pageUrl,bootstrap:{status:bootstrap.r.status,length:bootstrap.text.length,incapsula:/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(bootstrap.text)},cookieNames:[...jar.keys()],chain,eventFilters:{...filters,json:undefined},combinations:combos.length,drawsheet:draw?{...draw,json:undefined}:null,success:Boolean(filters.json&&combos.length&&draw?.json)};
await fs.mkdir('dist/v3',{recursive:true});await fs.writeFile('dist/v3/itf_cookie_session_diagnostic.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(!out.success)process.exitCode=2;
