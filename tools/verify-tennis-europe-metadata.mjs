import assert from 'node:assert/strict';
import {applyTennisEuropeDesignations,tennisEuropeDesignationIndex,tennisEuropeParticipant,tennisEuropeCourtConditions} from '../src/v3/tennis-europe-metadata.mjs';

const participant=(body,attributes='')=>tennisEuropeParticipant(`<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1" ${attributes}><span class="nav-link__value">${body}</span></a>`);

assert.deepEqual(participant('Mario Rossi [3]'),{id:'p1',name:'Mario Rossi',nationality:'ITA',designation:'3',seed:3,entryType:'',href:'/player/p1'});
assert.equal(tennisEuropeParticipant('<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1"><span class="nav-link__value">Mario Rossi</span><span class="badge">(WC)</span></a>').entryType,'WC');
assert.equal(tennisEuropeParticipant('<a data-player-id="p1" data-nationality-id="ITA" href="/player/p1"><span class="nav-link__value">Mario Rossi</span><small>[Q]</small></a>').entryType,'Q');
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

console.log('Tennis Europe metadata verification passed');
