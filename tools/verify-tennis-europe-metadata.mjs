import assert from 'node:assert/strict';
import {applyTennisEuropeDesignations,tennisEuropeDesignationIndex,tennisEuropeParticipant,tennisEuropeCourtConditions} from '../src/v3/tennis-europe-metadata.mjs';

const participant=(body,attributes='')=>tennisEuropeParticipant(`<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1" ${attributes}><span class="nav-link__value">${body}</span></a>`);

assert.deepEqual(participant('Mario Rossi [3]'),{id:'p1',name:'Mario Rossi',nationality:'ITA',designation:'3',seed:3,entryType:'',href:'/player/p1'});
assert.equal(tennisEuropeParticipant('<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1"><span class="nav-link__value">Mario Rossi</span><span class="badge">(WC)</span></a>').entryType,'WC');
assert.equal(tennisEuropeParticipant('<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1"><span class="nav-link__value">Mario Rossi</span><small>[Q]</small></a>').entryType,'Q');
assert.equal(tennisEuropeParticipant('<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1"><span class="nav-link__value">Mario Rossi</span><small>[LL]</small></a>').entryType,'LL');
assert.equal(participant('Mario Rossi','data-seed="8"').seed,8);
assert.equal(participant('Mario Rossi').designation,'');

assert.deepEqual(tennisEuropeCourtConditions('<table><tr><th>Surface</th><td>Clay - Outdoor</td></tr></table>'),{surface:'Clay',environment:'Outdoor',indoorOutdoor:'Outdoor'});
assert.deepEqual(tennisEuropeCourtConditions('<dl><dt>Playing surface</dt><dd>Hard</dd><dt>Indoor/Outdoor</dt><dd>Indoor</dd></dl>'),{surface:'Hard',environment:'Indoor',indoorOutdoor:'Indoor'});
assert.deepEqual(tennisEuropeCourtConditions('<p>Court surface: Artificial clay</p><p>Environment: Outdoor</p>'),{surface:'Artificial clay',environment:'Outdoor',indoorOutdoor:'Outdoor'});
assert.deepEqual(tennisEuropeCourtConditions('<svg class="icon-court"></svg><span class="nav-link__value">Acryllic</span><li><label class="caption readonly">Location type:</label><label class="text readonly">Indoors</label></li>'),{surface:'Hard',environment:'Indoor',indoorOutdoor:'Indoor'});

const designationIndex=tennisEuropeDesignationIndex('<table class="ruler seeding"><tr><th><a>BS16 - Main Draw</a></th></tr><tr><td>3</td><td><a href="player.aspx?player=7">Mario Rossi</a></td></tr></table>','<table><tr><th>Main</th><th>positions</th></tr><tr><td>19 (Q)</td><td>[ITA] Luigi Bianchi</td></tr><tr><td>29 (WC)</td><td>Paolo Verdi</td></tr></table>');
const matches=[{event:'BS16',players:[{name:'Mario Rossi'},{name:'Luigi Bianchi'},{name:'Paolo Verdi'}]}];
applyTennisEuropeDesignations(matches,designationIndex);
assert.deepEqual(matches[0].players.map(player=>player.designation),['3','Q','WC']);

const completeIndex=tennisEuropeDesignationIndex('<table><tr><th>GS14 - Main Draw</th></tr><tr><td>2</td><td><a data-player-id="m1">Maria Main</a></td></tr></table><table><tr><th>GS14 - Qualifying</th></tr><tr><td>5</td><td><a data-player-id="q1">Quarta Quali</a></td></tr></table>','<table><tr><th>Main</th></tr><tr><td>17</td><td>[ITA]</td><td><a data-player-id="w1">Wanda Card</a></td><td>Main Draw Wildcard</td></tr><tr><td>18 (LL)</td><td>[ITA]</td><td><a data-player-id="l1">Lucia Loser</a></td></tr><tr><td>19 (Q)</td><td>[ITA]</td><td><a data-player-id="q2">Quirina Qualificata</a></td></tr></table>');
const completeMatches=[{event:'GS14 - Main Draw',round:'R32',players:[{name:'Maria Main'},{name:'Wanda Card'},{name:'Lucia Loser'},{name:'Quirina Qualificata'}]},{event:'GS14 - Qualifying',round:'Qualifying R1',players:[{name:'Quarta Quali'}]}];
applyTennisEuropeDesignations(completeMatches,completeIndex);
assert.deepEqual(completeMatches[0].players.map(player=>player.designation),['2','WC','LL','Q']);
assert.equal(completeMatches[1].players[0].designation,'5');

const drawIndex=tennisEuropeDesignationIndex('','',[
  {event:'GS14 - Main Draw',url:'https://example.test/main',html:'<div><a data-player-id="d1" href="/player-profile/d1"><span class="nav-link__value">Seed Main</span></a> [4]</div><div><a data-player-id="d2" href="/player-profile/d2"><span class="nav-link__value">Qualificata Draw</span></a> (Q)</div><div><a data-player-id="d3" href="/player-profile/d3"><span class="nav-link__value">Wild Draw</span></a> [WC]</div><div><a data-player-id="d4" href="/player-profile/d4"><span class="nav-link__value">Lucky Draw</span></a> [LL]</div>'},
  {event:'GS14 - Qualifying',url:'https://example.test/qualifying',html:'<div><a data-player-id="dq" href="/player-profile/dq"><span class="nav-link__value">Seed Quali</span></a> [7]</div>'},
]);
const drawMatches=[{event:'GS14 - Main Draw',round:'R32',players:[{name:'Seed Main'},{name:'Qualificata Draw'},{name:'Wild Draw'},{name:'Lucky Draw'}]},{event:'GS14 - Qualifying',round:'Qualifying R1',players:[{name:'Seed Quali'}]}];
applyTennisEuropeDesignations(drawMatches,drawIndex);
assert.deepEqual(drawMatches[0].players.map(player=>player.designation),['4','Q','WC','LL']);
assert.equal(drawMatches[1].players[0].designation,'7');

console.log('Tennis Europe metadata verification passed');
