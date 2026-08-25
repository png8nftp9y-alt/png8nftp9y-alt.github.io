import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {NOW,readJson,tournamentEvents,drawsheet,playerFromApi} from './itf-common.mjs';
const id=String(process.env.ITF_COMPETITION_ID||'').trim(),wanted=String(process.env.ITF_EVENT_KEY||'').trim();
if(!id||!wanted)throw new Error('ITF_COMPETITION_ID_and_ITF_EVENT_KEY_required');
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]}),t=(map.tournaments||[]).find(x=>x.competitionId===id);if(!t)throw new Error('tournament_not_found');
const key=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
const combos=await tournamentEvents(t),c=combos.find(x=>key(x)===wanted);if(!c)throw new Error('event_not_returned');
const json=await drawsheet(c),names=[];for(const group of[...(json.koGroups||[]),...(json.rrGroups||[])])for(const round of group.rounds||group.matchesByRound||[])for(const m of round.matches||[])for(const team of m.teams||[])for(const raw of team.players||[]){const p=playerFromApi(raw);if(p.name)names.push(p.name)}
const out={version:1,generatedAt:NOW,status:'complete',competitionId:id,event:wanted,playerNames:[...new Set(names)]};await fs.mkdir('dist/v3',{recursive:true});await fs.writeFile('dist/v3/itf_event_proof.json.gz',gzipSync(JSON.stringify(out)));console.log(JSON.stringify({competitionId:id,event:wanted,players:out.playerNames.length,status:out.status}));
