import {resumeBackfill} from './tennis-europe-backfill-resume.mjs';
import {recoverDrawWalkovers} from './tennis-europe-draw-walkovers.mjs';
export const dispositions={
 'B7087FEB-72B4-47FF-89B9-C6C514A852E9':'cancelled',
 '9DFF7F0A-502A-4238-93C2-8493AEA83545':'cancelled',
 'DA3563D7-C66E-4433-ABCF-68BB763566D4':'cancelled',
 '406935F0-5892-4A1C-A742-21FAC003C2CA':'cancelled',
 'CED0FB4C-BCF1-4B7A-9375-B3CA35748382':'cancelled',
 'DED799CF-D652-4F96-98C0-9089EE97719F':'postponed'
};
export const playedIds=['1D172AFA-8F8F-48FA-BE61-DBC56B3FCEFD','9B4B1B27-59C9-4AA5-AB5B-56D92A3D0824','BD9731FE-79F8-46EB-AAA6-C62A2C8A6F9C','88142CF1-DBF6-4C63-B634-ACADD41B9585'];
export const targetIds=new Set([...playedIds,...Object.keys(dispositions)]);
export function resumeEmptyBackfill(source,queue,options){
 if(!source)throw Error('Explicit checkpoint required');
 const valid=resumeBackfill(source,queue,options);
 if(valid.pending.length)throw Error('Baseline source failures cannot be mixed with empty-tournament recovery');
 const pending=[],completed=[];
 for(const t of valid.completed){if(targetIds.has(t.competitionId.toUpperCase())){if(t.matches.length||t.dates.length||t.drawRecovery.draws)throw Error('Refusing to replace acquired tournament data');pending.push(queue.find(x=>x.competitionId===t.competitionId));}else{if(!t.matches.length&&!/(?:winter|summer)\s+cups?|lampo\s+trophy/i.test(t.tournamentName||''))throw Error('Unknown empty tournament outside the approved scope: '+t.competitionId);completed.push(t);}}
 return{completed,pending};
}
export {tennisEuropeOopDates as emptyDates,absoluteDrawLinks} from './tennis-europe-source-discovery.mjs';
export function confirmDisposition(html,id){
 const kind=dispositions[id.toUpperCase()];if(!kind)return null;
 const label=kind==='cancelled'?'Cancelled':'Postponed';
 if(!new RegExp('>\\s*'+label+'\\s*<','i').test(html))throw Error('Official status not confirmed: '+id);
 if(kind==='postponed'&&!String(html).toLowerCase().includes('0edf3889-7c03-4427-b261-e5c54ec3b579'))throw Error('Replacement tournament not confirmed');
 return{kind,verifiedAt:new Date().toISOString(),sourceUrl:'https://te.tournamentsoftware.com/tournament/'+id,...(kind==='postponed'?{replacementCompetitionId:'0EDF3889-7C03-4427-B261-E5C54EC3B579'}:{})};
}
// The ordinary shared reader now includes the verified legacy fallback.
export const recoverEmptyDrawWalkovers=recoverDrawWalkovers;
