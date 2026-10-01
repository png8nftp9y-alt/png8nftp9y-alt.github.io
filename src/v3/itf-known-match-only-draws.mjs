const KNOWN_MATCH_ONLY_DRAWS=new Set([
  'J-J200-TUR-2026-002__G-S-Q-KO',
  'J-J30-ALG-2026-004__G-S-Q-KO'
]);

const KNOWN_CERTIFIED_DRAWS=new Map([
  ['J-J60-ITA-2026-001__B-D-M-KO','verifica manuale Pescara: 16/16 coppie'],
  ['J-J60-ITA-2026-001__G-D-M-KO','verifica manuale Pescara: 16/16 coppie']
]);

export function isKnownMatchOnlyDraw(competitionId,event){
  return KNOWN_MATCH_ONLY_DRAWS.has(
    String(competitionId||'').toUpperCase()+'__'+String(event||'').toUpperCase()
  );
}

export function knownCertifiedDrawDetail(competitionId,event){
  return KNOWN_CERTIFIED_DRAWS.get(
    String(competitionId||'').toUpperCase()+'__'+String(event||'').toUpperCase()
  )||'';
}
