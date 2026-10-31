export function tennisEuropeOopDates(html){
 const values=[];
 for(const m of String(html||'').matchAll(/<a\b([^>]*)>/gi)){if(!/js-date-selection-tab/i.test(m[1]))continue;const v=m[1].match(/data-value=["'](20\d{6})["']/i)?.[1];if(v)values.push(v);}
 for(const s of String(html||'').matchAll(/<select\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/select>/gi)){if(!/(?:\bid=["']Date["']|\bjs-date-selection-select\b)/i.test(s[1]))continue;for(const o of s[2].matchAll(/<option\b[^>]*value=["'](20\d{6})["']/gi))values.push(o[1]);}
 return [...new Set(values)].filter(v=>{const iso=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8),d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso}).sort();
}
export function absoluteDrawLinks(html,pageUrl){return String(html||'').replace(/(<(?:a|option)\b[^>]*?\b(?:href|value)=["'])([^"']+)(["'])/gi,(whole,prefix,href,suffix)=>{try{return prefix+new URL(href.replace(/&amp;/g,'&'),pageUrl).href+suffix}catch{return whole}});}
