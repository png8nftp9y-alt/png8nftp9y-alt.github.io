import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {officialRetirement,auditRetirements} from './tennis-europe-retirement.mjs';
import {parseDrawWalkovers} from './tennis-europe-draw-walkovers.mjs';
const msg=label=>`<span class="tag--warning tag match__message">${label}</span>`;
test('only match-local explicit retirement messages establish retirement; W/O/default and names do not',()=>{
 for(const label of ['Retired','Ret.','RET','Retirement'])assert.equal(officialRetirement(msg(label),'official').retired,true);
 for(const html of [msg('Walkover'),msg('Disqualified'),'<a>Retired Player</a>','<script>Retired</script>','<div>Retired</div>',msg('Scheduled')])assert.equal(officialRetirement(html).retired,false);
});
const block=(label='',won=1)=>`<li class="match-group__item"><div class="match-group__subheader">1. Starting at 10:00</div><div class="match match--list"><a href="/tournament/T/draw/1"><span class="nav-link__value">BS14 - Boys Singles 14 Main Draw</span></a><span title="Final" class="nav-link"></span><div class="match__row ${won===0?'has-won':''}"><a data-player-id="1">Alpha</a></div><div class="match__row ${won===1?'has-won':''}"><a data-player-id="2">Beta</a></div><ul class="points"><li>6</li><li>0</li></ul><ul class="points"><li>3</li><li>0</li></ul>${msg(label)}</div></li>`;
test('every real OOP parser retains the official message and official winner even when trailing',async()=>{
 for(const name of ['run-tennis-europe-oop-live','backfill-tennis-europe-oop-shard','recover-tennis-europe-oop-shard','recover-tennis-europe-empty','tennis-europe-coverage-network','prove-tennis-europe-oop-parser']){
  const source=await fs.readFile(new URL('./'+name+'.mjs',import.meta.url),'utf8');const code=source.split('\n').find(l=>l.startsWith('function parsePage('));assert.ok(code,name);
  const clean=s=>String(s).replace(/<[^>]+>/g,'').trim();
  const ctx={officialRetirement,BASE:'https://te.tournamentsoftware.com',URL,clean,attr:(tag,key)=>tag.match(new RegExp(key+'=["\']([^"\']*)'))?.[1]||'',player:html=>({id:html.match(/data-player-id="(\d+)"/)?.[1],name:clean(html)}),positiveMatchNumber:Number,officialSchedule:()=>({courtMatchNumber:1}),scoreWinner:()=>0,annotateRelativeSchedule:x=>x};
  const parse=vm.runInNewContext(code+';parsePage',ctx);const retired=parse(block('Retired'), 'T','20260101')[0];assert.equal(retired.retired,true,name);assert.equal(retired.winnerTeamIndex,1,name);assert.equal(retired.retirementSourceUrl,'https://te.tournamentsoftware.com/tournament/T/matches/20260101');
  assert.equal(parse(block(), 'T','20260101')[0].retired,false,name);
 }
});
test('draw retirement enriches the same OOP match; missing OOP record is an explicit unresolved issue',()=>{
 const known={id:'oop',competitionId:'T',event:'BS14 - Boys Singles 14 Main Draw',round:'Final',players:[{id:'1',name:'Alpha'},{id:'2',name:'Beta'}],teams:[['1'],['2']],score:'6-0 3-0',date:'2026-01-01'};
 const html='<div class="js-bracket"><div class="js-subheading">Final</div><swiper-slide>'+block('Retired')+'</swiper-slide></div>';
 const args={html,event:known.event,competitionId:'T',drawId:'1',sourceUrl:'https://te.tournamentsoftware.com/tournament/T/draw/1'};
 parseDrawWalkovers({...args,knownMatches:[known]});assert.equal(known.retired,true);assert.equal(known.winnerTeamIndex,1);assert.equal(known.score,'6-0 3-0');
 assert(parseDrawWalkovers(args).issues.some(i=>i.reason==='official_retirement_not_in_oop'));
});
test('audit never certifies legacy data without a source check, and rejects retirement without winner',()=>{
 assert.equal(auditRetirements({matches:[{id:'legacy'}]}).status,'incomplete');
 const m={id:'ret',...officialRetirement(msg('Retired'),'official'),status:'completed',winnerPlayerIds:['1']};assert.equal(auditRetirements({matches:[m]}).status,'checked');
 assert.equal(auditRetirements({matches:[{...m,winnerPlayerIds:[]}]}).invalid.length,1);
});
