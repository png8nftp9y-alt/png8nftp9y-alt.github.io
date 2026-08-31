import fs from 'node:fs/promises';

const [mode,currentFile,incomingFile,outputFile]=process.argv.slice(2);
if(!['acceptance','t-minus-one'].includes(mode)||!currentFile||!incomingFile||!outputFile){
  throw new Error('Usage: merge-itf-draw-target-ownership.mjs acceptance|t-minus-one current.json incoming.json output.json');
}
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [current,incoming]=await Promise.all([read(currentFile),read(incomingFile)]);
if(typeof current.targets!=='object'||typeof current.tournaments!=='object'||typeof incoming.targets!=='object'||typeof incoming.tournaments!=='object'){
  throw new Error('Invalid ITF draw target state');
}
const targets=mode==='acceptance'?incoming.targets:current.targets;
const tournaments=mode==='t-minus-one'?incoming.tournaments:current.tournaments;
const merged={...current,...incoming,targets,tournaments,targetCount:Object.keys(targets).length};
await fs.writeFile(outputFile,JSON.stringify(merged,null,2)+'\n');
console.log(JSON.stringify({status:'green',mode,targets:Object.keys(targets).length,tournaments:Object.keys(tournaments).length}));
