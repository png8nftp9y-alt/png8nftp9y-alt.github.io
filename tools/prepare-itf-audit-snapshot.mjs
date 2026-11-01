// One native D1 export; no custom polling, retries, remote writes or raw-data artifacts.
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const dir=path.join(process.env.RUNNER_TEMP||'/tmp','courtwatch-itf-audit-snapshot');await fs.mkdir(dir,{recursive:true,mode:0o700});
const startedAt=new Date().toISOString(),account=process.env.CLOUDFLARE_ACCOUNT_ID,id=process.env.CLOUDFLARE_D1_DATABASE_ID;
if(!account||!process.env.CLOUDFLARE_API_TOKEN||!id||!process.env.R2_BUCKET||!process.env.R2_ACCOUNT_ID)throw Error('snapshot_credentials_missing');
const r2=key=>execFileSync('aws',['s3','cp',`s3://${process.env.R2_BUCKET}/${key}`,'-','--endpoint-url',`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`],{maxBuffer:100*1024*1024,stdio:['ignore','pipe','pipe']});
const pointer=r2('itf/database/pointers/current.json'),coverage=r2('itf/audits/official-draw-parity/coverage-v3-current.json');
const generation=JSON.parse(pointer).generation;if(!/^[A-Za-z0-9_.-]+$/.test(generation||''))throw Error('snapshot_invalid_itf_generation');
await fs.writeFile(path.join(dir,'pointer.json'),pointer);await fs.writeFile(path.join(dir,'coverage.json'),coverage);
const sql=path.join(dir,'database.sql'),database=path.join(dir,'database.sqlite'),config=path.join(dir,'wrangler.json');
await fs.writeFile(config,JSON.stringify({name:'courtwatch-readonly-audit',compatibility_date:'2026-10-01',d1_databases:[{binding:'DB',database_name:'courtwatch-app',database_id:id}]}));
try{execFileSync(path.resolve('cloudflare/app-api/node_modules/.bin/wrangler'),['d1','export','courtwatch-app','--remote','--config',config,'--output',sql],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe'],maxBuffer:10*1024*1024,timeout:600000});}catch{throw Error('audit_native_d1_export_failed_no_retry');}
const exportedAt=new Date().toISOString();
execFileSync('python3',['-c',"import sqlite3,sys; c=sqlite3.connect(sys.argv[2]); c.executescript(open(sys.argv[1]).read()); assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'; c.close()",sql,database],{stdio:['ignore','pipe','pipe'],timeout:600000});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={version:1,scope:'frozen_input_comparison_not_current_live_state',captureStartedAt:startedAt,d1ExportFinishedAt:exportedAt,preparedAt:new Date().toISOString(),itfGeneration:generation,pointerSha256:sha(pointer),coverageSha256:sha(coverage),databaseSha256:sha(await fs.readFile(database)),remoteReadCost:'native_export_cost_not_measured_by_audit'};
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));
if(process.env.GITHUB_ENV)await fs.appendFile(process.env.GITHUB_ENV,`ITF_AUDIT_FROZEN_DIR=${dir}\n`);
console.log('ITF_AUDIT_SNAPSHOT='+JSON.stringify(manifest));
