// Current opponent header only. Historical match rankings are never changed here.
export function opponentEuropeProfile({person={},historyProfile=null,rankings=[],latestRankingDates={},event='',year=new Date().getUTCFullYear()}={}) {
 const birthYear=Number(person.birthYear||String(person.birthDate||person.dateOfBirth||'').slice(0,4));
 const age=Number.isInteger(birthYear)&&birthYear>=1900&&birthYear<=year?year-birthYear:null;
 const eventAge=Number(String(event).match(/(?:^|\D)(10|12|14|16)(?!\d)/)?.[1])||null;
 // Current calendar age outranks the category of an old match used for navigation.
 const u12=age!==null?age<=12:eventAge!==null&&eventAge<=12;
 const categoryAge=age!==null?(age<=14?14:age<=16?16:null):eventAge;
 const sex=String(person.sex||person.gender||'').toUpperCase();
 const gender=sex==='F'?'G':sex==='M'?'B':/^(G|GIRL)/i.test(event)?'G':/^(B|BOY)/i.test(event)?'B':'';
 const wanted=gender&&categoryAge?gender+categoryAge:'';
 const eligible=rankings.filter(r=>Number(r.ranking)>0&&r.ranking_date===latestRankingDates[r.category]&&(!age||age<=Number(String(r.category).slice(1))));
 const ranked=u12?null:eligible.find(r=>r.category===wanted)||(!u12?eligible[0]:null);
 const nationality=person.nationality||person.nationalityCode||person.countryCode||person.country||ranked?.nationality||historyProfile?.nationality||'';
 const profile={nationality,birthYear:age!==null?birthYear:null,ranking:null,ranking_date:'',category:'',europeRankingStatus:'unknown'};
 if(ranked)return{...profile,...ranked,nationality,europeRankingStatus:'ranked'};
 if(u12)profile.europeRankingStatus='unranked-u12';
 else if((age!==null&&age>=13&&age<=16)||(age===null&&[14,16].includes(eventAge))) {
  // Missing publication evidence is not evidence of an unranked player.
  if(Object.values(latestRankingDates).some(Boolean))profile.europeRankingStatus='unranked';
 }
 return profile;
}
