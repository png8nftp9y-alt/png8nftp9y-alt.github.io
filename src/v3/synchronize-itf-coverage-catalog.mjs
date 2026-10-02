import fs from 'node:fs/promises';
import {withCurrentCoverageCatalog} from './itf-incremental-coverage.mjs';
const [input,output=input]=process.argv.slice(2);
if(!input)throw new Error('Coverage audit path required');
const audit=await withCurrentCoverageCatalog(JSON.parse(await fs.readFile(input,'utf8')));
await fs.writeFile(output,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({catalogChecked:audit.tournaments.length,additions:audit.incrementalCatalogIds?.length||0,catalogRejected:audit.catalogRejected||[]}));
