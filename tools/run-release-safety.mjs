import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// One command list is shared by normal approval and a publisher whose code
// advanced while waiting. A failing check always stops the remaining steps.
export const releaseSafetyCommands={
 local:[
  ['node','--test','tools/courtwatch-refresh-contract.test.mjs','tools/tests/release-safety.test.mjs'],
  ['node','--test','tools/tests/snapshot-match-coverage.test.mjs'],
  ['node','tools/courtwatch-release-guard.mjs'],
  ['node','tools/courtwatch-functional-shield.mjs'],
  ['node','--test','cloudflare/app-api/test/personal-player-read-retry.test.mjs','cloudflare/app-api/test/replay-others-real-snapshot.test.mjs','src/v3/others-independent-loader.test.mjs','src/v3/player-addition-ui.test.mjs','src/v3/calendar-startup.test.mjs','cloudflare/app-api/test/app-snapshot-membership.test.mjs']
 ],
 live:[
  ['node','tools/replay-others-real-snapshot.mjs',{COURTWATCH_REPLAY_GROUP:'main',COURTWATCH_OTHERS_SNAPSHOT_PATH:'/tmp/courtwatch-main-snapshot.json'}],
  ['node','tools/replay-others-real-snapshot.mjs'],
  ['node','tools/verify-others-real-snapshot-browser.mjs'],
  ['node','tools/verify-player-group-release-browser.mjs']
 ]
};
export function runReleaseSafety(phase,{root=process.cwd(),run=(command,args,env)=>execFileSync(command,args,{cwd:root,env:{...process.env,...env},stdio:'inherit'})}={}){
 if(!['local','live','all'].includes(phase))throw Error('invalid_release_safety_phase');
 for(const group of phase==='all'?['local','live']:[phase])for(const [command,...tail]of releaseSafetyCommands[group]){
  const args=[...tail],env=typeof args.at(-1)==='object'?args.pop():{};run(command,args,env);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const i=process.argv.indexOf('--phase');runReleaseSafety(i<0?'all':process.argv[i+1]);}
