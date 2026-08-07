// Court Watch v3 entries engine
// Purpose: player -> official circuit entries -> tournament_entries/tournaments.
// Must stay independent from v1 UI and legacy app logic.
export const ENGINE='v3-entries';
export const CIRCUITS=['fitp','tennis-europe','itf'];
export async function runEntriesEngine(){
  throw new Error('TODO v3: implement official FITP/P.U.C., Tennis Europe and ITF entry discovery per player');
}
