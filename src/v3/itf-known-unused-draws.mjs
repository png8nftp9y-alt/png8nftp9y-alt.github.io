const KNOWN_UNUSED_DRAWS=new Set([
  'J-J30-MDV-2026-004__G-S-Q-KO',
  'J-J30-PAN-2026-002__G-S-Q-KO',
  'J-J30-TJK-2026-005__G-S-Q-KO',
  'J-J60-TTO-2026-002__G-S-Q-KO'
]);

export function isKnownUnusedDraw(competitionId,event){
  return KNOWN_UNUSED_DRAWS.has(String(competitionId||'').toUpperCase()+'__'+String(event||'').toUpperCase());
}
