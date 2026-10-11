// Apply calendar-year upper age limits only to current profile rankings.
// Historical match snapshots keep their original category and ranking.
export function currentRankingCategoryAllowed(category,player={},year=new Date().getUTCFullYear()){
 const limit=Number(String(category||'').match(/(?:U|B|G)(14|16)\b/i)?.[1]);
 const birthYear=Number(player.birthYear||String(player.birthDate||player.dateOfBirth||'').slice(0,4));
 return !limit||!Number.isInteger(birthYear)||birthYear<1900||birthYear>year||year-birthYear<=limit;
}

export const latestRankingPublicationsSql=['B14','G14','B16','G16'].map(category=>`SELECT '${category}' AS category,MAX(ranking_date) AS ranking_date FROM tennis_europe_ranking_history WHERE category='${category}'`).join(' UNION ALL ');
export function rankingPublicationDate(category,player,dates={}){
 const age=String(category||'').match(/(?:U|B|G)(14|16)\b/i)?.[1];
 if(dates[category])return dates[category];
 const sex=String(player.sex||player.gender||'').toUpperCase();
 if(age&&['M','F'].includes(sex))return dates[(sex==='M'?'B':'G')+age]||'';
 return age?[dates['B'+age],dates['G'+age]].filter(Boolean).sort().at(-1)||'':'';
}
export function latestPreparedPlayerRanking(player,publicationDates){
 const rankings={},dates={};
 for(const [key,ranking] of Object.entries(player.tennisEuropeRankings||{})){
  const category=key==='u14'?'U14':key==='u16'?'U16':key,date=player.tennisEuropeRankingDates?.[key],latest=rankingPublicationDate(category,player,publicationDates);
  if(ranking&&date&&date===latest&&currentRankingCategoryAllowed(category,player)){rankings[key]=ranking;dates[key]=date;}
 }
 return{...player,tennisEuropeLatestRankingDates:publicationDates,tennisEuropeRankings:rankings,tennisEuropeRankingDates:dates,tennisEuropeRanking:Object.entries(rankings).map(([key,rank])=>`n°${rank} TE ${key.toUpperCase()}`).join(' · ')};
}
