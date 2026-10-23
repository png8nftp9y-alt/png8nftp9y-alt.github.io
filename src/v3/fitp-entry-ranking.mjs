// Rank comes from the latest dated registration, never from ranking strength.
export function latestFitpEntryRankings(doc, now = new Date().toISOString().slice(0,10)) {
 const found = new Map();
 const snapshots = doc.tournaments ? Object.entries(doc.tournaments).map(([id,t])=>({...t,competitionId:t.competitionId||id})) : [];
 const rows = snapshots.flatMap(t=>(t.participants||[]).map(p=>({...p,competitionId:t.competitionId}))).concat(doc.entries||[]);
 for(const row of rows){
  const card=String(row.membershipCard||''), ranking=String(row.ranking||'').replace(/\s+/g,'').toUpperCase();
  if(!/^\d{6,12}$/.test(card)||!/^(?:[1-4]\.(?:[1-9]|NC)|NC)$/.test(ranking))continue;
  const dates=[row.subscriptionDate,...(row.subscriptionDates||[]),...(row.subscriptionRegistrations||[]).map(r=>r.subscriptionDate)].filter(Boolean).map(String).sort();
  const date=dates.at(-1)||'', day=date.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>now)continue;
  const candidate={ranking,subscriptionDate:date,competitionId:String(row.competitionId||'')};
  const old=found.get(card);
  if(!old||date>old.subscriptionDate)found.set(card,candidate);
  else if(date===old.subscriptionDate&&ranking!==old.ranking)found.set(card,{...old,ranking:'',ambiguous:true});
 }
 return new Map([...found].filter(([,r])=>r.ranking));
}
