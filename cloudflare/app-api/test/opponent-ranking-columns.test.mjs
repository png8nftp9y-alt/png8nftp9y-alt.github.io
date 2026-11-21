import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
function view(profile){
 const node={textContent:'',hidden:true};
 const ctx=vm.createContext({Date,Number,String,esc:x=>String(x),displayDate:x=>x,
  opponentHistoryProjection:x=>x,$:id=>id==='opponentProfileRanking'?node:null});
 const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 vm.runInContext(slice('const itfRankingText =','const teRankHtml =')+
 slice('function opponentFitpRankingText(','function opponentHistoryKey('),ctx);
 ctx.renderOpponentHistory({fitpMetadata:{ranking:'2.7'},profile,tournaments:[]});
 return node;
}
const profile={ranking:51,category:'U14',ranking_date:'2026-11-16',
 itfJuniorRanking:{ranking:1200,rankingDate:'2026-11-09'}};
test('opponent columns are FITP, Europe, ITF with one explicitly shared latest date',()=>{
 assert.equal(view(profile).textContent,
 '2.7 FITP\nn°51 TE U14\nn°1200 ITF Junior\n(ranking Europe e ITF del 2026-11-16)'.replaceAll('\\n','\n'));
});
test('ten days inclusive shares latest date in either direction; eleven days keeps two dates',()=>{
 for(const [te,itf] of [['2026-11-19','2026-11-09'],['2026-11-09','2026-11-19']]){
  const text=view({...profile,ranking_date:te,itfJuniorRanking:{ranking:1200,rankingDate:itf}}).textContent;
  assert.match(text,/ranking Europe e ITF del 2026-11-19/);
  assert.equal((text.match(/ranking /g)||[]).length,1);
 }
 const text=view({...profile,ranking_date:'2026-11-20'}).textContent;
 assert.doesNotMatch(text,/ranking Europe e ITF/);
 assert.match(text,/TE U14 · \(ranking del 2026-11-20\)/);
 assert.match(text,/ITF Junior · \(ranking del 2026-11-09\)/);
});
test('missing ranking or date never claims a shared date',()=>{
 for(const change of [{ranking:null},{ranking_date:null},{itfJuniorRanking:{status:'unranked'}},
 {itfJuniorRanking:{ranking:1200}},{ranking_date:'invalid'}]){
  assert.doesNotMatch(view({...profile,...change}).textContent,/ranking Europe e ITF/);
 }
});

test('shared date is alongside a pair containing Europe and ITF',()=>{
 const node=view(profile);
 assert.match(node.innerHTML, /class="opponentRankingShared"/);
 assert.ok(node.innerHTML.indexOf('opponentRankingPair') < node.innerHTML.indexOf('n°51 TE U14'));
 assert.ok(node.innerHTML.indexOf('n°1200 ITF Junior') < node.innerHTML.indexOf('opponentRankingSharedDate'));
});
