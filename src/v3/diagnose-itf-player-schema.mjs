import {writeFile,mkdir} from 'node:fs/promises';
import {drawsheet} from './itf-common.mjs';

const tasks=[
  {competitionId:'J-J30-MDV-2026-004',event:'G-S-Q-KO',tournamentId:1100204009,tourType:'N',weekNumber:0,playerTypeCode:'G',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO',sourceUrl:'https://www.itftennis.com/en/tournament/j30-male/mdv/2026/j-j30-mdv-2026-004/'},
  {competitionId:'J-J30-PAN-2026-002',event:'G-S-Q-KO',tournamentId:1100203823,tourType:'N',weekNumber:0,playerTypeCode:'G',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO',sourceUrl:'https://www.itftennis.com/en/tournament/j30-panama/pan/2026/j-j30-pan-2026-002/'},
  {competitionId:'J-J30-FIN-2026-004',event:'G-S-Q-KO',tournamentId:1100202439,tourType:'N',weekNumber:0,playerTypeCode:'G',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO',sourceUrl:'https://www.itftennis.com/en/tournament/j30-hanko/fin/2026/j-j30-fin-2026-004/'}
];

function matches(json){return [...(json?.koGroups||[]),...(json?.rrGroups||[])].flatMap(group=>group.rounds||group.matchesByRound||[]).flatMap(round=>round.matches||[])}
function paths(value,path='',out=[]){
 if(Array.isArray(value)){value.slice(0,2).forEach((item,index)=>paths(item,`${path}[${index}]`,out));return out}
 if(value&&typeof value==='object'){for(const [key,item] of Object.entries(value))paths(item,path?`${path}.${key}`:key,out);return out}
 out.push({path,type:value===null?'null':typeof value,value});return out
}

const diagnostics=[];
for(const task of tasks){
 try{
  const json=await drawsheet(task),drawMatches=matches(json),rawPlayers=drawMatches.flatMap(match=>match.teams||[]).flatMap(team=>team.players||[]);
  diagnostics.push({competitionId:task.competitionId,event:task.event,status:'read',matches:drawMatches.length,playerReferences:rawPlayers.length,samples:rawPlayers.slice(0,4),samplePaths:paths(rawPlayers[0]||{}),teamSample:drawMatches[0]?.teams?.[0]||null,teamPaths:paths(drawMatches[0]?.teams?.[0]||{}),matchSample:drawMatches[0]||null,matchPaths:paths(drawMatches[0]||{})});
 }catch(error){diagnostics.push({competitionId:task.competitionId,event:task.event,status:'technical_error',error:error.message,matches:0,playerReferences:0,samples:[],samplePaths:[]})}
}
await mkdir('dist/v3',{recursive:true});
await writeFile('dist/v3/itf_player_schema_diagnostic.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),diagnostics},null,2)+'\n');
console.log(JSON.stringify(diagnostics.map(({competitionId,status,matches,playerReferences,error})=>({competitionId,status,matches,playerReferences,error})),null,2));
