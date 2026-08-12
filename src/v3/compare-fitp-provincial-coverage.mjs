import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const OWNER='png8nftp9y-alt', REPO='png8nftp9y-alt.github.io';
const OLD_COMMIT='59f59a8d801baa0f9df5eb2679fbad926f2d75d2';
const OLD_URL=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${OLD_COMMIT}/dist/v3/source_fitp_tournaments.json`;
async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'))}
async function fetchJson(url){const r=await fetch(url,{headers:{'user-agent':'CourtWatch-fitp-provincial-coverage-diagnostic/1.0'}}); if(!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json()}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true}); await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const key=t=>String(t?.competitionId||t?.guid||'').toUpperCase();
const provinceOf=t=>{const loc=String(t.location||''); const m=loc.match(/\b([A-Z]{2})$/); return m?m[1]:''};
const monthOf=t=>String(t.startDate||'').slice(0,7)||'unknown';
const isJunior=t=>/U\.?\s?(8|10|11|12|13|14|15|16|17|18)|JUNIOR|GIOVAN|KINDER|NEXT GEN|UNDER/.test(norm([t.tournamentName,t.categoryAge].join(' ')));
const old=await fetchJson(OLD_URL);
const cur=await readJson('dist/v3/source_fitp_tournaments.json');
const oldMap=new Map((old.tournaments||[]).map(t=>[key(t),t]).filter(([k])=>k));
const curMap=new Map((cur.tournaments||[]).map(t=>[key(t),t]).filter(([k])=>k));
const missing=[], added=[];
for(const [k,t] of oldMap) if(!curMap.has(k)) missing.push(t);
for(const [k,t] of curMap) if(!oldMap.has(k)) added.push(t);
function group(arr,fn){const o={}; for(const x of arr){const k=fn(x)||'unknown'; o[k]=(o[k]||0)+1} return Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))}
const regressionIds={feniceBresciaLomb370:'676A77A5-3B55-479E-81E2-45F109C25F98',rossoniKinderImperia:'25C6CC33-AE3A-447E-A55B-FBE66FBAFC80',navaKinderMilano3:'B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'};
const regression={}; for(const [name,id] of Object.entries(regressionIds)) regression[name]={old:oldMap.has(id),current:curMap.has(id),missingFromCurrent:oldMap.has(id)&&!curMap.has(id)};
const out={version:'cw-v3-fitp-provincial-coverage-comparison',generatedAt:NOW,oldCommit:OLD_COMMIT,currentGeneratedAt:cur.generatedAt,oldCount:oldMap.size,currentCount:curMap.size,missingCount:missing.length,addedCount:added.length,regression,missingByProvince:group(missing,provinceOf),missingByMonth:group(missing,monthOf),missingJuniorCount:missing.filter(isJunior).length,addedByProvince:group(added,provinceOf),addedByMonth:group(added,monthOf),sampleMissing:missing.slice(0,300).map(t=>({competitionId:key(t),tournamentName:t.tournamentName,location:t.location,startDate:t.startDate,endDate:t.endDate,categoryAge:t.categoryAge,tournamentType:t.tournamentType,sourceUrl:t.sourceUrl,discoveryShards:t.discoveryShards,coverageModes:t.coverageModes})),sampleAdded:added.slice(0,100).map(t=>({competitionId:key(t),tournamentName:t.tournamentName,location:t.location,startDate:t.startDate,endDate:t.endDate,categoryAge:t.categoryAge,tournamentType:t.tournamentType,sourceUrl:t.sourceUrl,discoveryShards:t.discoveryShards,coverageModes:t.coverageModes}))};
await writeJson('dist/v3/fitp_provincial_coverage_comparison.json',out);
console.log(JSON.stringify({...out,sampleMissing:out.sampleMissing.slice(0,30),sampleAdded:out.sampleAdded.slice(0,20)},null,2));
