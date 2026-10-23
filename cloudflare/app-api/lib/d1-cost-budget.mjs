// Insights returns the top query groups, not the complete account usage.
export function d1CostBudget(reads, writes, days = 31) {
  if (!Array.isArray(reads) || !reads.length || !Array.isArray(writes) || !writes.length || !Number.isFinite(days) || days <= 0)
    throw Error('D1_cost_insights_incomplete');
  const sum = (rows, field) => rows.reduce((total, row) => {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('D1_cost_insights_invalid_' + field);
    return total + value;
  }, 0);
  const projectedMonthlyReads = Math.ceil(sum(reads, 'totalRowsRead') * 30 / days);
  const projectedMonthlyWrites = Math.ceil(sum(writes, 'totalRowsWritten') * 30 / days);
  const includedMonthlyReads = 25000000000, includedMonthlyWrites = 50000000;
  const guardrailReads = 20000000000, guardrailWrites = 40000000;
  const status = projectedMonthlyReads > includedMonthlyReads || projectedMonthlyWrites > includedMonthlyWrites
    ? 'exceeded' : projectedMonthlyReads > guardrailReads || projectedMonthlyWrites > guardrailWrites ? 'warning' : 'green';
  return {plan:'workers-paid',includedMonthlyReads,includedMonthlyWrites,guardrailReads,guardrailWrites,
    projectedMonthlyReads,projectedMonthlyWrites,readHeadroom:includedMonthlyReads-projectedMonthlyReads,
    writeHeadroom:includedMonthlyWrites-projectedMonthlyWrites,status,
    scope:'top-query-groups-only',projection:'30-day lower-bound estimate from selected query groups; not billing-cycle totals'};
}
