from pathlib import Path
def edit(path,old,new):
 p=Path(path); s=p.read_text()
 assert s.count(old)==1,(path,old,s.count(old))
 p.write_text(s.replace(old,new))
def report(text):
 with Path('docs/CourtWatch_v3_handoff_report.md').open('a') as f:f.write(text)
p='src/v3/tennis-europe-metadata.mjs'
with Path(p).open('a') as f:f.write(r'''
// The official search places grading tags in a separate list within each tournament card.
export function tennisEuropeSearchCategories(html) {
  const categories = new Map();
  const cardStart = /<li\b[^>]*>\s*<div\b[^>]*class=["']media["'][^>]*>/gi;
  const cards = [...String(html || '').matchAll(cardStart)];
  for (const [index, start] of cards.entries()) {
    const card = html.slice(start.index, cards[index + 1]?.index);
    const id = card.match(/href=["'][^"']*\/sport\/(?:tournament|events)(?:\.aspx)?\?id=([a-f0-9-]{36})(?:&|["'])/i)?.[1]?.toUpperCase();
    if (!id) continue;
    const values = [...card.matchAll(/<span\b[^>]*class=["'][^"']*\btag--soft\b[^"']*["'][^>]*>\s*([^<>]+?)\s*<\/span>/gi)]
      .map(match => match[1].trim())
      .filter(value => /^(?:Super Category|Category [1-3]|Masters|European Championship|Tennis Europe Festival|Invitational|Small States)$/i.test(value));
    const unique = [...new Set(values)];
    if (unique.length === 1) categories.set(id, unique[0]);
  }
  return categories;
}
''')
p='src/v3/discover-tennis-europe-tournaments-shard.mjs'
edit(p,'{tennisEuropeCourtConditions}','{tennisEuropeCourtConditions,tennisEuropeSearchCategories}')
edit(p,"const TODAY=new Date(NOW.slice(0,10)+'T00:00:00Z'), FROM=iso(addDays(TODAY,-PAST_DAYS)), UNTIL=iso(addDays(TODAY,HORIZON_DAYS));",'''const TODAY=new Date(NOW.slice(0,10)+'T00:00:00Z'), rollingFrom=iso(addDays(TODAY,-PAST_DAYS)), UNTIL=iso(addDays(TODAY,HORIZON_DAYS));
const readCatalog=async path=>JSON.parse(await fs.readFile(path,'utf8'));
const previousMap=await readCatalog('dist/v3/source_tennis_europe_tournaments_sharded.json');
const backfill=process.env.TE_CATEGORY_BACKFILL==='true'||!Object.keys(previousMap.categoriesByCompetitionId||{}).length;
const history=backfill?await readCatalog('history/tennis_europe_tournament_catalog.json'):null;
const FROM=[rollingFrom,...Object.values(history?.tournaments||{}).map(t=>t.startDate).filter(date=>/^\\d{4}-\\d{2}-\\d{2}$/.test(date))].sort()[0];''')
edit(p,'function parseSearch(html,w){const out=[];','function parseSearch(html,w){const categories=tennisEuropeSearchCategories(html),out=[];')
edit(p,"metadataSource:'official_search_result'})","metadataSource:'official_search_result',...(categories.has(competitionId)?{tournamentCategory:categories.get(competitionId)}:{})})")
p='src/v3/merge-tennis-europe-tournament-shards.mjs'
edit(p,'const out={version:', '''const categoriesByCompetitionId={...previousMap.categoriesByCompetitionId};
for(const t of byId.values())if(t.tournamentCategory)categoriesByCompetitionId[t.competitionId]=t.tournamentCategory;
if(!Object.keys(categoriesByCompetitionId).length)errors.push({type:'official_tournament_categories_missing'});
const out={categoriesByCompetitionId,version:''')
p='src/v3/maintain-tennis-europe-database.mjs'
edit(p,"    location: t.location || previous.location || '', venueName: t.venueName || previous.venueName || '',","    location: t.location || previous.location || '', venueName: t.venueName || previous.venueName || '',\n    ...(mapData.categoriesByCompetitionId?.[id] ? {tournamentCategory:mapData.categoriesByCompetitionId[id]} : {}),")
p='src/v3/entries-engine.mjs'
edit(p,'    surface: row.surface || row.surfaceDesc || row.courtSurface || row.playingSurface || "",','    ...(c === "tennis-europe" && row.tournamentCategory ? { tournamentCategory: row.tournamentCategory } : {}),\n    surface: row.surface || row.surfaceDesc || row.courtSurface || row.playingSurface || "",')
edit(p,'    surface: e.surface || "",','    ...(e.tournamentCategory ? { tournamentCategory: e.tournamentCategory } : {}),\n    surface: e.surface || "",')
edit(p,'      circuit: "tennis-europe",\n      venueName:', '''      circuit: "tennis-europe",
      tournamentCategory: teTournaments.categoriesByCompetitionId?.[String(r.competitionId || "").toUpperCase()] || official.tournamentCategory,
      venueName:''')
