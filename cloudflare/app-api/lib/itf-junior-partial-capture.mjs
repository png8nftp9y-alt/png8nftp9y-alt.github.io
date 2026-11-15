// Retain only pages whose publication and individual rows have been validated.
export function createRankingCapture(category){
 let rankDate,total,lastRank=0,nextSkip=0,invalid=false;const rows=new Map();
 function add(url,json){
  try{
   const skip=Number(new URL(url).searchParams.get('skip')),date=json?.rankDate,items=json?.items;
   if(!['B','G'].includes(category)||!/^\d{2} [A-Za-z]+ \d{4}$/.test(date||'')||!Number.isFinite(Date.parse(date+' UTC'))||!Number.isInteger(json.totalItems)||json.totalItems<1||json.totalItems>30000||!Array.isArray(items)||!items.length||items.length>100||!Number.isInteger(skip)||skip<0||skip+items.length>json.totalItems)throw Error('Invalid ranking page');
   if(rankDate&&(date!==rankDate||total!==json.totalItems))throw Error('Publication changed during acquisition');
   if(skip===0&&items[0]?.rank!==1)throw Error('First rank is not 1');
   if(skip===nextSkip&&items[0].rank<lastRank)throw Error('Ranking order changed between pages');
   let previous=0;
   for(const p of items){
    if(!/^800\d{6}$/.test(String(p.playerId))||!Number.isSafeInteger(p.playerId)||!Number.isInteger(p.rank)||p.rank<1||p.rank<previous||!Number.isFinite(p.points))throw Error('Invalid ranking row');
    previous=p.rank;const known=rows.get(p.playerId);
    if(known&&(known.rank!==p.rank||known.points!==p.points))throw Error('Conflicting native ranking identity');
   }
   // Stage the entire page only after all of it has passed validation.
   rankDate??=date;total??=json.totalItems;
   if(skip===nextSkip){nextSkip+=items.length;lastRank=previous;}
   for(const p of items)rows.set(p.playerId,{playerId:p.playerId,rank:p.rank,points:p.points,playerGivenName:String(p.playerGivenName||''),playerFamilyName:String(p.playerFamilyName||''),playerNationalityCode:String(p.playerNationalityCode||''),gender:String(p.gender||'')});
   if(rows.size>total)throw Error('More distinct players than declared');
  }catch(error){invalid=true;throw error;}
 }
 function snapshot(){return invalid||!rows.size?null:{category,rankingDate:new Date(Date.parse(rankDate+' UTC')).toISOString().slice(0,10),total,items:[...rows.values()]};}
 return {add,snapshot};
}
