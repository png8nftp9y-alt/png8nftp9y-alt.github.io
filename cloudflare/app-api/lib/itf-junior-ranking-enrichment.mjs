import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {readItfRankingTargets} from './itf-junior-ranking-reader.mjs';
const native=value=>/^800\d{6}$/.test(String(value||''))?String(value):null;
function identity(person={},participant=false){
 person??={};const found=new Set();const add=id=>{if(native(id))found.add(String(id));};
 for(const p of playerCircuitIdentities(person))if(p.circuit==='itf')add(p.profileId);
 add(person.worldTennisId);if(participant||/itf/i.test(person.sourceCircuit||person.circuit||'')){add(person.profileId);add(person.source_player_id);}
 if(/itf/i.test(person.sourceCircuit||person.circuit||''))add(person.sourcePlayerId||person.officialId);
 for(const p of person.circuitProfiles||[])if(/itf/i.test(p.circuit||'')){
  try{const u=new URL(p.url);if(u.protocol==='https:'&&['www.world.tennis','world.tennis','www.itftennis.com','itftennis.com'].includes(u.hostname))add(u.pathname.match(/^\/en\/players\/[^/]+\/(800\d{6})\//i)?.[1]);}catch{}
 }
 return found.size===1?[...found][0]:null;
}
const preferred=person=>/^(M|B|MALE|BOYS?)$/i.test(person?.sex||person?.gender||'')?'B':/^(F|G|FEMALE|GIRLS?)$/i.test(person?.sex||person?.gender||'')?'G':null;
function choose(rows,person){
 const ranked=rows.filter(r=>r.ranking),sex=preferred(person);
 if(ranked.length===1)return ranked[0];
 if(ranked.length>1)return ranked.find(r=>r.category===sex)||null;
 return rows.find(r=>r.category===sex)||rows.find(r=>r.status==='pending')||rows.find(r=>r.status==='unranked')||rows[0]||null;
}
export async function enrichItfJuniorRankings(db,players=[],matches=[],tournaments=[],options={}){
 const targets=[],assignments=[],playerMap=new Map(players.map(p=>[p.id,p]));
 function add(person,date,assign,category=null,participant=false){
  const id=identity(person,participant);if(!id)return;
  const start=targets.length,categories=category?[category]:['B','G'];
  for(const category of categories)targets.push({playerId:id,category,...(date?{matchDate:date}:{})});
  assignments.push(rows=>assign(choose(rows.slice(start,start+categories.length),person)));
 }
 if(!options.skipPlayers)for(const p of players){p.itfJuniorRanking=null;add(p,null,v=>{p.itfJuniorRanking=v;});}
 const history=new Set(),all=[...matches];
 for(const t of tournaments)if(t.circuit==='itf')for(const m of t.matches||[]){history.add(m);all.push(m);}
 const source=m=>m.circuit||(history.has(m)?'itf':''),ids=[...new Set(all.filter(m=>source(m)==='itf').map(m=>m.matchId||m.id).filter(Boolean))],peopleByMatch=new Map();
 for(let offset=0;offset<ids.length;offset+=80){
  let rows;
  try{rows=(await db.prepare('SELECT match_id,source_player_id,team_index,participant_key FROM match_participants WHERE match_id IN (SELECT value FROM json_each(?)) ORDER BY match_id,team_index,participant_key').bind(JSON.stringify(ids.slice(offset,offset+80))).all()).results||[];}
  catch(error){if(!/no such table: match_participants/.test(String(error)))throw error;rows=[];}
  for(const row of rows){const list=peopleByMatch.get(row.match_id)||[];list.push(row);peopleByMatch.set(row.match_id,list);}
 }
 for(const m of all){
  if(source(m)!=='itf'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date||''))continue;
  const category=/^B(?:-|S|D|OY)/i.test(m.event||m.draw||'')?'B':/^G(?:-|S|D|IRL)/i.test(m.event||m.draw||'')?'G':null;
  const player=playerMap.get(m.playerId)||(history.has(m)?players[0]:null),id=identity(player),people=peopleByMatch.get(m.matchId||m.id)||[],self=id?people.find(p=>native(p.source_player_id)===id):null;
  m.playerItfRanking=null;add(player,m.date,v=>{m.playerItfRanking=v;},category);
  for(const [role,raw]of [['opponent',m.opponents],['partner',m.partners]]){
   const fallback=self?people.filter(p=>role==='partner'?p!==self&&p.team_index===self.team_index:p.team_index!==self.team_index):[];
   const persons=Array.isArray(raw)?raw:fallback;m[role+'ItfRankings']=persons.map(()=>null);
   persons.forEach((person,index)=>add(person,m.date,v=>{m[role+'ItfRankings'][index]=v;if(Array.isArray(raw)&&raw[index]&&typeof raw[index]==='object')raw[index].itfJuniorRanking=v;},category,true));
  }
 }
 const rows=await readItfRankingTargets(db,targets);for(const assign of assignments)assign(rows);
}
