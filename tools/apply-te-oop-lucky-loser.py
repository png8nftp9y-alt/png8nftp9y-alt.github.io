from pathlib import Path
def replace(text, old, new):
    if text.count(old) != 1:
        raise SystemExit("Contesto del controllo OOP inatteso")
    return text.replace(old, new, 1)
p = Path("src/v3/tennis-europe-oop-removals.mjs")
source = p.read_text()
helper = "function verifiedLuckyLoserReplacement(old,matches){\n const players=m=>m.players||[];\n const scheduled=m=>m.status==='scheduled'&&!m.score&&!m.retired&&!m.winnerPlayerId&&!m.winnerPlayerIds?.length&&\n  m.opponentPending!==true&&players(m).length===2&&players(m).every(p=>p.id)&&\n  new Set(players(m).map(p=>String(p.id))).size===2&&\n  m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&\n  m.courtMatchNumberSource==='official_schedule_subheader';\n if(!scheduled(old)||!/^([BG])S\\d{2}\\b/i.test(old.event)||!old.round||!old.drawUrl)return null;\n const date=iso(old.date).replaceAll('-','');\n const source='https://te.tournamentsoftware.com/tournament/'+old.competitionId+'/matches/'+date;\n if(old.sourceUrl!==source)return null;\n const candidates=matches.filter(m=>m.competitionId===old.competitionId&&iso(m.date)===iso(old.date)&&\n  m.event===old.event&&m.round===old.round&&m.drawUrl===old.drawUrl&&m.sourceUrl===source&&\n  m.court===old.court&&m.courtMatchNumber===old.courtMatchNumber);\n if(candidates.length!==1||!scheduled(candidates[0]))return null;\n const next=candidates[0],oldIds=new Set(players(old).map(p=>String(p.id)));\n const newcomers=players(next).filter(p=>!oldIds.has(String(p.id)));\n return newcomers.length===1&&[newcomers[0].entryType,newcomers[0].designation].includes('LL')?next:null;\n}\n"
source = replace(source, "function replacement(old,matches){", helper + "function replacement(old,matches){")
source = replace(source, "if(confirmed)return confirmed;", "if(confirmed)return confirmed;\n const luckyLoser=verifiedLuckyLoserReplacement(old,matches);if(luckyLoser)return luckyLoser;")
source = replace(source, "next.opponentPending?'official_provisional_slot_player_replaced'", "verifiedLuckyLoserReplacement(m,[next])?'official_lucky_loser_same_slot':next.opponentPending?'official_provisional_slot_player_replaced'")
p.write_text(source)
with Path("docs/CourtWatch_v3_handoff_report.md").open("a") as report:
    report.write("\n\n### 2026-11-09 — Sostituzioni lucky loser nell’OOP Tennis Europe\n\n"
                 "L’audit riconosce una sostituzione di un singolo partecipante con designazione ufficiale LL "
                 "nella stessa partita programmata, quando torneo, data, tabellone, turno, campo e numero "
                 "della partita coincidono e lo slot ufficiale è univoco. "
                 "Il controllo continua a bloccare le sparizioni senza riscontro. "
                 "Riprodotto l’artefatto del run 42614157617: tre sostituzioni riconosciute e zero "
                 "sparizioni inspiegate. Verificati quattro casi negativi. Esito live da verificare.\n")