p='cloudflare/app-api/lib/personal-tournament-presentation.mjs'
edit(p,' surface:first(t.surface,t.courtSurface,t.playingSurface),',' surface:first(t.surface,t.courtSurface,t.playingSurface),\n tournamentCategory:first(t.tournamentCategory),')
edit(p,"  return Array.isArray(rows)?rows:rows&&typeof rows==='object'?Object.entries(rows).map(([id,t])=>({...t,competitionId:id})):[];",'''  const tournaments=Array.isArray(rows)?rows:rows&&typeof rows==='object'?Object.entries(rows).map(([id,t])=>({...t,competitionId:id})):[];
  if(c!=='tennis-europe')return tournaments;
  return [...tournaments,...Object.entries(data.categoriesByCompetitionId||{}).map(([competitionId,tournamentCategory])=>({competitionId,tournamentCategory}))];''')
p='v3.js'
edit(p,'  const conditions = tournamentSurfaceLabel(tournament, true);','  const conditions = tournamentSurfaceLabel(tournament, true),\n    category = readableText(tournament?.tournamentCategory || value?.tournamentCategory || "");')
edit(p,'return `${circuitBadge}<span class="type tournamentConditions">','return `${circuitBadge}${category ? `<span class="type tennisEuropeCategory">${esc(category)}</span>` : ""}<span class="type tournamentConditions">')
edit(p,'    surfaceLabel = tournamentSurfaceLabel(t);','    surfaceLabel = tournamentSurfaceLabel(t),\n    category = source === "tennis-europe" ? readableText(t.tournamentCategory || "") : "";')
edit(p,'<h2>${title}</h2>${surfaceLabel ?', '<h2>${title}</h2>${category ? `<p>${esc(category)}</p>` : ""}${surfaceLabel ?')
with Path('v3.css').open('a') as f:f.write('\n.type.tennisEuropeCategory{background:#7040a0;color:#fff}\n')
p='.github/workflows/courtwatch-v3-tennis-europe-sharded.yml'
edit(p,'  workflow_dispatch:\n','  workflow_dispatch:\n    inputs:\n      category_backfill:\n        description: Rescan the full archived date range for official categories\n        type: boolean\n        default: false\n')
edit(p,'      - run: TE_SHARD=', '      - env:\n          TE_CATEGORY_BACKFILL: ${{ inputs.category_backfill }}\n        run: TE_SHARD=')
report('\n\n### 2026-11-08 — Categoria ufficiale Tennis Europe\n\nAcquisita dal tag categoria della ricerca ufficiale per ID torneo. Primo passaggio esteso alle date dello storico, con recupero manuale ripetibile. Il catalogo conserva le categorie già verificate fuori finestra. Agenda con etichetta viola e testo bianco, pagina torneo con testo fra titolo e superficie. I valori mancanti restano vuoti. Verifica locale con test del parser e della proiezione. Copertura effettiva da misurare dopo acquisizione e pubblicazione.\n')
p=Path('v3.html')
s=p.read_text()
import re,time
revision=time.time_ns()
for asset in ('js','css'):
 pattern=rf'(v3\.{asset}\?v=)(\d+)[^"]*'
 s,count=re.subn(pattern,lambda m: f'{m[1]}{max(revision,int(m[2])+1)}-te-category',s)
 assert count==1,asset
p.write_text(s)
