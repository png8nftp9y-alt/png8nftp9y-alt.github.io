import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
export function openFrozenAuditD1(databasePath){
 const fingerprint=createHash('sha256').update(fs.readFileSync(databasePath)).digest('hex');
 const sqlite=new DatabaseSync(databasePath,{readOnly:true});
 if(sqlite.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'){sqlite.close();throw Error('audit_snapshot_integrity_failed');}
 const metrics={localQueries:0,localRowsReturned:0};
 const client=createReadOnlyD1Client(async(sql,params=[])=>{const rows=sqlite.prepare(sql).all(...params);metrics.localQueries++;metrics.localRowsReturned+=rows.length;return rows;});
 return{...client,metrics,fingerprint,close(){sqlite.close();}};
}
