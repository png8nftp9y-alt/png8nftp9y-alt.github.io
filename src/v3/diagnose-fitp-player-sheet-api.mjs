import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const players=[
  {id:'anna-gambarini',name:'Anna Gambarini',card:'3876473411'},
  {id:'nikola-kerkenyakov',name:'Nikola Nikolaev Kerkenyakov',card:'7578095942'}
];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function req(method,url,body,refererCard){try{const r=await fetch(url,{method,headers:{'content-type':'application/json','accept':'application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-sheet-api/1.1-anna-probe','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(Buffer.from(refererCard).toString('base64'))},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return {method,url,body,status:r.status,contentType:r.headers.get('content-type'),text:text.slice(0,6000),json};}catch(e){return {method,url,body,error:e.message}}}
const bases=['https://dp-fit-prod-function.azurewebsites.net','https://dp-myfit-test-function-v2.azurewebsites.net'];
const paths=['/api/v3/player/sheet/simple','/api/v6/player/sheet/simple','/api/v1/tesserati/dettaglio/semplice'];
const all=[];
for(const p of players){
 const card=p.card;
 const b64=Buffer.from(card).toString('base64');
 const bodies=[{cardNumber:card},{cardnumber:card},{membershipCard:card},{MembershipCard:card},{numeroTessera:card},{tessera:card},{cardNumber:b64},{cardnumber:b64},{CardNumber:b64},{numeroTessera:b64}];
 const calls=[];
 for(const b of bases)for(const path of paths){calls.push(req('GET',b+path+'?cardNumber='+encodeURIComponent(card),undefined,card));calls.push(req('GET',b+path+'?cardNumber='+encodeURIComponent(b64),undefined,card));for(const body of bodies)calls.push(req('POST',b+path,body,card));}
 const results=await Promise.all(calls);
 all.push({player:p,results});
}
await writeJson('dist/v3/fitp_player_sheet_api_diagnostic.json',{generatedAt:NOW,players:all});
console.log(JSON.stringify({generatedAt:NOW,players:all.map(p=>({player:p.player,results:p.results.map(r=>({method:r.method,url:r.url,body:r.body,status:r.status,error:r.error,contentType:r.contentType,text:r.text?.slice(0,800),json:r.json}))}))},null,2));
