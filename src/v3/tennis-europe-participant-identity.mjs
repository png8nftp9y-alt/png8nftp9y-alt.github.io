const base='https://te.tournamentsoftware.com';
const decode=value=>String(value||'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(entity,n)=>{
 const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);
 return cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):entity;
}).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;/gi,"'");
const clean=value=>decode(String(value||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const key=value=>clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(' ').sort().join(' ');
export function participantIdentity(item){
 const cells=item.cells||[];let countryCode='',playerName='';
 for(let i=0;i<cells.length;i++){
  const m=clean(cells[i]).match(/\[([A-Z]{2,3})\]\s*(.*)/);if(!m)continue;
  countryCode=m[1];playerName=clean(m[2]||cells[i+1]);break;
 }
 const links=[];
 for(const m of String(item.rowHtml||'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let u;try{u=new URL(decode(m[1]),base)}catch{continue}
  if(u.hostname!=='te.tournamentsoftware.com'||u.protocol!=='https:')continue;
  const id=u.pathname.match(/^\/player-profile\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i)?.[1];
  if(id||/^\/sport\/player(?:\.aspx)?$/i.test(u.pathname))links.push({name:clean(m[2]),url:u.href,id:id?.toUpperCase()||''});
 }
 playerName=playerName||links.find(p=>p.name.length>=3)?.name||'';
 playerName=playerName.replace(/\s*\((?:Main Draw|Qualifying) Wildcard\)\s*$/i,'').trim();
 if(!playerName||/^#?\d+(?:\.\d+)?$/.test(playerName))return null;
 // The icon and the text belong to one acceptance row. Never borrow a neighbour's ID.
 const compatible=links.filter(p=>!p.name||key(p.name)===key(playerName));
 const ids=new Set(compatible.map(p=>p.id).filter(Boolean));
 const native=ids.size===1?compatible.find(p=>p.id):null;
 const birthYear=cells.map(clean).filter(v=>/^\d{4}$/.test(v)).map(Number).find(y=>y>=1900&&y<=new Date().getUTCFullYear());
 return{playerName,countryCode,participantId:native?.id||'',profileUrl:native?.url||(ids.size===0?compatible.find(p=>!p.id)?.url||'':''),...(birthYear?{birthYear}:{})};
}
