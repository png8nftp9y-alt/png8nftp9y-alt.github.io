export async function appSnapshotMembership(db, selection, userId) {
  const result = await db.prepare(selection).bind(userId).all();
  if (result.success === false || !Array.isArray(result.results) ||
      result.results.some(row => typeof row.courtwatch_id !== 'string' || !row.courtwatch_id))
    throw Error('snapshot_membership_unavailable');
  return [...new Set(result.results.map(row => row.courtwatch_id))];
}
