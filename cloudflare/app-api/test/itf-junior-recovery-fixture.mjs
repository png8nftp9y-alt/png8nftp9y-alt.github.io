import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
export function database(){
 const dir=mkdtempSync(join(tmpdir(),'cw-itf-retry-')),file=join(dir,'test.db');
 function sql(body){const result=spawnSync('python3',['-c',`import json,sqlite3,sys
p=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
with c:
 if 'script' in p:c.executescript(p['script'])
 rows=[dict(r) for r in c.execute(p['query'],p.get('params',[]))] if 'query' in p else []
print(json.dumps({'rows':rows,'changes':c.total_changes}))`],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
 sql({script:readFileSync(new URL('../lib/itf-junior-ranking-schema.sql',import.meta.url),'utf8')});
 return {query:async(query,params=[])=>sql({query,params}).rows,execute:async statements=>sql({script:statements.join('\n')}),close:()=>rmSync(dir,{recursive:true,force:true})};
}
