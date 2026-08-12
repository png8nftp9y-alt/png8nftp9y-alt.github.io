import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const CARDS=['3876473411','7578095942'];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function get(u){const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-fitp-profile-endpoint-diagnostic/1.1-anna','accept':'text/html,application/json,*/*','referer':'https://www.fitp.it/'}});const text=await r.text();return {url:u,status:r.status,contentType:r.headers.get('content-type')||'',text};}
const profiles=[];
for(const CARD of CARDS){
 const encoded=Buffer.from(CARD,'utf8').toString('base64');
 const url='https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(encoded);
 const page=await get(url);
 const scripts=[...page.text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],url).href);
 const inline=[...page.text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n').slice(0,20000);
 const apiHints=[...page.text.matchAll(/https?:\/\/[^"'\s<>]+|\/api\/[^"'\s<>]+|api\/[A-Za-z0-9_?=&/.-]+/gi)].map(m=>m[0]);
 const downloaded=[];
 for(const s of scripts.slice(0,40)){
  try{const r=await get(s);downloaded.push({url:s,status:r.status,contentType:r.contentType,length:r.text.length,snippet:r.text.slice(0,1200),apiHints:[...r.text.matchAll(/https?:\/\/[^"'`\s<>]+|\/api\/[^"'`\s<>]+|api\/[A-Za-z0-9_?=&/.-]+|cardNumber|MembershipCard|membershipCard|Tessera|Circolo|Club|Societ[aà]|baseStat|ranking|guid|tornei|competizione|iscri/gi)].map(m=>m[0]).slice(0,300)});}catch(e){downloaded.push({url:s,error:e.message})}
 }
 const text=page.text.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 profiles.push({testCard:CARD,encoded,url,page:{status:page.status,contentType:page.contentType,length:page.text.length,title:(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'',textSnippet:text.slice(0,3000),hasPlaceholders:/\{\{CLUB\}\}/.test(page.text),scriptCount:scripts.length,scripts,apiHints:[...new Set(apiHints)].slice(0,300),inlineSnippet:inline},downloaded});
}
const out={generatedAt:NOW,status:'fitp_player_profile_endpoint_diagnostic_anna_complete',profiles};
await writeJson('dist/v3/fitp_player_profile_endpoint_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,profiles:profiles.map(p=>({testCard:p.testCard,url:p.url,title:p.page.title,scriptCount:p.page.scriptCount,apiHintCount:p.page.apiHints.length,downloaded:p.downloaded.length,downloadedHints:p.downloaded.flatMap(d=>d.apiHints||[]).slice(0,80)}))},null,2));
