import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {applyReviewedBirthYears} from '../lib/reviewed-player-birth.mjs';
import {openD1} from './sync-fitp-player-metadata.mjs';
// D1_WRITE_POLICY: incremental; applyReviewedBirthYears uses buildIncrementalSyncPlan and verified readback.
export {applyReviewedBirthYears};
async function main(){
 const evidence=JSON.parse(await fs.readFile(new URL('../data/reviewed-player-birth-years.json',import.meta.url),'utf8'));
 const db=await openD1({databaseId:process.env.CLOUDFLARE_D1_DATABASE_ID,initializeSchema:false});
 const report=await applyReviewedBirthYears({...db,evidence});
 await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/reviewed-birth-coverage.json',JSON.stringify(report,null,2)+'\n');
 console.log('REVIEWED_BIRTH_COVERAGE='+JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
