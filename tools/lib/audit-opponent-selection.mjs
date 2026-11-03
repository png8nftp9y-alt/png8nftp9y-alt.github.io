export function auditOpponentSelection(opponents,input=''){
 const text=String(input).trim();if(!text)return {opponents,kind:'full',requested:[]};
 if(!/^\d+(?:\s*,\s*\d+)*$/.test(text))throw Error('audit_invalid_opponent_selection');
 const requested=[...new Set(text.split(',').map(s=>s.trim()))];
 if(requested.some(id=>!opponents.has(id)))throw Error('audit_selected_opponent_outside_current_scope');
 return {opponents:new Map(requested.map(id=>[id,opponents.get(id)])),kind:'targeted_fresh',requested};
}
