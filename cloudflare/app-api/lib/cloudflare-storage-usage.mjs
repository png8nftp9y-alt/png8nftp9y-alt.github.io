// Storage is a current level, not a counter accumulated during the billing cycle.
export function storageUsageMetric(value, limit) {
  const total = Number(value || 0);
  const utilization = total / limit;
  return {
    kind: 'storage', total, limit, utilization,
    // Keep the existing snapshot shape with a constant-space assumption.
    // No growth forecast is available from a single inventory measurement.
    projected: total, projectedUtilization: utilization,
    last24hBudget: null, dailyAverage: null,
    status: utilization <= .8 ? 'green' : utilization <= 1 ? 'yellow' : 'red',
  };
}
