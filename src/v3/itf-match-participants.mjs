// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan contract enforced by
// conditional UPSERTs guarded against the exact accepted match payload.
const sqlString=value=>"'"+String(value??'').replaceAll("'","''")+"'";
export function itfMatchParticipants(match){
 const out=[];
 for(const [teamIndex,team] of (match.teams||[]).entries())for(const [position,p] of (team.players||[]).entries()){
  const name=String(p.name||[p.givenName,p.familyName].filter(Boolean).join(' ')).trim();if(!name)continue;
  out.push({match_id:match.id,participant_key:`itf|team:${teamIndex}|player:${position}`,source_player_id:String(p.id||p.playerId||''),display_name:name,normalized_name:name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase(),nationality:p.nationalityCode||p.nationality||'',team_index:teamIndex,is_winner:Number(match.winnerTeam===teamIndex||team.isWinner===true),payload:JSON.stringify(p)});
 }
 return out;
}
export function itfParticipantSQL(match,{expectedPayload}={}){
 const stored=expectedPayload??JSON.stringify(match,(key,value)=>['generatedAt','observedAt','sourceObservedAt'].includes(key)?undefined:value);
 return itfMatchParticipants(match).map(row=>{
  const fields=Object.keys(row),columns=fields.filter(k=>k!=='match_id'&&k!=='participant_key');
  return `INSERT INTO match_participants(${fields.join(',')}) SELECT ${fields.map(k=>typeof row[k]==='number'?row[k]:sqlString(row[k])).join(',')} WHERE EXISTS(SELECT 1 FROM matches WHERE id=${sqlString(match.id)} AND circuit='itf' AND payload=${sqlString(stored)}) ON CONFLICT(match_id,participant_key) DO UPDATE SET ${columns.map(k=>k+'=excluded.'+k).join(',')} WHERE ${columns.map(k=>'match_participants.'+k+' IS NOT excluded.'+k).join(' OR ')};`;
 });
}
export function itfMatchScore(match){
 if(match.score||match.result)return String(match.score||match.result);
 const a=String(match.teams?.[0]?.score||'').trim().split(/\s+/).filter(Boolean),b=String(match.teams?.[1]?.score||'').trim().split(/\s+/).filter(Boolean);
 return a.length===b.length?a.map((s,i)=>s+'-'+b[i]).join(' '):'';
}
