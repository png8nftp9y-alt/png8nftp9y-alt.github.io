import test from 'node:test';
import assert from 'node:assert/strict';
import {latestFitpEntryRankings} from './fitp-entry-ranking.mjs';
const card='9879449037';
const row=(ranking,subscriptionDate,extra={})=>({membershipCard:card,ranking,subscriptionDate,...extra});
test('latest dated registration wins regardless of ranking strength or list order',()=>{
 for(const rows of [[row('2.5','2026-10-15'),row('2.6','2026-10-20')],[row('2.6','2026-10-20'),row('2.5','2026-10-15')]])assert.equal(latestFitpEntryRankings({entries:rows},'2026-10-24').get(card).ranking,'2.6');
});
test('Danesi cache and published entries agree; never use capture or tournament dates',()=>{
 const participants=[row('2.6','2026-09-01'),row('2.5','2026-10-15')];
 assert.equal(latestFitpEntryRankings({tournaments:{brescia:{participants}}},'2026-10-24').get(card).ranking,'2.5');
 assert.equal(latestFitpEntryRankings({entries:[row('2.5',null,{subscriptionDates:['2026-10-15']})]},'2026-10-24').get(card).ranking,'2.5');
 assert.equal(latestFitpEntryRankings({entries:[row('2.5',null,{lastSeen:'2026-10-23',startDate:'2026-10-17'})]}).size,0);
});
test('invalid, future, unidentified and conflicting registrations do not guess',()=>{
 const invalid=[row('2.5','2026-02-30'),row('2.5','2099-10-15'),row('bad','2026-10-15'),row('2.5','2026-10-15',{membershipCard:''})];
 assert.equal(latestFitpEntryRankings({entries:invalid},'2026-10-24').size,0);
 assert.equal(latestFitpEntryRankings({entries:[row('2.5','2026-10-15'),row('2.6','2026-10-15')]},'2026-10-24').size,0);
});
