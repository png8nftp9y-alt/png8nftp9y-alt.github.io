import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function releaseCodePath(file){
 return /^(?:v3\.(?:js|css|html)$|flags\/|cloudflare\/|infra\/|src\/|tools\/|\.github\/|\.courtwatch\/|package(?:-lock)?\.json$|[^/]+\.mjs$)/.test(file)
  && !file.startsWith('.courtwatch/release-safety-cache/');
}
export function releaseCodeFingerprint(root=process.cwd()){
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(releaseCodePath).sort();
 if(!files.includes('v3.js')||!files.includes('cloudflare/app-api/src/index.js'))throw Error('release_code_scope_incomplete');
 const hash=createHash('sha256').update('courtwatch-release-safety-v1\0');
 for(const file of files){const content=fs.readFileSync(path.join(root,file));hash.update(file+'\0'+content.length+'\0').update(content);}
 return hash.digest('hex');
}
export function verifyCertificate(directory,fingerprint){
 const value=JSON.parse(fs.readFileSync(path.join(directory,'verified.json'),'utf8'));
 if(value.version!==1||value.passed!==true||value.fingerprint!==fingerprint)throw Error('release_certificate_invalid');
 return value;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const fingerprint=releaseCodeFingerprint();
 const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
 const expected=option('--expect');if(expected&&fingerprint!==expected)throw Error('Deployment blocked: app code changed after Shield approval; a new code approval is required.');
 const verify=option('--verify-certificate');if(verify)verifyCertificate(verify,fingerprint);
 const save=option('--write-certificate');if(save){fs.mkdirSync(save,{recursive:true});fs.writeFileSync(path.join(save,'verified.json'),JSON.stringify({version:1,passed:true,fingerprint})+'\n');}
 if(process.argv.includes('--github-output')){if(!process.env.GITHUB_OUTPUT)throw Error('github_output_unavailable');fs.appendFileSync(process.env.GITHUB_OUTPUT,'code_fingerprint='+fingerprint+'\n');}
 console.log('RELEASE_CODE_FINGERPRINT='+fingerprint);
}
