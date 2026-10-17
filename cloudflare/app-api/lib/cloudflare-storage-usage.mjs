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

// Standard R2 operation classes: https://developers.cloudflare.com/r2/pricing/
const normalizeAction = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const classA = new Set('ListBuckets PutBucket ListObjects ListObjectsV2 PutObject CopyObject CompleteMultipartUpload CreateMultipartUpload LifecycleStorageTierTransition ListMultipartUploads UploadPart UploadPartCopy ListParts PutBucketEncryption PutBucketCors PutBucketLifecycleConfiguration'.split(' ').map(normalizeAction));
const classB = new Set('HeadBucket HeadObject GetObject UsageSummary GetBucketEncryption GetBucketLocation GetBucketCors GetBucketLifecycleConfiguration'.split(' ').map(normalizeAction));
const freeActions = new Set('DeleteObject DeleteObjects DeleteBucket AbortMultipartUpload'.split(' ').map(normalizeAction));
export function r2OperationClass(action) {
  const key = normalizeAction(action);
  return classA.has(key) ? 'classA' : classB.has(key) ? 'classB' : freeActions.has(key) ? 'free' : 'unknown';
}
export function r2OperationUsage(groups, project) {
  const totals = {classA:0, classB:0, free:0, unknown:0}, days = new Map(), actions = new Map();
  for (const group of groups || []) {
    const action = String(group.dimensions?.actionType || 'unknown');
    const category = r2OperationClass(action), count = Number(group.sum?.requests || 0);
    totals[category] += count;
    const date = group.dimensions?.date || 'unknown';
    if (!days.has(date)) days.set(date, {date, classA:0, classB:0, free:0, unknown:0});
    days.get(date)[category] += count;
    actions.set(action, (actions.get(action) || 0) + count);
  }
  return {classA:project(totals.classA, 1_000_000), classB:project(totals.classB, 10_000_000),
    free:totals.free, unknown:totals.unknown, classificationComplete:totals.unknown === 0,
    daily:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    actions:[...actions].map(([action,requests])=>({action,requests,category:r2OperationClass(action)}))};
}
export function r2UsageRows(r2, render, today) {
  if (!r2?.operationClasses) return '<tr><td><b>R2 operazioni A / B</b></td><td colspan="5">Ripartizione non disponibile: in attesa del prossimo audit Cloudflare.</td></tr>';
  const classes = r2.operationClasses;
  const rows = ['classA','classB'].map((key,index)=>render('R2 operazioni Class '+(index ? 'B' : 'A'), classes[key], classes.daily?.find(row=>row.date===today)?.[key] ?? null));
  if (classes.unknown > 0) rows.push('<tr><td><b>R2 operazioni da classificare</b></td><td colspan="5">'+Number(classes.unknown).toLocaleString('it-IT')+' · ripartizione incompleta</td></tr>');
  return rows.join('');
}
