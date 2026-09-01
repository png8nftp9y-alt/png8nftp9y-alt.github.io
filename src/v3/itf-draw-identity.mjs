const clean=value=>String(value??'').trim();

export function eventKey(combo={}){
  return [combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].map(clean).join('-');
}

export function sectionId(combo={}){
  const tournamentId=clean(combo.tournamentId);
  const weekNumber=clean(combo.weekNumber||0);
  if(!tournamentId)throw new Error('ITF section is missing tournamentId');
  return `${eventKey(combo)}@${tournamentId}:${weekNumber}`;
}

export function taskId(competitionId,combo={}){
  return `${clean(competitionId).toUpperCase()}__${sectionId(combo)}`;
}

export function indexSections(combos=[]){
  const seen=new Set();
  return combos.map(combo=>{
    const event=eventKey(combo),id=sectionId(combo);
    if(seen.has(id))throw new Error(`Duplicate ITF section identity: ${id}`);
    seen.add(id);
    return {...combo,event,sectionId:id};
  });
}

export function legacyEventIsUnambiguous(sections=[],event=''){
  return sections.filter(section=>(section.event||eventKey(section))===event).length===1;
}
