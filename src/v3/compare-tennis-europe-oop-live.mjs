import fs from 'node:fs/promises';
import path from 'node:path';

const CURRENT=process.env.TE_OOP_CURRENT||'dist/v3/tennis_europe_oop_live.json';
const PREVIOUS=process.env.TE_OOP_PREVIOUS||'dist/v3/previous-tennis-europe-oop/tennis_europe_oop_live.json';
const OUTPUT=process.env.TE_OOP_TRANSITIONS||'dist/v3/tennis_europe_oop_live_transitions.json';
const current=JSON.parse(await fs.readFile(CURRENT,'utf8'));
let previous=null;
try{previous=JSON.parse(await fs.readFile(PREVIOUS,'utf8'))}catch{}
const before=new Map((previous?.matches||[]).map(x=>[x.id,x])),after=new Map((current.matches||[]).map(x=>[x.id,x]));
const transitions=[];
for(const [id,match] of after){const old=before.get(id);if(!old){transitions.push({type:match.status==='completed'?'new_completed':'new_scheduled',matchId:id,before:null,after:match});continue}if(old.status==='scheduled'&&match.status==='completed')transitions.push({type:'scheduled_to_completed',matchId:id,before:old,after:match});else if(old.status!==match.status)transitions.push({type:'status_changed',matchId:id,before:old,after:match});else if(old.score!==match.score||JSON.stringify(old.winnerPlayerIds||[])!==JSON.stringify(match.winnerPlayerIds||[]))transitions.push({type:'result_changed',matchId:id,before:old,after:match});else if(old.date!==match.date||old.time!==match.time||old.court!==match.court)transitions.push({type:'schedule_changed',matchId:id,before:old,after:match})}
for(const [id,match] of before)if(!after.has(id))transitions.push({type:'removed_from_source',matchId:id,before:match,after:null});
const count=type=>transitions.filter(x=>x.type===type).length;
const result={version:'te-oop-live-transitions-v1',generatedAt:new Date().toISOString(),status:current.status==='green'?'green':'red',baseline:!previous,previousGeneratedAt:previous?.generatedAt||null,currentGeneratedAt:current.generatedAt,counts:{previousMatches:before.size,currentMatches:after.size,transitions:transitions.length,newScheduled:count('new_scheduled'),newCompleted:count('new_completed'),scheduledToCompleted:count('scheduled_to_completed'),statusChanged:count('status_changed'),resultChanged:count('result_changed'),scheduleChanged:count('schedule_changed'),removedFromSource:count('removed_from_source')},transitions};
await fs.mkdir(path.dirname(OUTPUT),{recursive:true});await fs.writeFile(OUTPUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,baseline:result.baseline,counts:result.counts},null,2));if(result.status!=='green')throw new Error('Tennis Europe OOP transition comparison failed');
