import {archivedCandidates} from './archived-profile-evidence.mjs';
export function nativeAcceptanceEvidence(doc){
 if(doc?.status!=='tennis_europe_participant_cache_complete'||!doc.tournaments||typeof doc.tournaments!=='object'||Array.isArray(doc.tournaments))throw Error('native_acceptance_cache_incomplete');
 const tournaments=Object.values(doc.tournaments);
 if(!tournaments.length||tournaments.some(t=>!Array.isArray(t?.participants)))throw Error('native_acceptance_cache_incomplete');
 return archivedCandidates('tennis-europe',tournaments.flatMap(t=>t.participants));
}
