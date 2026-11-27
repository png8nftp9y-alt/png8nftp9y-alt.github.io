import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {selectItfMapArtifacts,ITF_MAP_REGIONS} from '../select-itf-map-artifacts.mjs';
const complete=()=>ITF_MAP_REGIONS.map((r,i)=>({name:'itf-tournaments-'+r,id:100+i,created_at:'2026-11-27T03:10:44Z',expired:false}));
test('rerun selects newer Europe and Asia artifacts by creation time, not ID order',()=>{
 const a=complete();a[0]={...a[0],id:15168359411,created_at:'2026-11-27T03:10:40Z'};a[2]={...a[2],id:15168714763,created_at:'2026-11-27T03:10:43Z'};
 a.push({...a[0],id:15168259805,created_at:'2026-11-27T03:12:08Z'},{...a[2],id:15168889774,created_at:'2026-11-27T03:12:01Z'});
 const expected=[15168259805,101,15168889774,103,104];assert.deepEqual(selectItfMapArtifacts(a),expected);assert.deepEqual(selectItfMapArtifacts(a.reverse()),expected);
});
test('missing or expired region blocks selection; unrelated artifacts cannot substitute',()=>{
 const a=complete();a[0].expired=true;a.push({id:999,name:'unrelated',created_at:'2026-11-28T00:00:00Z'});assert.throws(()=>selectItfMapArtifacts(a),/europe/);assert.throws(()=>selectItfMapArtifacts(a.slice(1)),/europe/);
});
test('workflow downloads exactly selected artifact IDs and replaces rerun uploads',()=>{
 const s=readFileSync(new URL('../../.github/workflows/courtwatch-v3-itf-tournaments-sharded.yml',import.meta.url),'utf8');assert.match(s,/artifact-ids: '\$\{\{ steps\.map-artifacts\.outputs\.result \}\}'/);assert.match(s,/overwrite: true/);assert.match(s,/github\.paginate\(github\.rest\.actions\.listWorkflowRunArtifacts/);
});
