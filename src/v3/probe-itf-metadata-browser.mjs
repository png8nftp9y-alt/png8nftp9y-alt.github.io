import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {browserFactsheet} from './itf-metadata-browser.mjs';
const require=createRequire(new URL('../../infra/itf-acquirer/package.json',import.meta.url));
const {chromium}=require('playwright');
const context=await chromium.launchPersistentContext('',{headless:true,locale:'en-GB',timezoneId:'Europe/Rome'});
const samples=[
 {competitionId:'J-J100-FRA-2026-002',tournamentName:'J100 Balma',sourceUrl:'https://www.itftennis.com/en/tournament/j100-balma/fra/2026/j-j100-fra-2026-002/'}
];
const report={status:'started',tournaments:[]};
try{
 for(const sample of samples){
  const result=await browserFactsheet(context,sample);
  report.tournaments.push({competitionId:sample.competitionId,...result});
  console.log('ITF_METADATA_PROBE='+JSON.stringify(report.tournaments.at(-1)));
 }
 const balma=report.tournaments.find(x=>x.competitionId==='J-J100-FRA-2026-002');
 if(!balma.venueName||!balma.address||balma.qualificationStartDate!=='2026-10-17')throw Error('Live Balma probe did not verify all three official fields');
 report.status='verified';
}catch(error){report.status='failed';report.error=String(error.message).split('\n')[0];process.exitCode=1;}
finally{await context.close();await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-metadata-live-probe.json',JSON.stringify(report,null,2)+'\n');}
