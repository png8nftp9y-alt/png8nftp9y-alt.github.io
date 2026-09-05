import fs from 'node:fs';

const pageUrl=String(process.env.PAGE_URL||'https://png8nftp9y-alt.github.io/').replace(/\/?$/,'/');
const appUrl=process.env.APP_URL||'https://courtwatch-app-api.ckrk9ggvrb.workers.dev/app';
const expected=fs.readFileSync('v3.html','utf8').match(/v3\.(?:js|css)\?v=\d+/g)||[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let published='';
for(let attempt=1;attempt<=8;attempt++){
  try{const response=await fetch(pageUrl+'v3.html',{cache:'no-store'});if(response.ok){published=await response.text();if(expected.every(asset=>published.includes(asset)))break}}catch{}
  if(attempt<8)await wait(5000);
}
if(!published||!expected.every(asset=>published.includes(asset)))throw new Error('GitHub Pages non espone ancora gli asset attesi: '+expected.join(', '));
console.log('✓ Pages espone gli asset attesi: '+expected.join(', '));
const access=await fetch(appUrl,{redirect:'manual',cache:'no-store'});
if(![301,302,303,307,308,401,403].includes(access.status))throw new Error('Accesso anonimo inatteso: HTTP '+access.status);
console.log('✓ Accesso anonimo bloccato: HTTP '+access.status);
