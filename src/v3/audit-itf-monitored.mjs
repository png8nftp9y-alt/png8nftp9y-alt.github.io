import fs from 'node:fs/promises';
import {API,aliases,norm,readJson,request,writeJson} from './itf-common.mjs';

const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const former=new Set(((await readJson('former-players.json',{players:[]})).players||[]).map(p=>p.id));
const monitored=((await readJson('players.json',{players:[]})).players||[]).filter(p=>!former.has(p.id));
const concurrency=Math.max(1,Number(process.env.ITF_AUDIT_CONCURRENCY||2));
const delay=Math.max(100,Number(process.env.ITF_AUDIT_DELAY_MS||700));
const rows=[],errors=[];let cursor=0,checked=0,published=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function parse(json,t){for(const gender of Array.isArray(json)?json:[])for(const group of gender.entryClassifications||[]){const raw=String(group.entryClassificationCode||'').toUpperCase(),code=raw==='M'?'MD':raw==='Q'?'Q':raw==='A'?'A':'';if(!code)continue;for(const entry of group.entries||[])for(const p of entry.players||[]){const name=[p?.givenName,p?.familyName].filter(Boolean).join(' ').trim();if(!name)continue;const hit=monitored.find(x=>aliases(x).some(a=>norm(name)===a));if(hit)rows.push({playerId:hit.id,playerName:hit.name,competitionId:t.competitionId,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate,location:t.location,category:t.category,acceptanceCode:code,acceptancePosition:Number(entry.positionDisplay)||null,worldTennisId:String(p.playerId||''),sourceUrl:t.sourceUrl})}}}
async function fetchList(t){const url=`${API}/GetAcceptanceList?tournamentKey=${encodeURIComponent(t.competitionId.toLowerCase())}&circuitCode=JT`;for(let attempt=0;attempt<4;attempt++){const r=await request(url);if(r.ok&&r.json)return r.json;await sleep(2500*(attempt+1)+Math.random()*1000)}throw new Error('official_acceptance_unreadable_after_retries')}
async function worker(){while(true){const i=cursor++;if(i>=map.tournaments.length)return;const t=map.tournaments[i];try{const json=await fetchList(t);if(Array.isArray(json)&&json.length)published++;parse(json,t)}catch(e){errors.push({competitionId:t.competitionId,error:e.message})}checked++;if(checked%25===0)console.log(JSON.stringify({checked,total:map.tournaments.length,published,matches:rows.length,errors:errors.length}));await sleep(delay+Math.random()*delay)}}
await Promise.all(Array.from({length:concurrency},worker));
const unique=[...new Map(rows.map(x=>[[x.playerId,x.competitionId].join('|'),x])).values()].sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.playerName.localeCompare(b.playerName));
const tournaments=[...new Set(unique.map(x=>x.competitionId))];
const byPlayer=Object.fromEntries(monitored.map(p=>[p.name,{tournaments:new Set(),entries:[]} ]));for(const x of unique){byPlayer[x.playerName].tournaments.add(x.competitionId);byPlayer[x.playerName].entries.push(x)}for(const v of Object.values(byPlayer))v.tournaments=v.tournaments.size;
const out={generatedAt:new Date().toISOString(),status:errors.length?'incomplete':'complete',coverageFrom:map.coverageFrom||'2025-12-18',tournamentsChecked:checked,acceptanceListsPublished:published,distinctTournamentsWithMonitoredPlayers:tournaments.length,entryCount:unique.length,byPlayer,entries:unique,errors};
await writeJson('dist/v3/itf_monitored_players_audit.json',out);console.log(JSON.stringify({...out,entries:undefined,errors:errors.slice(0,20)},null,2));if(errors.length)process.exitCode=2;
