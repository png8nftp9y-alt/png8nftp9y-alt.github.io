const KNOWN_MATCH_ONLY_DRAWS=new Set([
  'J-J200-TUR-2026-002__G-S-Q-KO',
  'J-J30-ALG-2026-004__G-S-Q-KO'
]);

export function isKnownMatchOnlyDraw(competitionId,event){
  return KNOWN_MATCH_ONLY_DRAWS.has(
    String(competitionId||'').toUpperCase()+'__'+String(event||'').toUpperCase()
  );
}
