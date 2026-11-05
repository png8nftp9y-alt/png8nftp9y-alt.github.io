import fs from 'node:fs/promises';
import {consent,get} from './tennis-europe-coverage-network.mjs';
import {repairMissingDrawResults} from './tennis-europe-draw-result-repair.mjs';
const output='dist/v3/tennis_europe_oop_historical.json',archive=JSON.parse(await fs.readFile(output,'utf8')),coverage=JSON.parse(await fs.readFile('coverage-repair/coverage.json','utf8')),manualMatches=JSON.parse(await fs.readFile('dist/v3/manual_matches.json','utf8')).matches||[];
await consent();
const result=await repairMissingDrawResults({archive,coverage,manualMatches,get,asOf:new Date().toISOString().slice(0,10),coverageRunId:process.env.TE_COVERAGE_RUN_ID});
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.drawResultRecovery,null,2));
