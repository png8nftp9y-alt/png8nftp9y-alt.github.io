from pathlib import Path
p=Path("src/v3/tennis-europe-oop-completeness.mjs")
s=p.read_text()
for old,add in [("export function auditOopCompleteness(","// A published doubles slot can have one complete team and an explicitly empty opponent row.\nfunction doublesAwaitingOpponent(html, players) {\n const body=String(html||'').match(/<div class=\"match__row-wrapper\">([\\s\\S]*?)<div class=\"match__result\">/i)?.[1]||'';\n const starts=[...body.matchAll(/<div class=\"match__row\\s*\">/gi)];\n if(starts.length!==2)return false;\n const rows=starts.map((row,i)=>body.slice(row.index,starts[i+1]?.index));\n const empty=rows.findIndex(row=>/^<div class=\"match__row\\s*\">\\s*<div class=\"match__row-title\">\\s*<\\/div>\\s*<\\/div>(?:\\s*<\\/div>)?\\s*$/i.test(row));\n if(empty<0)return false;\n const native=[...rows[1-empty].matchAll(/<a\\b[^>]*data-player-id=[\"']([^\"']+)[\"']/gi)].map(row=>row[1]).sort();\n return new Set(native).size===2&&native.join('|')===ids({players});\n}\n"),("   // Future doubles finals","   if(size===4&&card.round&&card.drawUrl&&card.players.length===2&&!card.score&&!card.winnerIds.length&&!card.retired&&iso(asOf)&&iso(card.date)>=iso(asOf)&&doublesAwaitingOpponent(card.evidenceHtml,card.players)){\n    pendingOpponents++;\n    resolutions.push({kind:'doubles_awaiting_opponent_team',date:card.date,event:card.event,round:card.round,sourceUrl:card.sourceUrl,sourceHash:card.sourceHash});continue;\n   }\n")]:
    if s.count(old)!=1:
        raise SystemExit("Contesto OOP inatteso")
    s=s.replace(old,add+old,1)
p.write_text(s)
with Path("docs/CourtWatch_v3_handoff_report.md").open("a") as report:
    report.write("\n\n### 2026-11-10 — Doppi OOP con coppia avversaria in attesa\n\n"
                 "L’audit registra come in attesa uno slot di doppio odierno o futuro con due ID nella stessa coppia, "
                 "riga avversaria esplicitamente vuota e nessun esito. La partita non viene inventata. "
                 "Riprodotti i due casi Lleida del run 42721739091 e tre controlli negativi. "
                 "Esito live e sincronizzazione Agenda da verificare dopo il push.\n")
