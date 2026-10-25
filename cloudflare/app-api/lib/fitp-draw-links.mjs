const GUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function fitpCategoryCode(tournament) {
  const name = String(tournament.TournamentDescription || '').trim();
  const gender = String(tournament.Gender || '').toUpperCase();
  const sex = /misto|mixed/i.test(name) ? 'X' : gender === 'F' || /femminil/i.test(name) ? 'F' : gender === 'M' || /maschil/i.test(name) ? 'M' : '';
  const kind = tournament.IsDoubleTournament === true || tournament.IsDoubleTournament === 1 || /doppio|doubles/i.test(name) ? 'D' : /singolare|singles/i.test(name) || tournament.IsDoubleTournament === false ? 'S' : '';
  let age = name.match(/\b(?:under\s*|u\s*)(\d{1,2})\b/i)?.[1] || '';
  if (!age && /^U\d{1,2}$/i.test(String(tournament.CategoryAge || '').trim())) age = String(tournament.CategoryAge).trim().slice(1);
  const senior = name.match(/\b(?:over\s*|o\s*)(\d{2})\b/i)?.[1];
  return kind && sex ? kind + sex + (age || (senior ? 'O' + senior : '')) : name || 'Tabellone';
}
export function fitpDrawLinks(detail, competitionId) {
  const rows = [], seen = new Set();
  for (const tournament of detail?.Tournaments || []) {
    const category = String(tournament.TournamentDescription || '');
    const categoryCode = fitpCategoryCode(tournament);
    const sections = [];
    for (const section of tournament.Sections || []) {
      const tournamentId = String(section.TournamentId ?? tournament.TournamentId ?? '');
      const phaseId = String(section.SectionCode || '');
      if (section.CompetitionId && String(section.CompetitionId).toUpperCase() !== competitionId.toUpperCase()) continue;
      if (!/^\d+$/.test(tournamentId) || !GUID.test(phaseId) || Number(section.IsGroup) === 1) continue;
      const url = `https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3?tournamentId=${encodeURIComponent(tournamentId)}&phaseId=${encodeURIComponent(phaseId)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const phase = String(section.SectionDescription || section.SectionType || 'Tabellone').trim();
      const shortPhase = /inizial/i.test(phase) ? 'INIZIALE' : /intermedi/i.test(phase) ? 'INTERMEDIO' : /final|conclu|concu/i.test(phase) ? 'FINALE' : /inizial/i.test(section.SectionType || '') ? 'INIZIALE' : /final|conclu/i.test(section.SectionType || '') ? 'FINALE' : 'INTERMEDIO';
      sections.push({tournamentId,phaseId,category,categoryCode,phase,shortPhase,url});
    }
    if(sections.length===2){
      // Preserve each URL; only the compact two-draw display names change.
      const final=sections.findIndex(row=>/finale/i.test(row.phase));
      const finalIndex=final>=0?final:1;
      for(let i=0;i<sections.length;i++)sections[i].shortPhase=i===finalIndex?'FINALE':'INIZIALE';
    }
    for (const row of sections) rows.push({...row,label:categoryCode + (sections.length > 1 ? ' ' + row.shortPhase : '')});
  }
  const duplicates = new Map();
  for (const row of rows) duplicates.set(row.label,(duplicates.get(row.label)||0)+1);
  const positions = new Map();
  for (const row of rows) if (duplicates.get(row.label)>1) {const label=row.label;const n=(positions.get(label)||0)+1;positions.set(label,n);row.label += ' ' + n;}
  return rows;
}
export async function loadFitpDrawLinks(competitionId, fetcher=fetch) {
  if (!GUID.test(competitionId)) {const error=new Error('invalid_fitp_competition_id');error.status=400;throw error;}
  const response = await fetcher('https://dp-myfit-test-function-v2.azurewebsites.net/api/v3/puc/competizione/dettaglio', {
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({competitionUid:competitionId}),signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('fitp_unavailable');
  const detail = await response.json();
  if (!detail || !Array.isArray(detail.Tournaments)) throw new Error('fitp_invalid_response');
  if (detail.CompetitionUid && String(detail.CompetitionUid).toUpperCase() !== competitionId.toUpperCase()) throw new Error('fitp_competition_mismatch');
  return {competitionId,draws:fitpDrawLinks(detail,competitionId),checkedAt:new Date().toISOString()};
}
