import fs from'node:fs';import os from'node:os';import path from'node:path';import{spawnSync}from'node:child_process';
const[prefix,...pinned]=process.argv.slice(2),bucket=process.env.R2_BUCKET,endpoint=`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,env={...process.env,AWS_DEFAULT_REGION:'auto'};
if(!prefix||!bucket)throw Error('missing R2 prune arguments');
const aws=(a,optional=false)=>{const r=spawnSync('aws',['--endpoint-url',endpoint,...a],{encoding:'utf8',env,maxBuffer:128e6});if(r.status&&!optional)throw Error(r.stderr);return r},keep=new Set(pinned);
for(const slot of['current','backup-1','backup-2']){const r=aws(['s3','cp',`s3://${bucket}/${prefix}/pointers/${slot}.json`,'-','--only-show-errors'],slot!=='current');if(!r.status)keep.add(JSON.parse(r.stdout).generation)}
if(keep.size<1)throw Error('no retained generations; refusing deletion');
const list=()=>JSON.parse(aws(['s3api','list-objects-v2','--bucket',bucket,'--prefix',`${prefix}/generations/`,'--output','json']).stdout||'{}').Contents||[],before=list(),esc=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),gen=k=>String(k).match(new RegExp(`^${esc}/generations/([^/]+)/`))?.[1];
for(const g of keep)if(!before.some(o=>gen(o.Key)===g))throw Error(`retained generation missing: ${g}`);
const remove=before.filter(o=>gen(o.Key)&&!keep.has(gen(o.Key))),dir=fs.mkdtempSync(path.join(os.tmpdir(),'r2-prune-'));
try{for(let i=0;i<remove.length;i+=1000){const f=path.join(dir,`${i}.json`);fs.writeFileSync(f,JSON.stringify({Objects:remove.slice(i,i+1000).map(o=>({Key:o.Key})),Quiet:true}));aws(['s3api','delete-objects','--bucket',bucket,'--delete',`file://${f}`])}}finally{fs.rmSync(dir,{recursive:true,force:true})}
const after=list();if(after.some(o=>gen(o.Key)&&!keep.has(gen(o.Key))))throw Error('obsolete objects remain');for(const g of keep)if(!after.some(o=>gen(o.Key)===g))throw Error(`retained generation lost: ${g}`);
console.log('R2_PRUNE '+JSON.stringify({prefix,kept:[...keep].length,deletedObjects:remove.length,deletedBytes:remove.reduce((s,o)=>s+Number(o.Size||0),0)}));
