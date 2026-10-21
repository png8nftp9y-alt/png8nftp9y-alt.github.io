import {readVerificationCounts} from '../lib/d1-verification-counts.mjs';
import {readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import {cliD1Query} from '../lib/d1-cli-query.mjs';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [oop,candidates]=await Promise.all([
  read('seed-tennis-europe-oop/manifest.json'),
  read('seed-tennis-europe-oop/app-match-candidates-manifest.json')
]);
if(oop.status!=='green'||candidates.status!=='green'||candidates.publishedToAgenda!==true)throw new Error('Tennis Europe manifests are not publishable');
const expected={
  teOopTournaments:Number(oop.counts.tournaments),
  teMatches:Number(oop.counts.matches)+Number(candidates.counts.manualParentMatches||0),
  teSchedules:Number(oop.counts.matches),
  teResults:Number(oop.counts.completed),
  tePlayers:Number(oop.counts.players),
  teParticipants:Number(oop.counts.participants),
  candidateRelations:Number(candidates.counts.playerMatchOccurrences),
  candidateUniqueMatches:Number(candidates.counts.uniqueMatches),
  appMatches:Number(candidates.counts.playerMatchOccurrences),
  appUniqueMatches:Number(candidates.counts.uniqueMatches),
  appInvalid:0,
  appMissingCourtMatchNumbers:0
};
const counts=await readVerificationCounts(cliD1Query,{version:await readCheckVersion(new URL('../lib/d1-verification-counts.mjs',import.meta.url))});
const checked={value:[counts.value],reused:counts.mode==='incremental',verifiedAt:new Date().toISOString(),cacheSaved:true};
console.log('D1_VERIFICATION_MODE='+counts.mode);
const row=checked.value[0]||{},errors=[];console.log('EUROPE_PARITY_READ_CACHE='+JSON.stringify({reused:checked.reused,verifiedAt:checked.verifiedAt,saved:checked.cacheSaved}));
const incremental=oop.incremental===true||candidates.incremental===true;
for(const [key,value] of Object.entries(expected)){const actual=Number(row[key]);if(key==='appInvalid'||key==='appMissingCourtMatchNumbers'){if(actual!==value)errors.push(`${key}: D1=${actual} expected=${value}`)}else if(incremental?actual<value:actual!==value)errors.push(`${key}: D1=${actual} expected${incremental?'>=':'='}${value}`)}
if(errors.length)throw new Error('Tennis Europe D1 parity failed: '+errors.join('; '));
console.log(JSON.stringify({status:'green',circuit:'tennis-europe',incremental,counts:expected}));
