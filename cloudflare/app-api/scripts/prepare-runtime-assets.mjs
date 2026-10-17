import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
export async function prepareRuntimeAssets(target=fileURLToPath(new URL('../runtime-assets/',import.meta.url))){
 const root=fileURLToPath(new URL('../../../',import.meta.url));
 await fs.mkdir(target,{recursive:true});
 for(const name of ['v3.html','v3.js','v3.css'])await fs.copyFile(root+name,join(target,name));
 await fs.cp(root+'flags',join(target,'flags'),{recursive:true,force:true});
 const html=await fs.readFile(join(target,'v3.html'),'utf8'),script=await fs.readFile(join(target,'v3.js'),'utf8');
 if(html.includes('github.io/dist/v3/')||script.includes('const V3 = "https://'))throw Error('External runtime data dependency; asset build blocked');
 return target.endsWith('/')?target:target+'/';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await prepareRuntimeAssets();
