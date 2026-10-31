const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function pendingFutureAlternate(t,today){return valid(today)&&valid(t?.startDate)&&valid(t?.endDate)&&t.endDate>=t.startDate&&t.startDate>today;}
