const base=String(process.env.APP_BASE||'https://courtwatch-app-api.ckrk9ggvrb.workers.dev/app/api').replace(/\/$/,'');
const clientId=process.env.CF_ACCESS_CLIENT_ID,clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
if(!clientId||!clientSecret)throw new Error('Credenziali tecniche Access mancanti');
const headers={'CF-Access-Client-Id':clientId,'CF-Access-Client-Secret':clientSecret};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(path,options={}){const response=await fetch(base+path,{...options,headers:{...headers,...options.headers},redirect:'manual'});const text=await response.text();let body=null;try{body=JSON.parse(text)}catch{}return{response,body,text}}
let session;
for(let attempt=1;attempt<=8;attempt++){session=await request('/session');if(session.response.status===200)break;if(attempt<8)await wait(3000)}
if(session.response.status!==200||session.body?.user?.id!=='user-courtwatch-ci')throw new Error('Sessione CI non riconosciuta: HTTP '+session.response.status);
console.log('✓ sessione tecnica separata riconosciuta');
const snapshot=await request('/app-snapshot');
if(snapshot.response.status!==200||!Array.isArray(snapshot.body?.players)||snapshot.body.players.length!==0)throw new Error('Account CI non isolato dai giocatori reali');
console.log('✓ account CI isolato: nessun giocatore reale collegato');
const matchKey='__courtwatch_ci__:'+String(process.env.GITHUB_RUN_ID||Date.now()),analysis='CourtWatch authenticated CRUD smoke '+new Date().toISOString();
try{
  const put=await request('/match-analysis',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({matchKey,analysis})});
  if(put.response.status!==200||put.body?.analysis!==analysis)throw new Error('CREATE/UPDATE fallito: HTTP '+put.response.status);
  const get=await request('/match-analysis?matchKey='+encodeURIComponent(matchKey));
  if(get.response.status!==200||get.body?.analysis!==analysis)throw new Error('READ fallito');
  const status=await request('/match-analysis-status');
  if(status.response.status!==200||!status.body?.matches?.some(x=>x.matchKey===matchKey))throw new Error('Elenco analisi non aggiornato');
  console.log('✓ CREATE, UPDATE, READ e lista analisi verificati');
}finally{await request('/match-analysis?matchKey='+encodeURIComponent(matchKey),{method:'DELETE'})}
const deleted=await request('/match-analysis?matchKey='+encodeURIComponent(matchKey));
if(deleted.response.status!==200||deleted.body?.analysis!=='')throw new Error('DELETE fallito o residuo CI presente');
console.log('✓ DELETE verificato; nessun dato sintetico residuo');
