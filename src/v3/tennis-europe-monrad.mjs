// Isolated adapter: only explicitly labelled Monrad tables enter this path.
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const decode=s=>s.replace(/&amp;/g,'&');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function monradBoard({shell,html,event,competitionId}){
 if(!/\bMonrad\b/i.test(strip(shell)))return null;
 const fail=reason=>({error:reason});
 const tables=[...String(shell).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]).filter(t=>strip((t.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)||[])[1])===event);
 if(tables.length!==1)return fail('monrad_table_unverified');
 const table=tables[0],headers=strip((table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)||[])[1]);
 if(!/Round 1/.test(headers)||!/Winner/.test(headers)||!/Finals/.test(headers))return fail('monrad_headers_unverified');
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map(c=>({attrs:c[1],html:c[2]})));
 if(rows.some(r=>r.some(c=>/rowspan\s*=/i.test(c.attrs)||/colspan\s*=\s*["']?(?!1(?:["'\s]|$))\d/i.test(c.attrs))))return fail('monrad_grid_unverified');
 const slots=new Map(),scores=[];
 function players(cell){return [...cell.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(a=>{let u;try{u=new URL(decode(a[1]),'https://te.tournamentsoftware.com/tournament/'+competitionId+'/draw/1')}catch{return[]}
 if(!/\/sport\/player\.aspx$/i.test(u.pathname))return[];
 if(u.origin!=='https://te.tournamentsoftware.com'||String(u.searchParams.get('id')).toUpperCase()!==competitionId.toUpperCase()||!/^\d+$/.test(u.searchParams.get('player')||''))throw Error('monrad_player_url_unverified');
 return[{id:u.searchParams.get('player'),name:strip(a[2])}];});}
 for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++){
  const cell=rows[r][c].html,slot=cell.match(/<span\b(?=[^>]*\bid=["'](\d+)["'])(?=[^>]*\bclass=["'](?:entry|match)["'])[^>]*>/i);
  if(slot){if(slots.has(slot[1]))return fail('monrad_duplicate_slot');slots.set(slot[1],{r,c,players:players(cell)});}
  if(/\bWalkover\b|\bW\s*\/\s*O\b/i.test(strip(cell)))scores.push({r,c});
 }
 if(!slots.size)return fail('monrad_slots_missing');
 const entryIds=[...slots.keys()].filter(k=>new RegExp('id=["\']'+k+'["\'][^>]*class=["\']entry').test(table));
 // Find the first-round size from the complete entry numbering.
 const size=entryIds.length;if(![8,16,32,64,128].includes(size))return fail('monrad_entries_incomplete');
 if(entryIds.some(k=>Math.floor(Number(k)/1000)!==Math.log2(size)+1)||entryIds.some((_,i)=>!slots.has(String((Math.log2(size)+1)*1000+i+1))))return fail('monrad_entry_numbering_unverified');
 const rounds=Array.from({length:Math.log2(size)},(_,i)=>size/2**i===2?'Final':size/2**i===4?'Semi final':size/2**i===8?'Quarter final':'Round of '+size/2**i);
 const cards=[...String(html).matchAll(/<div\b[^>]*class=["']match["'][^>]*>/gi)].map(m=>m.index),blocks=cards.map((p,i)=>String(html).slice(p,cards[i+1]||String(html).length));
 const columns=rounds.map(()=>[]),accountedCards=new Set();
 for(const score of scores){
  const candidates=[...slots.entries()].filter(([,s])=>s.c===score.c&&s.r<score.r).sort((a,b)=>b[1].r-a[1].r),found=candidates[0];
  if(!found)return fail('monrad_winner_slot_missing');
  const [key,winner]=found,n=Number(key),level=Math.floor(n/1000),index=n%1000;
  const a=slots.get(String((level+1)*1000+index*2-1)),b=slots.get(String((level+1)*1000+index*2));
  const teamSize=/^[BG]D/.test(event)?2:1;
  if(!a||!b||a.c!==score.c-1||b.c!==a.c||!(a.r<winner.r&&winner.r<b.r)||a.players.length!==teamSize||b.players.length!==teamSize||winner.players.length!==teamSize)return fail('monrad_feeders_unverified');
  const signature=p=>p.map(x=>x.id).sort().join(','),win=signature(winner.players),teams=[a.players,b.players];
  if(new Set(teams.flat().map(p=>p.id)).size!==teamSize*2||!teams.some(p=>signature(p)===win))return fail('monrad_winner_unverified');
  // Placement branches have different numbering; keep them flagged until supported.
  const roundIndex=Math.log2(size)-level;
  if(!Number.isInteger(roundIndex)||roundIndex<0||roundIndex>=rounds.length||index<1||index>2**(level-1))return fail('monrad_round_unverified');
  let footer='';
  const matching=blocks.filter(block=>/Walkover|W\s*\/\s*O/i.test(strip(block))&&signature(players(block))===signature(teams.flat()));
  if(matching.length>1)return fail('monrad_duplicate_match_cards');
  if(matching.length===1){const block=matching[0];accountedCards.add(block);const cardRound=(block.match(/<span\b[^>]*title=["']([^"']+)["']/i)||[])[1];if(cardRound!==rounds[roundIndex])return fail('monrad_card_round_conflict');const won=(block.match(/<div\b[^>]*class=["'][^"']*match__row\s+has-won[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["']match__row\s|$)/i)||[])[1]||'';
   if(signature(players(won))!==win)return fail('monrad_card_winner_conflict');
   footer=(block.match(/<div\b[^>]*class=["']match__footer["'][^>]*>([\s\S]*)/i)||[])[0]||'';
  }
  columns[roundIndex].push('<div class="match">'+teams.map(team=>'<div class="match__row '+(signature(team)===win?'has-won':'')+'">'+team.map(p=>'<a data-player-id="'+p.id+'">'+esc(p.name)+'</a>').join('')+'</div>').join('')+'<span>Walkover</span>'+footer+'</div>');
 }
 if(blocks.some(block=>/\bWalkover\b|\bW\s*\/\s*O\b/i.test(strip(block))&&!accountedCards.has(block)))return fail('monrad_card_not_in_table');
 const markerCount=(strip(table).match(/\bWalkover\b|\bW\s*\/\s*O\b/gi)||[]).length;
 if(markerCount!==scores.length)return fail('monrad_unparsed_walkover_markers');
 return{html:'<div class="js-bracket">'+rounds.map(r=>'<div class="js-subheading">'+r+'</div>').join('')+columns.map(c=>'<swiper-slide>'+c.join('\n')+'</swiper-slide>').join('')+'</div>'};
}
