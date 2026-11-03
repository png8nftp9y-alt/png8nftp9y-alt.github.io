// Explicit user decisions; exact source hash prevents applying them to changed cards.
const resolutions=[
  {
    "competitionId": "79200AC3-1A80-4553-AF5D-DE9ED42DA4C4",
    "date": "20260614",
    "event": "BS14 - Boys Singles 14 Qualifying",
    "round": "Qualification quarter final",
    "sourceHash": "36db69a585a0012325fcd7465bf6a6d69df925348d68f3f58b372c043a24f100",
    "kind": "walkover",
    "knownPlayerId": "16",
    "confirmedBy": "user",
    "confirmedOn": "2026-11-03"
  },
  {
    "competitionId": "F065F194-9CF9-46A7-92C9-E97A47ECA6EA",
    "date": "20260214",
    "event": "GS14 - Girls Singles 14 Qualifying",
    "round": "Qualification round of 32",
    "sourceHash": "e16379aedfa8509d530b9d1882791ecd7ac5e3ed1f25079b3467b08a04c0ca02",
    "kind": "walkover",
    "knownPlayerId": "151",
    "confirmedBy": "user",
    "confirmedOn": "2026-11-03"
  },
  {
    "competitionId": "B63AC692-6B21-4BCE-BD55-0DDA745AFF30",
    "date": "20260901",
    "event": "BS14 - Boys Singles 14 Main Draw",
    "round": "Round of 16",
    "sourceHash": "80a11e08dc6c374c71d40574f47d7655fc9b1a76003957c17314da63e5e56336",
    "kind": "opponent",
    "knownPlayerId": "1",
    "confirmedBy": "user",
    "confirmedOn": "2026-11-03",
    "opponent": {
      "id": "16",
      "name": "Richard MRAZEK",
      "nationality": "CZE",
      "href": "/sport/player.aspx?id=b63ac692-6b21-4bce-bd55-0dda745aff30&player=16"
    },
    "identitySourceUrl": "https://te.tournamentsoftware.com/tournament/B63AC692-6B21-4BCE-BD55-0DDA745AFF30/draw/1"
  }
];
export function oopUserResolution(card){
 if(card.players?.length!==1)return null;
 return resolutions.find(r=>r.competitionId===card.competitionId.toUpperCase()&&r.date===card.date&&r.event===card.event&&r.round===card.round&&r.sourceHash===card.sourceHash&&r.knownPlayerId===String(card.players[0].id))||null;
}
export function resolveOopCard(card){
 const resolution=oopUserResolution(card);if(!resolution)return card;
 if(resolution.kind==='walkover')return {...card,score:'W/O',userResolution:resolution};
 return {...card,players:[resolution.opponent,...card.players],winnerIds:[resolution.opponent.id],userResolution:resolution};
}
