import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const UNIVERSAL_GIT_FILES=['dist/v3/universal/tournaments.json','dist/v3/universal/matches.json','dist/v3/universal/results.json'];
// Leave headroom below GitHub's 100 MiB hard limit; never discard archive rows.
export const UNIVERSAL_GIT_MAX_BYTES=95*1024*1024;
export async function compactUniversalGitFiles(root='.',maxBytes=UNIVERSAL_GIT_MAX_BYTES){
 const prepared=[];
 for(const relative of UNIVERSAL_GIT_FILES){
  const file=path.join(root,relative),original=await fs.readFile(file);
  const value=JSON.parse(original.toString('utf8')),key=path.basename(file,'.json');
  if(!value||Array.isArray(value)||typeof value!=='object'||!Array.isArray(value[key]))throw new Error('Invalid universal archive: '+relative);
  const content=JSON.stringify(value)+'\n',bytes=Buffer.byteLength(content);
  if(bytes>=maxBytes)throw new Error(`Universal archive too large for Git: ${relative} (${bytes} bytes after lossless compaction; limit ${maxBytes}). Preserve the complete archive and migrate storage before publishing.`);
  prepared.push({file,relative,original,content,bytes,records:value[key].length});
 }
 // Validate every archive before writing any of them.
 for(const item of prepared){
  if(item.original.equals(Buffer.from(item.content)))continue;
  const temporary=item.file+'.compact-'+process.pid;
  try{await fs.writeFile(temporary,item.content);await fs.rename(temporary,item.file)}
  finally{await fs.rm(temporary,{force:true})}
 }
 const summary=prepared.map(({relative,original,bytes,records})=>({file:relative,beforeBytes:original.length,afterBytes:bytes,records}));
 console.log('UNIVERSAL_GIT_COMPACTION='+JSON.stringify(summary));
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await compactUniversalGitFiles();
