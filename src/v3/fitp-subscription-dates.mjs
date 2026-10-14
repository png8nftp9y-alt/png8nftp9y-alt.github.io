// SubscriptionDate is the player's PUC registration date, not an observation
// timestamp or the tournament's start date. Preserve the source calendar day.
export function fitpSubscriptionDates(entry={}) {
 const values=[...(Array.isArray(entry.subscriptionDates)?entry.subscriptionDates:[]),entry.subscriptionDate,entry.SubscriptionDate];
 const dates=values.map(value=>{
  const text=String(value||'').trim();
  let m=text.match(/^(20\d{2})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if(!m){const local=text.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:$|\s)/);if(local)m=[local[0],local[3],local[2].padStart(2,'0'),local[1].padStart(2,'0')];}
  if(!m)return '';
  const [year,month,day]=m.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${m[1]}-${m[2]}-${m[3]}`:'';
 });
 return [...new Set(dates.filter(Boolean))].sort();
}
export function mergeFitpSubscriptionDates(previous={},incoming={}) {
 return fitpSubscriptionDates({subscriptionDates:[...fitpSubscriptionDates(previous),...fitpSubscriptionDates(incoming)]});
}

// Keep each category tied to its own date; never pair aggregated dates/draws.
export function fitpSubscriptionRegistrations(entry={}) {
 const rows=Array.isArray(entry.subscriptionRegistrations)?entry.subscriptionRegistrations:
  entry.draw?[{category:entry.draw,subscriptionDate:entry.subscriptionDate||entry.SubscriptionDate}]:[];
 const unique=new Map();
 for(const row of rows){
  const category=String(row.category||row.draw||'').trim();
  if(!category)continue;
  const date=fitpSubscriptionDates({subscriptionDate:row.subscriptionDate||row.date||row.SubscriptionDate})[0]||'';
  unique.set(JSON.stringify([category,date]),{category,subscriptionDate:date});
 }
 return [...unique.values()].sort((a,b)=>a.category.localeCompare(b.category,'it')||a.subscriptionDate.localeCompare(b.subscriptionDate));
}
export function mergeFitpSubscriptionRegistrations(previous={},incoming={}) {
 return fitpSubscriptionRegistrations({subscriptionRegistrations:[...fitpSubscriptionRegistrations(previous),...fitpSubscriptionRegistrations(incoming)]});
}
