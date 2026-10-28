import {resumeBackfill} from './tennis-europe-backfill-resume.mjs';
import {recoverDrawWalkovers,discoverDraws} from './tennis-europe-draw-walkovers.mjs';
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
export function emptyDates(html){
 const values=[];
 for(const m of String(html||'').matchAll(/<a\b([^>]*)>/gi)){if(!/js-date-selection-tab/i.test(m[1]))continue;const v=m[1].match(/data-value=["'](20\d{6})["']/i)?.[1];if(v)values.push(v);}
 for(const s of String(html||'').matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)){if(!/(?:\bid=["']Date["']|\bjs-date-selection-select\b)/i.test(s[1]))continue;for(const o of s[2].matchAll(/<option\b[^>]*value=["'](20\d{6})["']/gi))values.push(o[1]);}
 return [...new Set(values)].filter(v=>{const iso=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8),d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso}).sort();
}
export function absoluteDrawLinks(html,pageUrl){return String(html||'').replace(/(<(?:a|option)\b[^>]*?\b(?:href|value)=["'])([^"']+)(["'])/gi,(whole,prefix,href,suffix)=>{try{return prefix+new URL(href.replace(/&amp;/g,'&'),pageUrl).href+suffix}catch{return whole}});}
export function confirmDisposition(html,id){
 const kind=dispositions[id.toUpperCase()];if(!kind)return null;
 const label=kind==='cancelled'?'Cancelled':'Postponed';
 if(!new RegExp('>\\s*'+label+'\\s*<','i').test(html))throw Error('Official status not confirmed: '+id);
 if(kind==='postponed'&&!String(html).toLowerCase().includes('0edf3889-7c03-4427-b261-e5c54ec3b579'))throw Error('Replacement tournament not confirmed');
 return{kind,verifiedAt:new Date().toISOString(),sourceUrl:'https://te.tournamentsoftware.com/tournament/'+id,...(kind==='postponed'?{replacementCompetitionId:'0EDF3889-7C03-4427-B261-E5C54EC3B579'}:{})};
}
export async function recoverEmptyDrawWalkovers(options){
 const originalGet=options.get,id=options.tournament.competitionId,listing='https://te.tournamentsoftware.com/tournament/'+id+'/draws';
 const wrapped=async(url,headers)=>{
  if(String(url)!==listing)return originalGet(url,headers);
  let first='';try{first=absoluteDrawLinks(await originalGet(url,headers),listing);}catch{}
  if(discoverDraws(first,id).length)return first;
  const legacy='https://te.tournamentsoftware.com/sport/draws.aspx?id='+id;
  const fallback=absoluteDrawLinks(await originalGet(legacy,headers),legacy);
  if(!discoverDraws(fallback,id).length)throw Error('No verified draws on canonical or legacy listing');
  return fallback;
 };
 return recoverDrawWalkovers({...options,get:wrapped});
}
