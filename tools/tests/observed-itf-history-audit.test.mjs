import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {inspectObservedItfHistory} from '../lib/observed-itf-history-audit.mjs';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const player=(id,name,native)=>({id,name,worldTennisId:native});
const proof=(id,comp)=>({id,name:'Proof',tournament:{competitionId:comp,name:comp,startDate:'2026-11-01',drawConfirmed:true,event:'G-S-Q-KO'}});
const t=(p,comp,extra={})=>({playerId:p,circuit:'itf',competitionId:comp,startDate:'2026-11-01',endDate:'2026-11-07',entryStatus:'official_draw',...extra});
test('audits every actual observed identity and every recorded tournament across TCL and Altri',()=>{
 const snapshots={main:{group:'main',players:[player('aila','Aila','800754994'),player('richard','Richard','800733188')],tournaments:[t('aila','J-AGNO',{entryStatus:'acceptance_live',acceptanceCode:'A'}),t('richard','J-OTHER')]},others:{group:'others',players:[player('other','Other','800111111')],tournaments:[]}};
 const expected=[proof('800754994','J-AGNO'),proof('800754994','J-SECOND'),proof('800733188','J-OTHER'),proof('800111111','J-THIRD')];
 const before=inspectObservedItfHistory(snapshots,expected,source,{asOf:'2026-11-27'});
 assert.equal(before.missingCount,3);assert.equal(before.missing.filter(e=>e.name==='Aila').length,2);assert.equal(before.missing.filter(e=>e.group==='others').length,1);
 snapshots.main.tournaments=[t('aila','J-AGNO'),t('aila','J-SECOND'),t('richard','J-OTHER')];snapshots.others.tournaments=[t('other','J-THIRD')];
 assert.equal(inspectObservedItfHistory(snapshots,expected,source,{asOf:'2026-11-27'}).status,'complete');
});
test('unknown ITF identities and missing groups cannot be reported as checked',()=>{
 const snapshots={main:{group:'main',players:[{id:'x',name:'X',circuits:['itf']}],tournaments:[]},others:{group:'others',players:[],tournaments:[]}};
 assert.equal(inspectObservedItfHistory(snapshots,[],source).unverified.length,1);delete snapshots.others;assert.throws(()=>inspectObservedItfHistory(snapshots,[],source),/missing_complete/);
});

test('before audit uses actual old eligibility, after audit uses permanent confirmation rule',()=>{
 const old=fs.readFileSync(new URL('../fixtures/itf-profile-eligibility-before-permanent.js',import.meta.url),'utf8');
 const snapshots={main:{group:'main',players:[player('aila','Aila','800754994')],tournaments:[t('aila','J-AGNO',{status:'withdrawn',drawConfirmed:true})]},others:{group:'others',players:[],tournaments:[]}};
 const evidence=[proof('800754994','J-AGNO')];
 assert.equal(inspectObservedItfHistory(snapshots,evidence,old).missingCount,1);
 assert.equal(inspectObservedItfHistory(snapshots,evidence,source).missingCount,0);
});
