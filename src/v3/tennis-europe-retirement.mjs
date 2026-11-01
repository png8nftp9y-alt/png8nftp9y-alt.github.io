// Match-local official messages only: player names, scripts and page navigation
// must never establish a retirement. W/O/default/disqualification stay separate.
export function officialRetirement(html,sourceUrl=''){
 const labels=[...String(html||'').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi,'').matchAll(/<(?:span|div)\b[^>]*class=["'][^"']*\bmatch__message\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim());
 const label=labels.find(s=>/^(?:retired|retirement|ret\.?|rit\.?|ritirato|ritirata|abandoned)$/i.test(s));
 return {retirementChecked:true,retired:Boolean(label),...(label?{retirementSource:'official_match_message',retirementLabel:label,retirementSourceUrl:sourceUrl}:{})};
}
export function retirementFields(match){return match.retirementChecked===true?{retirementChecked:true,retired:match.retired===true,...(match.retired?{retirementSource:match.retirementSource,retirementLabel:match.retirementLabel,retirementSourceUrl:match.retirementSourceUrl}:{})}:{};}
export function auditRetirements(source){
 const matches=source.matches||[],official=matches.filter(m=>m.retired===true&&m.retirementSource==='official_match_message');
 const unchecked=matches.filter(m=>m.retirementChecked!==true),invalid=official.filter(m=>m.status!=='completed'||!m.winnerPlayerIds?.length||!m.retirementSourceUrl);
 const drawGaps=(source.tournaments||[]).flatMap(t=>(t.drawRecovery?.issues||[]));
 return {version:1,scope:'tennis-europe acquired OOP and supported draw messages',sourceGeneratedAt:source.generatedAt||'',status:unchecked.length||invalid.length||drawGaps.length?'incomplete':'checked',matches:matches.length,checked:matches.length-unchecked.length,unchecked:unchecked.length,officialRetirements:official.length,invalid:invalid.map(m=>m.id),drawGaps,cases:official.map(m=>({matchId:m.id,competitionId:m.competitionId,date:m.date,score:m.score,players:(m.players||[]).map(p=>p.name),sourceUrl:m.retirementSourceUrl})),limitation:'Checks acquired documents only; missing source documents and unsupported formats are not certified.'};
}
