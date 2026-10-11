// Apply calendar-year upper age limits only to current profile rankings.
// Historical match snapshots keep their original category and ranking.
export function currentRankingCategoryAllowed(category,player={},year=new Date().getUTCFullYear()){
 const limit=Number(String(category||'').match(/(?:U|B|G)(14|16)\b/i)?.[1]);
 const birthYear=Number(player.birthYear||String(player.birthDate||player.dateOfBirth||'').slice(0,4));
 return !limit||!Number.isInteger(birthYear)||birthYear<1900||birthYear>year||year-birthYear<=limit;
}
