import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';import {paginatedPlayerSearch} from '../lib/paginated-player-search.mjs';
const migration=fs.readFileSync(new URL('../migrations/0036_restore_known_busa_search.sql',import.meta.url),'utf8');
test('known Busa identity is searchable without adding any membership; repeat has zero writes',async()=>{const d=database();try{
 await d.query(migration);const before=d.writes();await d.query(migration);assert.equal(d.writes(),before);
 for(const q of ['Busa','Martina Busa','Busa Martina']){const p=await paginatedPlayerSearch(d.db,q,null);assert.equal(p.results.length,1);assert.equal(p.results[0].sourceKey,'fitp|id:6562748855');}
 assert.equal(d.execute('SELECT COUNT(*) n FROM user_app_other_players')[0].n,0);
}finally{d.close()}});
