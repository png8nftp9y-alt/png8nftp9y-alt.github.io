import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
export function database(){
 const directory=mkdtempSync(path.join(tmpdir(),'cw-search-')),file=path.join(directory,'db.sqlite');
 const run=body=>{const r=spawnSync('python3',['-c',`import json,sqlite3,sys\np=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row\nrows=[]\nwith c:\n if 'schema' in p:c.executescript(p['schema'])\n for s in p.get('statements',[]):\n  cursor=c.execute(s['sql'],s.get('values',[]));rows=[dict(x) for x in cursor.fetchall()] if cursor.description else []\nprint(json.dumps({'rows':rows,'writes':c.total_changes}))`],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)};
 const names=['0001_universal_schema.sql','0002_app_compatibility.sql','0004_observed_players.sql','0005_user_control_foundation.sql','0006_tennis_europe_oop.sql','0024_user_player_removals.sql','0025_itf_draw_documents.sql','0027_user_player_additions.sql','0028_acquired_player_search.sql'];
 run({schema:names.map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n')});
 let writes=0;const execute=(sql,values=[])=>{const r=run({statements:[{sql,values}]});writes+=r.writes;return r.rows};
 const db={prepare(sql){return {bind(...values){return {all:async()=>({results:execute(sql,values)}),first:async()=>execute(sql,values)[0]||null}},all:async()=>({results:execute(sql)}),first:async()=>execute(sql)[0]||null}},batch:async statements=>run({statements})};
 // Split only statement boundaries; semicolons inside quoted source payloads are preserved.
 const query=async sql=>{const statements=sql.match(/(?:[^';]|'(?:''|[^'])*')+;?/g).filter(x=>x.trim()).map(x=>({sql:x.replace(/;$/,''),values:[]}));const r=run({statements});writes+=r.writes;return r.rows};
 return {db,execute,query,writes:()=>writes,close:()=>rmSync(directory,{recursive:true,force:true})};
}
