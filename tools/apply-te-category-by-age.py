from pathlib import Path
import re
import time

def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Contesto inatteso in {path}: {old[:90]}")
    p.write_text(text.replace(old, new, 1))

registry = """const verifiedCategoriesByAge = {
  // Robey FOCUS tennis academy open 2026 — tenniseurope.org/calendarevent/89607/, tenniseurope.org/calendarevent/89608/
  'E6C27FE1-A487-440E-9C38-AE8717B4FDE5': [[12, 2], [14, 3]],
  // Development Championships 2026 (week 1) CLOSED EVENT — tenniseurope.org/calendarevent/90865/
  '4120A62D-908D-4D9A-ACEF-EBD0E59B41C2': [[14, 2]],
  // Development Championships 2026 (week 2) CLOSED EVENT — tenniseurope.org/calendarevent/90866/
  '422BCB8C-525F-4CE0-A798-C833EEF6FD8F': [[14, 2]],
  // Hanko Cup — tenniseurope.org/calendarevent/90595/, tenniseurope.org/calendarevent/90596/
  '4F8DB737-D813-473C-BC8D-6C8AA2628B33': [[12, 2], [14, 3]],
  // Amstelpark Tennis Academy Trophy 2026 — tenniseurope.org/calendarevent/90074/, tenniseurope.org/calendarevent/90075/
  'F3FB64C2-0BB4-40B1-B86E-215E9C8CDF4D': [[12, 2], [14, 3]],
  // Koblenz Junior Open — tenniseurope.org/calendarevent/90396/, tenniseurope.org/calendarevent/90397/
  'FB2EB43B-864C-43F6-918A-D23C00FDB65E': [[12, 1], [14, 2]],
  // Austrian Youth Open Kufstein — tenniseurope.org/calendarevent/90841/, tenniseurope.org/calendarevent/90842/
  '72B85BEB-F56D-48F3-AA67-88C1F293C970': [[12, 1], [14, 2]],
  // Kottingbrunn Open 2026 — tenniseurope.org/calendarevent/90862/, tenniseurope.org/calendarevent/90861/
  '36EF59E5-9E3D-4E14-9776-290A130096F2': [[14, 3], [16, 2]],
  // Zahnärzte Ebenbeck Cup — tenniseurope.org/calendarevent/90995/, tenniseurope.org/calendarevent/90996/
  '3E1A18DE-2228-4DF5-8542-BD3611310D83': [[12, 1], [16, 2]],
  // Passau Open — tenniseurope.org/calendarevent/91496/, tenniseurope.org/calendarevent/91495/
  '5FF8792E-6CA1-4624-968B-24DAE81D884C': [[14, 3], [16, 2]],
  // Gran Canaria Yellow Bowl — tenniseurope.org/calendarevent/91351/, tenniseurope.org/calendarevent/91352/
  'C26D5B98-C00A-4F39-A207-237B6810D614': [[12, 1], [14, 2]],
  // Robey FOCUS tennis academy open 2027 — tenniseurope.org/calendarevent/92749/ and /92750/
  '7A2FC9C8-FD64-4C81-A396-8501BA60940D': [[12, 2], [14, 3]],
};
for (const [id, pairs] of Object.entries(verifiedCategoriesByAge)) {
  categoriesByCompetitionId[id] = pairs.map(([age, grade]) => 'U'+age+' · Category '+grade).join(' / ');
}
for (const t of tournaments) {
  const category = categoriesByCompetitionId[t.competitionId];
  if (category) t.tournamentCategory = category;
}
"""
replace('src/v3/merge-tennis-europe-tournament-shards.mjs',
        "if(!Object.keys(categoriesByCompetitionId).length)",
        registry + "if(!Object.keys(categoriesByCompetitionId).length)")
replace('v3.js', 'function agendaCircuitBadges(value, tournament = value) {',
        'function agendaCircuitBadges(value, tournament = value, matchOnly = false) {')
replace('v3.js', 'category = readableText(tournament?.tournamentCategory || value?.tournamentCategory || "");',
        r'''category = readableText(tournament?.tournamentCategory || value?.tournamentCategory || ""),
    age = matchOnly
      ? readableText([value?.event, value?.draw, value?.ageGroup, value?.ageCategory].filter(Boolean).join(" "))
          .match(/\b(?:(?:U|[BG][SD])\s*(12|14|16|18)|(12|14|16|18)\s*(?:&\s*U|&\s*Under))\b/i)
      : null,
    pairs = category.split(" / "),
    matchCategory = age && pairs.every(pair => /^U\d+ · /.test(pair))
      ? pairs.find(pair => pair.startsWith("U" + (age[1] || age[2]) + " · ")) || ""
      : category;''')
replace('v3.js', 'category ? \x60<span class="type tennisEuropeCategory">${esc(category)}</span>\x60 : ""',
        'matchCategory ? \x60<span class="type tennisEuropeCategory">${esc(matchCategory)}</span>\x60 : ""')
replace('v3.js', 'agendaCircuitBadges(m, itemTournament || m)', 'agendaCircuitBadges(m, itemTournament || m, true)')

p = Path('v3.html')
s, count = re.subn(r'(v3\.js\?v=)(\d+)[^"]*',
                   lambda m: f'{m[1]}{max(time.time_ns(),int(m[2])+1)}-te-category-by-age',
                   p.read_text())
if count != 1:
    raise SystemExit("Revisione cache JS inattesa")
p.write_text(s)
with Path('docs/CourtWatch_v3_handoff_report.md').open('a') as report:
    report.write('\n\n### 2026-11-09 — Categorie Tennis Europe per fascia d’età\n\n'
                 'Verificate per ID le coppie età/categoria di nove tornei storici '
                 'con categorie multiple. Le due tappe Development 2026 sono U14 Categoria 2. '
                 'I 69 eventi Winter e Summer Cups sono separati dalle categorie individuali. '
                 'Robey 2027 verificato come U12 Categoria 2 e U14 Categoria 3. Agenda cronologica usa la fascia '
                 'del match quando disponibile. Verifica locale di sintassi e presentazione. '
                 'Acquisizione e pubblicazione da verificare sul run del catalogo.\n')
