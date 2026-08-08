import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const ids=['7A37ABFA-E5E5-4067-ADBE-69ADA41A644A','B9516A9A-7BD3-4933-9CEB-AB1D77ACA93A','ECF62DBC-5BF4-41D3-9C90-129F91EFCCF3'];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function get(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-page-reverse/1.0','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});const text=await r.text();return {url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),bytes:text.length,text}}
function uniq(a){return [...new Set(a.filter(Boolean))]}
function extract(html){const scripts=uniq([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]).map(s=>s.startsWith('http')?s:'https://www.fitp.it'+(s.startsWith('/')?s:'/'+s)));
const api=uniq([...html.matchAll(/['"`]([^'"`]*(?:api|puc|competizione|iscriz|iscritt|tabell|tornei)[^'"`]*)['"`]/gi)].map(m=>m[1])).slice(0,300);
const forms=uniq([...html.matchAll(/<form[\s\S]*?<\/form>/gi)].map(m=>m[0].slice(0,1000))).slice(0,20);
return {scripts,api,forms,title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'',snippet:html.slice(0,2000)}
}
const pages=[];for(const id of ids){const url='https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(id);try{const p=await get(url);pages.push({competitionId:id,...p,text:undefined,...extract(p.text)});}catch(e){pages.push({competitionId:id,error:e.message})}}
const scriptUrls=uniq(pages.flatMap(p=>p.scripts||[])).slice(0,80);
const scripts=[];for(const url of scriptUrls){try{const s=await get(url);const hits=uniq([...s.text.matchAll(/[^\n\r]{0,80}(?:api|puc|competizione|iscriz|iscritt|tabell|tornei)[^\n\r]{0,120}/gi)].map(m=>m[0])).slice(0,80);scripts.push({url,status:s.status,bytes:s.bytes,hits});}catch(e){scripts.push({url,error:e.message})}}
const out={generatedAt:NOW,status:'fitp_page_reverse_probe_complete',pages:pages.map(p=>({...p,snippet:p.snippet?.slice(0,800)})),scriptCount:scriptUrls.length,scripts};
await writeJson('dist/v3/source_fitp_page_reverse_probe.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,pageCount:pages.length,scriptCount:scriptUrls.length,pages:out.pages.map(p=>({competitionId:p.competitionId,status:p.status,bytes:p.bytes,title:p.title,api:(p.api||[]).slice(0,20),scripts:(p.scripts||[]).slice(0,10)})),scriptHits:scripts.filter(s=>(s.hits||[]).length).slice(0,20)},null,2));
