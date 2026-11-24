// A source-confirmed cancellation resolves the publication wait, not an acquired draw.
export function cancellationEvidence(row) {
 if (!/\bcancel(?:led|ed)\b/i.test(String(row?.tournamentName || ''))) return null;
 const id = String(row?.competitionId || '').toUpperCase();
 if (!/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/.test(id)) return null;
 let url;
 try { url = new URL(row.sourceUrl); } catch { return null; }
 if (url.protocol !== 'https:' || !['itftennis.com','www.itftennis.com'].includes(url.hostname) || !url.pathname.toUpperCase().split('/').includes(id)) return null;
 return {competitionId:id, sourceUrl:row.sourceUrl, tournamentName:row.tournamentName, reason:'official_tournament_cancelled'};
}
export function resolveCancelledTournament(row) {
 const proof = cancellationEvidence(row);
 // Never discard evidence that a draw has actually been acquired or played.
 if (!proof || row.classification === 'complete' || Number(row.acquiredDraws || 0) > 0 || (row.checks || []).some(c => c.acquired === true)) return row;
 if (row.classification === 'cancelled_no_draws') return row;
 return {...row, classification:'cancelled_no_draws', status:'cancelled_no_draws',
  cancellationProof:proof, cancellationPreviousAudit:{events:row.events || [], checks:row.checks || [], missingEvents:row.missingEvents || [], error:row.error || null},
  events:[], checks:[], missingEvents:[], declaredDraws:0, acquiredDraws:0, missingDraws:0, inventoryRequired:false, error:null};
}
export function applyConfirmedCancellations(audit) {
 const tournaments = (audit.tournaments || []).map(resolveCancelledTournament);
 if (tournaments.every((row,i) => row === audit.tournaments[i])) return audit;
 const count = classification => tournaments.filter(row => row.classification === classification).length;
 const sum = key => tournaments.reduce((n,row) => n + Number(row[key] || 0),0);
 const complete = count('complete'), cancelledNoDraws = count('cancelled_no_draws');
 return {...audit, tournaments, summary:{...audit.summary, complete, cancelledNoDraws, resolved:complete + cancelledNoDraws,
  unverifiable:count('unverifiable'), missingDrawsTournaments:count('missing_draws'), declaredDraws:sum('declaredDraws'), acquiredDraws:sum('acquiredDraws'), missingDraws:sum('missingDraws'),
  missingByReason:tournaments.flatMap(row => row.missingEvents || []).reduce((out,event) => (out[event.reasonCode] = (out[event.reasonCode] || 0) + 1,out),{})}};
}
