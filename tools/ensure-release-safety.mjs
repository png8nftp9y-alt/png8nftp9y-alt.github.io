import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {releaseCodeFingerprint} from './release-code-fingerprint.mjs';
import {runReleaseSafety} from './run-release-safety.mjs';
// Never publish a newly checked-out revision using another revision's approval.
export function ensureReleaseSafety(expected,{root=process.cwd(),fingerprint=()=>releaseCodeFingerprint(root),run=(command,args)=>execFileSync(command,args,{cwd:root,stdio:'inherit'}),verify=()=>runReleaseSafety('all',{root})}={}){
 if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('invalid_expected_release_fingerprint');
 const actual=fingerprint();
 if(actual===expected)return {rechecked:false,codeFingerprint:actual};
 console.log('Release code advanced during queue wait; running required checks for '+actual);
 run('npm',['--prefix','cloudflare/app-api','run','check']);
 run('npm',['ci','--no-audit','--no-fund']);
 run('npx',['playwright','install','--with-deps','chromium']);
 verify();
 if(fingerprint()!==actual)throw Error('release_code_changed_during_required_checks');
 return {rechecked:true,codeFingerprint:actual};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const i=process.argv.indexOf('--expect'),result=ensureReleaseSafety(i<0?'':process.argv[i+1]);
 if(process.env.GITHUB_ENV){fs.appendFileSync(process.env.GITHUB_ENV,'COURTWATCH_APPROVED_FINGERPRINT='+result.codeFingerprint+'\n'+(result.rechecked?'COURTWATCH_RELEASE_RECHECKED=true\n':''));}
 console.log('RELEASE_SAFETY_GATE='+JSON.stringify(result));
}
