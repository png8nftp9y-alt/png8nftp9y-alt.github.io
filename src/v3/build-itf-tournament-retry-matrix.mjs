import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const dir='dist/v3/shards/itf',offset=Math.max(0,Number(process.env.ITF_BATCH_OFFSET||0)),limit=Math.max(1,Math.min(256,Number(process.env.ITF_BATCH_LIMIT||16))),ids=new Set();
for(const file of await fs.readdir(dir))if(/^results-\d+\.json\.gz$/.test(file)){const d=JSON.parse(gunzipSync(await fs.readFile(`${dir}/${file}`)));for(const item of d.retryQueue||[])if(item.competitionId)ids.add(item.competitionId)}
const all=[...ids].sort(),selected=all.slice(offset,offset+limit),matrix={competitionId:selected};
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nremaining_tournaments=${all.length}\nselected_tournaments=${selected.length}\n`);
console.log(JSON.stringify({remainingTournaments:all.length,offset,limit,selectedTournaments:selected.length,matrix},null,2));
