import {createHash} from 'node:crypto';
export const COMPETITION='J-J60-ITA-2026-001';
export const PLAYERS=[{id:'800687485',name:'Marco Mastropasqua',expected:'present'},{id:'800710276',name:'Leonardo Ceschin',expected:'absent'},{id:'800697548',name:'Matteo Rusca',expected:'present'}];
export function storedPescara(rows,id){const row=rows.find(x=>String(x.source_player_id)===id);if(!row)return null;const doc=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;return doc?.tournaments?.find(t=>String(t.competitionId).toUpperCase()===COMPETITION)||null;}
export function checkStored(expected,t){if(!t)return false;const excluded=/^(excluded|withdrawn|removed)$/.test(t.entryStatus||'');return expected==='absent'?excluded:!excluded&&t.entryStatus==='official_draw'&&t.drawConfirmed===true;}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
export function relevantSourceFingerprint(t){return hash({competitionId:t?.competitionId,inventory:(t?.eventInventory||[]).filter(x=>x.event?.startsWith('B-')).map(x=>x.event).sort(),sections:Object.fromEntries(Object.entries(t?.eventCache||{}).filter(([event])=>event.startsWith('B-')).sort().map(([event,d])=>[event,{populated:d.populated,error:d.error||null,failureType:d.failureType||null,resolution:d.resolution||null,acquisitionProof:d.acquisitionProof?{criterion:d.acquisitionProof.criterion,complete:d.acquisitionProof.complete}:null,resolutionProof:d.resolutionProof?{criterion:d.resolutionProof.criterion,complete:d.resolutionProof.complete,mainEvents:d.resolutionProof.mainEvents}:null,ids:(d.players||[]).map(p=>String(p.id||p.playerId||'')).sort()}]))});}
export function relevantIndexFingerprint(rows){return hash(PLAYERS.map(p=>{const t=storedPescara(rows,p.id);return{id:p.id,tournament:t?{competitionId:t.competitionId,entryStatus:t.entryStatus,calendarState:t.calendarState,drawConfirmed:t.drawConfirmed,acceptanceCode:t.acceptanceCode,alternateDrawDecision:t.alternateDrawDecision,drawDecisionEvents:t.drawDecisionEvents}:null};}));}
export function historicalVerificationDate(endDate){
 const value=String(endDate||'').slice(0,10),date=new Date(value+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('pescara_end_date_invalid');
 date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);
}
