// D1_READ_ONLY: guarded
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {checkOpponentProfiles} from '../lib/opponent-profile-check.mjs';
import worker from '../src/index.js';

const client=await openReadOnlyD1();
const users=await client.query("SELECT email FROM app_users WHERE status='active' ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,id LIMIT 1");
if(!users.length)throw Error('opponent_check_no_active_account');
const names=['Daniela Zharykava','Ivona Dirnbek','Margarita Kudryk','Natalia Skrypichayko'];
const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Worker exceptions may contain request identifiers. Keep raw messages private.
const previousError=console.error;let exceptions=0;console.error=()=>{exceptions++;};
let report;
try {report=await checkOpponentProfiles({worker,client,email:users[0].email,names,asOf});}
finally {console.error=previousError;}
console.log('OPPONENT_LOADING_CHECK='+JSON.stringify({...report,exceptions}));
if(!report.complete||exceptions)process.exitCode=1;
