import crypto from 'node:crypto';
export const UNIVERSAL_VERSION='courtwatch-universal-v1';
export const CIRCUITS=new Set(['fitp','tennis-europe','itf','manual']);
export function normalizeCircuit(value){const n=String(value||'').trim().toLowerCase().replace(/[_ ]+/g,'-');if(n==='tenniseurope'||n==='te')return 'tennis-europe';if(!CIRCUITS.has(n))throw new Error('Unsupported circuit: '+(value||'<empty>'));return n}
export function stableId(type,...parts){const raw=parts.map(v=>String(v??'').trim()).join('|');if(!raw.replaceAll('|',''))throw new Error('Cannot build '+type+' id from empty values');return type+'_'+crypto.createHash('sha256').update(raw).digest('hex').slice(0,24)}
export function sourceRef(circuit,sourceId,sourceUrl='',observedAt=''){return {circuit:normalizeCircuit(circuit),sourceId:String(sourceId||''),sourceUrl:String(sourceUrl||''),observedAt:String(observedAt||'')}}
export function compact(value){if(Array.isArray(value))return value.map(compact);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,compact(v)]))}
export function uniqueById(rows,label){const map=new Map();for(const row of rows){if(!row?.id)throw new Error(label+' row without id');const old=map.get(row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw new Error('Conflicting '+label+' id: '+row.id);map.set(row.id,row)}return [...map.values()]}
export function ensureIsoDate(value,field,{allowEmpty=true}={}){const text=String(value||'');if(!text&&allowEmpty)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('Invalid '+field+': '+(text||'<empty>'));return text}
