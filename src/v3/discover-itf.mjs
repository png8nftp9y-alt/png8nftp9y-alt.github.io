import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const players=(await readJson('players.json',{players:[]})).players||[];
const itfPlayers=players.filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='ITF'));
const entries=[],errors=[];
function key(url){return (String(url).match(/\/tournament\/([^/]+)\/([^/]+)\/(\d{4})\/([^/]+)/i)||[]).slice(1).join('-').toUpperCase()||String(url).replace(/\W+/g,'-').toUpperCase()}
for(const p of itfPlayers){const urls=[...(p.officialUrls?.itf||[]),...(p.confirmedOfficialTournaments||[]).map(c=>c.url)].filter(Boolean).filter(u=>/itftennis\.com/i.test(u));for(const u of [...new Set(urls)]){const confirmed=(p.confirmedOfficialTournaments||[]).find(c=>(c.url||'').replace(/acceptance-list\/?$/,'')===u.replace(/acceptance-list\/?$/,''));entries.push({playerId:p.id,playerName:p.name,circuit:'itf',competitionId:key(u),tournamentName:confirmed?.name||'ITF official tournament/profile monitor',startDate:confirmed?.startDate||'',endDate:confirmed?.endDate||'',sourceUrl:u.replace(/acceptance-list\/?$/,''),source:'ex novo ITF official seed',status:confirmed?'official_seed':'profile_seed_needs_itf_scan',lastSeen:NOW})}}
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:'seeded_pending_live_itf_scan',source:'ex novo ITF discovery; no v1/v2/data.json; official ITF seeds only until live scanner is expanded',coverageFrom:FROM,profiles:itfPlayers.length,entriesFound:entries.length,entries,errors};
await writeJson('dist/v3/source_itf_entries.json',out);
console.log(JSON.stringify({...out,entries:undefined},null,2));
