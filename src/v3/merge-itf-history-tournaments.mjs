import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {TODAY,HISTORY_FROM,readJson,writeJson} from './itf-common.mjs';

const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const expected=(map.tournaments||[]).filter(t=>t.endDate>=HISTORY_FROM&&t.endDate<TODAY);
const dir='dist/v3/shards/itf/history-tournaments',docs=[];
for(const file of await fs.readdir(dir)){if(!file.endsWith('.json.gz'))continue;docs.push(JSON.parse(gunzipSync(await fs.readFile(`${dir}/${file}`))))}
const byId=new Map(docs.map(d=>[d.competitionId,d])),missing=expected.filter(t=>!byId.has(t.competitionId)).map(t=>t.competitionId),incomplete=docs.filter(d=>d.status!=='complete'||(d.retryQueue||[]).length).map(d=>({competitionId:d.competitionId,retries:(d.retryQueue||[]).length}));
const players=[...new Map(docs.flatMap(d=>d.players||[]).map(p=>[p.id||p.name,p])).values()],matches=[...new Map(docs.flatMap(d=>d.matches||[]).map(m=>[m.matchId||[m.competitionId,m.event,m.roundNumber,m.round].join('|'),m])).values()];
await fs.mkdir('dist/v3/shards/itf',{recursive:true});await fs.writeFile('dist/v3/shards/itf/results-0.json.gz',gzipSync(JSON.stringify({version:6,generatedAt:new Date().toISOString(),historicalTMinusOne:true,tournamentsChecked:docs.length,players,matches,retryQueue:docs.flatMap(d=>d.retryQueue||[])})));
const audit={version:1,generatedAt:new Date().toISOString(),status:missing.length||incomplete.length?'itf_history_incomplete':'itf_history_complete',expectedTournaments:expected.length,completedTournaments:docs.length,missing,incomplete,players:players.length,matches:matches.length};await writeJson('dist/v3/itf_history_engine_audit.json',audit);console.log(JSON.stringify(audit,null,2));if(missing.length||incomplete.length)process.exitCode=2;
