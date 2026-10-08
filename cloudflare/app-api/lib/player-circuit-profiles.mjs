export const normalizePlayerName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toUpperCase();
export const playerNameKey=value=>normalizePlayerName(value).split(' ').sort().join(' ');
export const profileCircuit=value=>{const s=String(value||'').toLowerCase();return /europe/.test(s)?'tennis-europe':/itf/.test(s)?'itf':/fitp/.test(s)?'fitp':''};
const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const country=value=>({ITALY:'ITA',ITALIA:'ITA',IT:'ITA',SWITZERLAND:'SUI',CH:'SUI'}[String(value||'').toUpperCase()]||String(value||'').toUpperCase());
const birth=p=>Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4))||null;
export function officialPlayerUrl(circuit,player={}){
 const c=profileCircuit(circuit),sync=player.profileSync?.[c==='tennis-europe'?'tennisEurope':c]||{};
 const candidates=[sync.url,player.profileUrl,player.playerProfileUrl,player.url,...(player.officialUrls?.[c==='tennis-europe'?'tennisEurope':c]||[])].filter(x=>typeof x==='string');
 for(const value of candidates)try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)continue;
  if(c==='fitp'&&['fitp.it','www.fitp.it'].includes(u.hostname)&&/^\/Pagina-Giocatore\/?$/i.test(u.pathname)&&u.searchParams.get('cardNumber'))return u.href;
  if(c==='tennis-europe'&&u.hostname==='te.tournamentsoftware.com'&&/^\/player-profile\/[a-f0-9-]{36}\/?$/i.test(u.pathname))return u.href;
  if(c==='itf'&&['itftennis.com','www.itftennis.com'].includes(u.hostname)&&/^\/en\/players\/[^/]+\/800\d{6}\//i.test(u.pathname))return u.href;
 }catch{}
 if(c==='fitp'){const card=String(player.membershipCard||player.officialId||'');if(/^\d{6,12}$/.test(card))return 'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(btoa(card));}
 if(c==='tennis-europe'){const id=String(sync.profileId||player.officialId||'');if(guid.test(id))return 'https://te.tournamentsoftware.com/player-profile/'+id;}
 if(c==='itf'){const id=String(player.worldTennisId||player.officialId||''),nation=country(player.nationality||player.country),slug=normalizePlayerName(player.name||player.displayName).toLowerCase().replaceAll(' ','-');if(/^800\d{6}$/.test(id)&&/^[A-Z]{3}$/.test(nation)&&slug)return `https://www.itftennis.com/en/players/${slug}/${id}/${nation.toLowerCase()}/jt/s/overview/`;}
 return '';
}
const identityFor=(c,p)=>String(c==='fitp'?p.membershipCard||'':c==='tennis-europe'?p.profileSync?.tennisEurope?.profileId||'':p.worldTennisId||'');
const officialIdentity=(c,id)=>c==='fitp'?/^\d{6,12}$/.test(id):c==='tennis-europe'?guid.test(id):/^800\d{6}$/.test(id);
export function circuitProfiles(player,rows=[]){
 const source=profileCircuit(player.sourceCircuit||player.circuit),known=new Set(),result=new Map();
 // A configured circuits array is eligibility, not evidence of a profile or participation.
 for(const c of ['fitp','tennis-europe','itf']){
  const own={...player,officialId:source===c?player.officialId||player.sourcePlayerId||'':''},url=officialPlayerUrl(c,own);
  if(url||officialIdentity(c,identityFor(c,player))||(c===source&&player.sourceKey)){
   known.add(c);result.set(c,{circuit:c,url});
  }
 }
 const grouped=new Map();for(const row of rows){let payload={};try{payload=JSON.parse(row.payload||'{}')}catch{}const c=profileCircuit(row.circuit);if(!c||playerNameKey(row.display_name)!==playerNameKey(player.name))continue;
  const candidate={...payload,name:row.display_name,officialId:row.official_id||payload.officialId||''};
  if(country(player.nationality)&&country(candidate.nationality)&&country(player.nationality)!==country(candidate.nationality))continue;
  if(birth(player)&&birth(candidate)&&birth(player)!==birth(candidate))continue;
  const expected=identityFor(c,player)||(c===source?String(player.sourcePlayerId||player.officialId||''):'');
  if(officialIdentity(c,expected)&&officialIdentity(c,candidate.officialId)&&expected!==candidate.officialId)continue;
  const list=grouped.get(c)||[];list.push(candidate);grouped.set(c,list);
 }
 for(const [c,list] of grouped){
  const urls=[...new Set(list.map(p=>officialPlayerUrl(c,p)).filter(Boolean))];
  // A new circuit needs a compatible birth year and an unambiguous official profile.
  // Names, reversed names and static circuit declarations alone cannot join people.
  const safe=known.has(c)||list.some(p=>birth(player)&&birth(p)===birth(player));
  if(safe&&urls.length===1&&!result.get(c)?.url)result.set(c,{circuit:c,url:urls[0]});
 }
 return ['fitp','tennis-europe','itf'].filter(c=>result.has(c)).map(c=>result.get(c));
}
export async function resolveCircuitProfiles(db,players){
 const results=new Map();
 for(let offset=0;offset<players.length;offset+=20){const batch=players.slice(offset,offset+20),names=[...new Set(batch.flatMap(p=>{const n=normalizePlayerName(p.name),reverse=n.split(' ').reverse().join(' ');return[n,n.toLowerCase(),reverse,reverse.toLowerCase()]}).filter(Boolean))],rows=[];
  if(names.length)for(const table of ['observed_players','search_acquired_players'])try{rows.push(...((await db.prepare(`SELECT circuit,official_id,display_name,payload FROM ${table} WHERE normalized_name IN (${names.map(()=>'?').join(',')})`).bind(...names).all()).results||[]))}catch(e){if(!/no such table/i.test(e.message))throw e}
  for(const p of batch)results.set(p,circuitProfiles(p,rows));
 }
 return results;
}
