const upper=value=>String(value??'').trim().toUpperCase();

function namedPlayers(team={}){
 return (team.players||[]).filter(player=>String(player?.name||[player?.givenName,player?.familyName].filter(Boolean).join(' ')).trim());
}

function explicitBye(team={}){
 const seen=new Set();
 function walk(value,key=''){
  if(value&&typeof value==='object'){
   if(seen.has(value))return false;
   seen.add(value);
   if(Array.isArray(value))return value.some(item=>walk(item,key));
   return Object.entries(value).some(([childKey,child])=>walk(child,childKey));
  }
  if(/bye/i.test(key)&&[true,1,'1','TRUE','YES','Y'].includes(typeof value==='string'?upper(value):value))return true;
  return upper(value)==='BYE';
 }
 return walk(team);
}

function requiredPlayers(event=''){
 return String(event).split('-')[1]==='D'?2:1;
}

function teamState(team,event){
 const players=namedPlayers(team).length,bye=explicitBye(team),required=requiredPlayers(event);
 return{players,bye,full:bye||players>=required};
}

function groupKey(match){return String(match.group??'__default__')}

function koParity(matches,event){
 const groups=Map.groupBy(matches,groupKey),details=[];
 for(const [group,groupMatches] of groups){
  const numbered=groupMatches.filter(match=>Number.isFinite(Number(match.roundNumber))&&Number(match.roundNumber)>0);
  if(!numbered.length){details.push({group,declaredRows:0,observedRows:0,filledRows:0,byeRows:0,emptyRows:0,certified:false,error:'round_numbers_missing'});continue}
  const firstRound=Math.min(...numbered.map(match=>Number(match.roundNumber))),lastRound=Math.max(...numbered.map(match=>Number(match.roundNumber))),entryMatches=numbered.filter(match=>Number(match.roundNumber)===firstRound),rows=entryMatches.flatMap(match=>match.teams||[]),declaredRows=2**lastRound,states=rows.map(team=>teamState(team,event)),filledRows=states.filter(state=>state.full&&!state.bye).length,byeRows=states.filter(state=>state.bye).length,emptyRows=Math.max(0,declaredRows-filledRows-byeRows);
  details.push({group,firstRound,lastRound,declaredRows,observedRows:rows.length,filledRows,byeRows,emptyRows,certified:rows.length===declaredRows&&emptyRows===0});
 }
 const declaredRows=details.reduce((sum,row)=>sum+row.declaredRows,0),observedRows=details.reduce((sum,row)=>sum+row.observedRows,0),filledRows=details.reduce((sum,row)=>sum+row.filledRows,0),byeRows=details.reduce((sum,row)=>sum+row.byeRows,0),emptyRows=details.reduce((sum,row)=>sum+row.emptyRows,0);
 return{structure:'KO',groups:details.length,declaredRows,observedRows,filledRows,byeRows,emptyRows,certified:details.length>0&&details.every(row=>row.certified)};
}

function teamSignature(team={}){
 const names=namedPlayers(team).map(player=>upper(player.id||player.name||[player.givenName,player.familyName].filter(Boolean).join(' '))).filter(Boolean).sort();
 return names.length?names.join('|'):explicitBye(team)?'BYE':'';
}

function rrParity(matches,event){
 const groups=Map.groupBy(matches,groupKey),details=[];
 for(const [group,groupMatches] of groups){
  const allRows=groupMatches.flatMap(match=>match.teams||[]),unique=new Map();let anonymousEmpty=0;
  for(const team of allRows){const signature=teamSignature(team);if(signature)unique.set(signature,team);else anonymousEmpty++}
  const rows=[...unique.values()],states=rows.map(team=>teamState(team,event)),filledRows=states.filter(state=>state.full&&!state.bye).length,byeRows=states.filter(state=>state.bye).length,declaredRows=rows.length+anonymousEmpty,emptyRows=anonymousEmpty+states.filter(state=>!state.full).length;
  details.push({group,declaredRows,observedRows:declaredRows,filledRows,byeRows,emptyRows,certified:declaredRows>0&&emptyRows===0});
 }
 const declaredRows=details.reduce((sum,row)=>sum+row.declaredRows,0),observedRows=details.reduce((sum,row)=>sum+row.observedRows,0),filledRows=details.reduce((sum,row)=>sum+row.filledRows,0),byeRows=details.reduce((sum,row)=>sum+row.byeRows,0),emptyRows=details.reduce((sum,row)=>sum+row.emptyRows,0);
 return{structure:'RR',groups:details.length,declaredRows,observedRows,filledRows,byeRows,emptyRows,certified:details.length>0&&details.every(row=>row.certified)};
}

export function drawRowParity(matches=[],{event='',structure=''}={}){
 const normalized=(matches||[]).map(row=>({group:row.group??'',round:row.round??'',roundNumber:row.roundNumber,structure:upper(row.structure),teams:row.teams||row.match?.teams||[]}));
 if(upper(structure)!=='RR')return koParity(normalized,event);
 const typed=normalized.some(row=>row.structure),rrRows=typed?normalized.filter(row=>row.structure==='RR'):normalized,koRows=typed?normalized.filter(row=>row.structure==='KO'):[],rr=rrParity(rrRows,event),ko=koRows.length?koParity(koRows,event):null;
 if(!ko)return rr;
 return{structure:'RR',groups:rr.groups,knockoutGroups:ko.groups,declaredRows:rr.declaredRows+ko.declaredRows,observedRows:rr.observedRows+ko.observedRows,filledRows:rr.filledRows+ko.filledRows,byeRows:rr.byeRows+ko.byeRows,emptyRows:rr.emptyRows+ko.emptyRows,certified:rr.certified&&ko.certified,roundRobin:rr,knockout:ko};
}

export function rawTeamBye(team){return explicitBye(team)}
