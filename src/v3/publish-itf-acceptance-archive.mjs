// R2_WRITE_POLICY: content hashes; unchanged runs write zero objects. No ITF acquisition or D1 access.
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ACCEPTANCE_PREFIX,buildItfAcceptanceArchives,publishItfAcceptanceArchives} from './itf-acceptance-archive.mjs';
const exec=promisify(execFile),bucket=process.env.R2_BUCKET,account=process.env.R2_ACCOUNT_ID;
if(!bucket||!account)throw Error('acceptance_archive_R2_configuration_missing');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cw-itf-acceptance-'));
const aws=(...args)=>exec('aws',['--endpoint-url',`https://${account}.r2.cloudflarestorage.com`,...args],{maxBuffer:1024*1024});
const object=key=>`s3://${bucket}/${key}`;
try{
 let input=process.env.ITF_ACCEPTANCE_CACHE_FILE||'history/itf_participant_cache.json.gz';
 if(process.argv.includes('--restore')){
  const pointer=path.join(directory,'pointer.json');await aws('s3','cp',object('itf/database/pointers/current.json'),pointer,'--only-show-errors');
  const {generation}=JSON.parse(await fs.readFile(pointer));if(!/^[a-f0-9]{64}$/.test(generation||''))throw Error('invalid_itf_database_generation');
  input=path.join(directory,'participants.json.gz');await aws('s3','cp',object(`itf/database/generations/${generation}/itf_participant_cache.json.gz`),input,'--only-show-errors');
 }
 const candidates=buildItfAcceptanceArchives(JSON.parse(gunzipSync(await fs.readFile(input))));
 const report=await publishItfAcceptanceArchives(candidates,{
  bootstrap:process.argv.includes('--bootstrap'),
  async readIndex(){const file=path.join(directory,'index.json');try{await aws('s3','cp',object(ACCEPTANCE_PREFIX+'/index.json'),file,'--only-show-errors');}catch(error){if(/NoSuchKey|\(404\)|Not Found/.test(error.stderr||''))return null;throw Error('acceptance_archive_index_read_failed');}return JSON.parse(await fs.readFile(file));},
  async writeDocument(c){const file=path.join(directory,c.competitionId+'.json');await fs.writeFile(file,c.body);await aws('s3','cp',file,object(c.key),'--content-type','application/json','--only-show-errors');},
  async writeIndex(index){const file=path.join(directory,'updated-index.json');await fs.writeFile(file,JSON.stringify(index));await aws('s3','cp',file,object(ACCEPTANCE_PREFIX+'/index.json'),'--content-type','application/json','--only-show-errors');}
 });
 console.log('ITF_ACCEPTANCE_ARCHIVE='+JSON.stringify(report));
}finally{await fs.rm(directory,{recursive:true,force:true});}
