import {createHash} from 'node:crypto';
import {dispositions,confirmDisposition} from './tennis-europe-empty-recovery.mjs';
export async function resolveOopScope(tournament,days,get){
 if(days.length)return null; // Published OOPs always remain subject to acquisition.
 const competitionId=String(tournament.competitionId).toUpperCase();
 if(/winter\s*cups?|summer\s*cups?|lampo\s*trophy/i.test(tournament.tournamentName||''))return {version:1,status:'deferred_team',competitionId,scope:'Individual OOP acquisition only; team coverage remains deferred',days:[],issues:[]};
 if(!dispositions[competitionId])return null; // Unknown empty individual tournaments still fail.
 const html=await get('https://te.tournamentsoftware.com/tournament/'+competitionId);
 const disposition=confirmDisposition(html,competitionId);
 return {version:1,status:disposition.kind,competitionId,scope:'Verified event disposition; no invented matches',disposition:{...disposition,sourceHash:createHash('sha256').update(html).digest('hex')},days:[],issues:[]};
}
