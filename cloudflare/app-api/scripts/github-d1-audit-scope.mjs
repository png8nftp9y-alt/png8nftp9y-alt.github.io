import {isKnownMatchOnlyDraw} from '../../../src/v3/itf-known-match-only-draws.mjs';
export function relationScope(rows){return {expected:rows.filter(r=>r.permanenceStatus!=='rejected_by_complete_singles_draws'),excluded:rows.filter(r=>r.permanenceStatus==='rejected_by_complete_singles_draws')};}
export function cachedDrawScope(tournaments){
 const expected=[],excluded=[];
 for(const t of Object.values(tournaments)){
  const inventory=t.eventInventory||[];
  const rr=new Set(inventory.filter(e=>(e.combo?.structure||e.event.split('-').at(-1))==='RR'&&/^[BG]-S-M$/.test(e.family||e.combo?.family)).map(e=>e.family||e.combo?.family));
  for(const [event,d]of Object.entries(t.eventCache||{})){
   if(d.populated!==true||d.error||d.failureType)continue;
   const row={competitionId:String(t.competitionId).toUpperCase(),event};
   const reason=isKnownMatchOnlyDraw(t.competitionId,event)?'explicit_user_exclusion':/^[BG]-S-M-KO$/.test(event)&&rr.has(event.slice(0,-3))?'singles_main_ko_in_rr_family':null;
   if(reason)excluded.push({...row,reason});else expected.push(row);
  }
 }
 return{expected,excluded};
}
