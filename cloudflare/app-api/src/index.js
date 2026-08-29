const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const json=(value,status=200)=>Response.json(value,{status,headers:{...cors,'Cache-Control':'public, max-age=30'}});
const parseRows=result=>(result?.results||[]).map(row=>JSON.parse(row.payload));
async function all(env,table,where='',binds=[]){return parseRows(await env.DB.prepare(`SELECT payload FROM ${table} ${where}`).bind(...binds).all())}
function appSnapshot(players,tournaments,entries,schedules,manifest){
  const playerMap=new Map(players.map(p=>[p.id,p])),tournamentMap=new Map(tournaments.map(t=>[t.id,t]));
  const appPlayers=players.filter(p=>p.active!==false).map(p=>({id:p.courtwatchId,name:p.displayName,club:p.club||'',membershipCard:p.identifiers?.fitpMembershipCard||'',circuits:p.circuits||[]}));
  const appTournaments=entries.flatMap(e=>{const p=playerMap.get(e.playerId),t=tournamentMap.get(e.tournamentId);return p&&t?[{playerId:p.courtwatchId,playerName:p.displayName,competitionId:t.sourceTournamentId,name:t.name,location:t.location||'',startDate:t.startDate,endDate:t.endDate,officialStartDate:t.officialStartDate,status:e.state,entryStatus:e.state,entryPosition:e.acceptance?.position??null,calendarListLabel:e.acceptance?.label||'',sourceId:t.circuit,sourceName:t.circuit,circuit:t.circuit,sourceUrl:t.source?.url||''}]:[]});
  const appMatches=schedules.flatMap(s=>{const t=tournamentMap.get(s.tournamentId);return(s.playerIds||[]).map(id=>{const p=playerMap.get(id);return p&&t?{id:s.id,playerId:p.courtwatchId,playerName:p.displayName,competitionId:t.sourceTournamentId,tournamentName:t.name,date:s.localDate,time:s.localTime||'',court:s.court||'',status:s.status,opponent:s.opponentText||'',partner:s.partnerText||'',sourceId:t.circuit}:null}).filter(Boolean)});
  return{generatedAt:manifest.generated_at||new Date().toISOString(),schemaVersion:manifest.schema_version,players:appPlayers,tournaments:appTournaments,matches:appMatches};
}
export default{
  async fetch(request,env){
    try{
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
      if(request.method!=='GET')return json({error:'method_not_allowed'},405);
      const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
      if(path===''||path==='/health'){const row=await env.DB.prepare("SELECT * FROM generations WHERE id='current'").first();return json({service:'courtwatch-app-api',status:row?.status||'uninitialized',generation:row||null})}
      if(path==='/v1/manifest'){const row=await env.DB.prepare("SELECT * FROM generations WHERE id='current'").first();return json(row||{},row?200:503)}
      if(path==='/v1/players')return json({players:await all(env,'players','WHERE active=1 ORDER BY display_name')});
      if(path==='/v1/tournaments'){const circuit=url.searchParams.get('circuit');return json({tournaments:await all(env,'tournaments',circuit?'WHERE circuit=? ORDER BY start_date':'',circuit?[circuit]:[])})}
      if(path==='/v1/entries'){const playerId=url.searchParams.get('playerId');return json({entries:await all(env,'entries',playerId?'WHERE player_id=?':'',playerId?[playerId]:[])})}
      if(path==='/v1/app-snapshot'){const[players,tournaments,entries,schedules,manifest]=await Promise.all([all(env,'players'),all(env,'tournaments'),all(env,'entries'),all(env,'schedules'),env.DB.prepare("SELECT * FROM generations WHERE id='current'").first()]);return json(appSnapshot(players,tournaments,entries,schedules,manifest||{}))}
      return json({error:'not_found'},404);
    }catch(error){console.error(error);return json({error:'internal_error'},500)}
  },
};
