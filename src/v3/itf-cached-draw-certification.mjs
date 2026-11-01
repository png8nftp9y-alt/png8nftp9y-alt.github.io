import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {knownCertifiedDrawDetail} from './itf-known-match-only-draws.mjs';
// Only explicit section certification is reusable. A populated cache alone is insufficient.
export function certifiedCachedItfDraw({competitionId,event,draw}={}){
 if(draw?.error||draw?.failureType||draw?.populated!==true||!Array.isArray(draw.players)||!draw.players.length)return false;
 if(draw.players.some(p=>!String(p.id||p.playerId||'')))return false;
 return Boolean((draw.acquisitionProof?.criterion===AUDIT_CRITERION&&draw.acquisitionProof.complete===true)||knownCertifiedDrawDetail(competitionId,event));
}
