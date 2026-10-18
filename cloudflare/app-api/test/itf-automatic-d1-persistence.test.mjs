import test from 'node:test';
import './itf-empty-draw-import.test.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../../../.github/workflows/'+name,import.meta.url),'utf8');
const pipeline=read('courtwatch-v3-itf-t-minus-one.yml');
const sync=read('courtwatch-itf-draw-d1-sync.yml');
const review=pipeline.slice(pipeline.indexOf('  review:\n'),pipeline.indexOf('  continue-ordinary:\n'));
const condition=review.match(/^    if: (.+)$/m)[1].replaceAll('needs.persist-d1','needs["persist-d1"]');
const canPublish=new Function('needs','always','return '+condition);
for(const [label,tasks,persist,expected] of [['D1 import failed','1','failure',false],['D1 verification cancelled','1','cancelled',false],['D1 persistence skipped unexpectedly','1','skipped',false],['D1 verified','1','success',true],['inventory only, no new documents','0','skipped',true]])test(`actual publication guard: ${label}`,()=>{
 assert.equal(canPublish({queue:{result:'success',outputs:{tasks,tournaments:'1'}},'persist-d1':{result:persist}},()=>true),expected);
});
test('zero selected tournaments cannot publish even with D1 success',()=>{
 assert.equal(canPublish({queue:{result:'success',outputs:{tasks:'1',tournaments:'0'}},'persist-d1':{result:'success'}},()=>true),false);
});
test('acquisition passes exact current run and mandatory artifacts to reusable D1 persistence before review',()=>{
 const persist=pipeline.slice(pipeline.indexOf('  persist-d1:\n'),pipeline.indexOf('  review:\n'));
 assert.match(persist,/needs: \[queue, acquire\]/);
 assert.match(persist,/uses: .*courtwatch-itf-draw-d1-sync.yml/);
 assert.match(persist,/run_id:.*github.run_id/);
 assert.match(persist,/require_artifacts: true/);
 assert.match(review,/needs: \[queue, acquire, persist-d1\]/);
 assert.ok(review.indexOf('Persist complete draw documents to R2')<review.indexOf('reconcile-itf-t1-strict-audit'));
});
test('D1 workflow fails on missing mandatory artifacts and verifies content after import',()=>{
 assert.match(sync,/workflow_call:/);
 assert.match(sync,/if \[ "\$REQUIRE_DRAW_ARTIFACTS" = true \]; then[\s\S]*?exit 1/);
 assert.ok(sync.indexOf('wrangler d1 execute')<sync.indexOf('node src/v3/verify-itf-draw-documents-d1.mjs'));
 const triggers=sync.slice(0,sync.indexOf('permissions:'));
 assert.doesNotMatch(triggers,/Court Watch v3 ITF T-1 complete draws/);
 assert.match(sync,/if: always\(\) && steps.download.outputs.has_draws == 'true'/);
});

test('pending-only batches bypass migrations while still producing a content-verification report',()=>{
 const step=sync.slice(sync.indexOf('      - name: Configure, migrate and import D1'),sync.indexOf('      - name: Verify every imported document'));
 assert.match(step,/if: steps.seed.outputs.has_documents == 'true'/);
 assert.match(sync,/id: seed[\s\S]*?node src\/v3\/itf-draw-d1-work-plan.mjs/);
 assert.match(sync,/Verify every imported document[\s\S]*?if: steps.download.outputs.has_draws == 'true'/);
});
