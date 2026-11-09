import json
import re
import time
from pathlib import Path

changes = json.loads("[[\"function agendaCircuitBadges(value, tournament = value, matchOnly = false) {\\n  const source = circuit(value),\\n    circuitBadge = `<span class=\\\"type ${source}\\\">${esc(agendaCircuitLabel(value))}</span>`;\\n  if (source !== \\\"tennis-europe\\\") return circuitBadge;\\n  const conditions = tournamentSurfaceLabel(tournament, true),\\n    category = readableText(tournament?.tournamentCategory || value?.tournamentCategory || \\\"\\\"),\\n    age = matchOnly\\n      ? readableText([value?.event, value?.draw, value?.ageGroup, value?.ageCategory].filter(Boolean).join(\\\" \\\"))\\n          .match(/\\\\b(?:(?:U|[BG][SD])\\\\s*(12|14|16|18)|(12|14|16|18)\\\\s*(?:&\\\\s*U|&\\\\s*Under))\\\\b/i)\\n      : null,\\n    pairs = category.split(\\\" / \\\"),\\n    matchCategory = age && pairs.every(pair => /^U\\\\d+ · /.test(pair))\\n      ? pairs.find(pair => pair.startsWith(\\\"U\\\" + (age[1] || age[2]) + \\\" · \\\")) || \\\"\\\"\\n      : category;\\n  return `${circuitBadge}${matchCategory ? `<span class=\\\"type tennisEuropeCategory\\\">${esc(matchCategory)}</span>` : \\\"\\\"}<span class=\\\"type tournamentConditions\\\">${esc(conditions || \\\"SUPERFICIE/AMBIENTE NON PUBBLICATI\\\")}</span>`;\\n}\\n\",\"function agendaTournamentCategoryPlan(matches, tournament) {\\n  const category = readableText(tournament?.tournamentCategory || matches.find(m => m.tournamentCategory)?.tournamentCategory || \\\"\\\"),\\n    pairs = category.split(\\\" / \\\");\\n  if (circuit(matches[0]) !== \\\"tennis-europe\\\" || pairs.length === 1)\\n    return { header: category, matchCategories: new Map() };\\n  const matchCategories = new Map();\\n  if (!pairs.every(pair => /^U(?:12|14|16|18) · /.test(pair)))\\n    return { header: \\\"\\\", matchCategories };\\n  const represented = new Set();\\n  for (const match of matches) {\\n    const evidence = readableText([match.event, match.draw, match.ageGroup, match.ageCategory, match.category].filter(Boolean).join(\\\" \\\")),\\n      ages = new Set([...evidence.matchAll(/\\\\b(?:(?:U|[BG][SD])\\\\s*(12|14|16|18)|(12|14|16|18)\\\\s*(?:&\\\\s*U|&\\\\s*Under))\\\\b/gi)].map(age => age[1] || age[2]));\\n    if (ages.size !== 1) continue;\\n    const age = [...ages][0];\\n    represented.add(age);\\n    const pair = pairs.find(pair => pair.startsWith(\\\"U\\\" + age + \\\" · \\\"));\\n    if (pair) matchCategories.set(match, pair.split(\\\" · \\\")[1]);\\n  }\\n  if (represented.size === 1 && matchCategories.size === matches.length)\\n    return { header: pairs.find(pair => pair.startsWith(\\\"U\\\" + [...represented][0] + \\\" · \\\")) || \\\"\\\", matchCategories: new Map() };\\n  return { header: \\\"\\\", matchCategories };\\n}\\nfunction agendaTournamentCategoryBadge(category) {\\n  return category ? `<span class=\\\"type tennisEuropeCategory\\\">${esc(category)}</span>` : \\\"\\\";\\n}\\nfunction agendaCircuitBadges(value, tournament = value, category = \\\"\\\") {\\n  const source = circuit(value),\\n    circuitBadge = `<span class=\\\"type ${source}\\\">${esc(agendaCircuitLabel(value))}</span>`;\\n  if (source !== \\\"tennis-europe\\\") return circuitBadge;\\n  const conditions = tournamentSurfaceLabel(tournament, true);\\n  return `${circuitBadge}${agendaTournamentCategoryBadge(category)}<span class=\\\"type tournamentConditions\\\">${esc(conditions || \\\"SUPERFICIE/AMBIENTE NON PUBBLICATI\\\")}</span>`;\\n}\\n\"],[\"  const sourceRank = { itf: 0, \\\"tennis-europe\\\": 1, fitp: 2 };\",\"  const categoryPlans = new Map();\\n  for (const { tournament, matches } of groups.values()) {\\n    const plan = agendaTournamentCategoryPlan(matches, tournament);\\n    for (const match of matches) categoryPlans.set(match, plan);\\n  }\\n  const sourceRank = { itf: 0, \\\"tennis-europe\\\": 1, fitp: 2 };\"],[\"agendaCircuitBadges(sample, blockTournament || sample)\",\"agendaCircuitBadges(sample, blockTournament || sample, categoryPlans.get(sample).header)\"],[\"agendaCircuitBadges(m, itemTournament || m, true)\",\"agendaCircuitBadges(m, itemTournament || m, categoryPlans.get(m).header)\"],[\"${agendaDrawCodeHtml(m, itemTournament)}</div><${whenTag}\",\"${agendaDrawCodeHtml(m, itemTournament)}</div>${categoryPlans.get(m).matchCategories.has(m) ? `<div class=\\\"agendaRoundLabels\\\">${agendaTournamentCategoryBadge(categoryPlans.get(m).matchCategories.get(m))}</div>` : \\\"\\\"}<${whenTag}\"]]")
js = Path("v3.js")
source = js.read_text()
for old, new in changes:
    if source.count(old) != 1:
        raise SystemExit("Contesto Agenda diverso da quello verificato: " + old[:90])
    source = source.replace(old, new, 1)

html = Path("v3.html")
page, count = re.subn(r'(v3\.js\?v=)(\d+)[^"]*',
                     lambda m: f'{m[1]}{max(time.time_ns(), int(m[2])+1)}-agenda-te-category',
                     html.read_text())
if count != 1:
    raise SystemExit("Revisione cache JS inattesa")

js.write_text(source)
html.write_text(page)
with Path("docs/CourtWatch_v3_handoff_report.md").open("a") as report:
    report.write("\n\n### 2026-11-09 — Posizione categorie Tennis Europe in Agenda\n\n"
                 "Per torneo e giorno, l’Agenda usa le fasce dei match mostrati. "
                 "Con una fascia confermata, la categoria compare nell’intestazione. "
                 "Con più fasce, compare sotto turno e fascia nella singola partita. "
                 "Una fascia ambigua non riceve una categoria. La pagina torneo mostra tutte le coppie. "
                 "Verificate localmente otto combinazioni di fasce e categorie. "
                 "Verifica grafica in produzione dopo il deploy.\n")
