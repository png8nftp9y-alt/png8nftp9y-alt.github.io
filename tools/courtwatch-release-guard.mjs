import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures=[];
const results=[];
const pass=(name,detail)=>results.push({name,status:'pass',detail});
const fail=(name,detail)=>{results.push({name,status:'fail',detail});failures.push(name+': '+detail)};
const read=(path)=>fs.readFileSync(path,'utf8');
const json=(path)=>JSON.parse(read(path));
const circuit=x=>{const s=String(x.sourceId||x.source||x.sourceName||x.circuit||'').toLowerCase();return s.includes('tennis-europe')||s.includes('tennis europe')||s==='te'?'tennis-europe':s.includes('itf')?'itf':'fitp'};

const baseline=json('.courtwatch/release-baseline.json');
try{execFileSync(process.execPath,['--check','v3.js'],{stdio:'pipe'});pass('javascript-syntax','v3.js valido')}catch(error){fail('javascript-syntax',String(error.stderr||error.message))}
const html=read('v3.html'),js=read('v3.js');
if(/<base\b/i.test(html))fail('html-base','v3.html non deve contenere <base>');else pass('html-base','nessun <base>');
for(const id of baseline.requiredDomIds)html.includes('id="'+id+'"')?pass('dom-'+id,'presente'):fail('dom-'+id,'id mancante');
for(const asset of baseline.requiredAssetVersions)html.includes(asset)?pass('asset-'+asset,'versionato'):fail('asset-'+asset,'cache-buster mancante');
js.includes("location.origin+'/app/api'")?pass('private-api','/app/api stessa origine'):fail('private-api','endpoint autenticato atteso mancante');
!/\bprompt\s*\(/.test(js)?pass('analysis-password','nessun prompt password'):fail('analysis-password','prompt() trovato nel client');
js.includes('setInterval(load,30000)')?pass('refresh-contract','refresh applicazione 30s preservato'):fail('refresh-contract','refresh applicazione modificato o mancante');

const players=json('dist/v3/players.json').players;
const tournaments=json('dist/v3/tournaments.json').tournaments;
const agenda=json('dist/v3/agenda.json').agenda;
Array.isArray(players)&&players.length>=baseline.minimums.players?pass('players-count',String(players.length)):fail('players-count','attesi almeno '+baseline.minimums.players);
Array.isArray(tournaments)&&tournaments.length>=baseline.minimums.tournaments?pass('tournaments-count',String(tournaments.length)):fail('tournaments-count','dataset vuoto o incompleto');
Array.isArray(agenda)&&agenda.length>=baseline.minimums.agenda?pass('agenda-count',String(agenda.length)):fail('agenda-count','dataset vuoto o incompleto');
const ids=new Set(players.map(x=>x.id));
ids.size===players.length&&!players.some(x=>!x.id||!x.name)?pass('players-schema','id unici e nomi presenti'):fail('players-schema','id duplicati o campi essenziali mancanti');
const orphanTournaments=tournaments.filter(x=>x.playerId&&!ids.has(x.playerId));
const orphanAgenda=agenda.filter(x=>x.playerId&&!ids.has(x.playerId));
orphanTournaments.length===0?pass('tournament-players','nessun playerId orfano'):fail('tournament-players',orphanTournaments.length+' riferimenti orfani');
orphanAgenda.length===0?pass('agenda-players','nessun playerId orfano'):fail('agenda-players',orphanAgenda.length+' riferimenti orfani');
for(const [name,min] of Object.entries(baseline.minimums.byCircuit)){const tn=tournaments.filter(x=>circuit(x)===name).length,an=agenda.filter(x=>circuit(x)===name).length;tn>=min?pass('tournaments-'+name,String(tn)):fail('tournaments-'+name,'copertura assente');an>=min?pass('agenda-'+name,String(an)):fail('agenda-'+name,'copertura assente')}

const changed=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const functional=changed.filter(path=>/^(?:v3\.(?:js|css|html)|cloudflare\/|infra\/|src\/|tools\/|\.courtwatch\/|\.github\/workflows\/|[^/]+\.(?:mjs|js|css|html)|package(?:-lock)?\.json$)/.test(path));
if(functional.length&&!changed.includes('docs/CourtWatch_v3_handoff_report.md'))fail('report-same-commit','modifiche funzionali senza aggiornamento report: '+functional.join(', '));else pass('report-same-commit',functional.length?'report incluso':'nessuna modifica funzionale');
const previousHtml=execFileSync('git',['show','HEAD^:v3.html'],{encoding:'utf8'});
const assetVersion=(source,name)=>Number((source.match(new RegExp(name.replace('.','\\.')+'\\?v=(\\d+)'))||[])[1]||0);
for(const asset of ['v3.js','v3.css'])if(changed.includes(asset)){const before=assetVersion(previousHtml,asset),after=assetVersion(html,asset);if(changed.includes('v3.html')&&after>before)pass('cache-'+asset,before+' → '+after);else fail('cache-'+asset,'asset modificato senza incremento cache in v3.html')}

const report={generatedAt:new Date().toISOString(),baseline:baseline.stableCommit,results,passed:failures.length===0};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/courtwatch-release-guard.json',JSON.stringify(report,null,2)+'\n');
for(const item of results)console.log((item.status==='pass'?'✓':'✗')+' '+item.name+' — '+item.detail);
if(failures.length){console.error('\nPubblicazione bloccata:\n- '+failures.join('\n- '));process.exit(1)}
console.log('\nCourtWatch release guard: tutti i controlli superati.');
