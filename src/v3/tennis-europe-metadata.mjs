function decode(value){
  return String(value||'')
    .replace(/&#(x?[0-9a-f]+);/gi,(_,number)=>String.fromCodePoint(number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):parseInt(number,10)))
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

function text(value){return decode(String(value||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
function attribute(tag,name){return decode((String(tag||'').match(new RegExp(`${name}=["']([^"']*)["']`,'i'))||[])[1]||'')}

function normalizeDesignation(value){
  const marker=String(value||'').trim().replace(/^[\[(]\s*|\s*[\])]$/g,'').toUpperCase();
  if(/^\d{1,2}$/.test(marker)&&Number(marker)>0)return String(Number(marker));
  return /^(?:WC|Q)$/.test(marker)?marker:'';
}

export function tennisEuropeParticipant(link){
  const source=String(link||''),valueHtml=(source.match(/<span\b[^>]*class=["'][^"']*nav-link__value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||source;
  const rawName=text(valueHtml),allText=text(source);
  const explicit=['data-seed','data-seeding','data-entry-type','data-entry','data-designation'].map(name=>normalizeDesignation(attribute(source,name))).find(Boolean)||'';
  const bracketed=[...allText.matchAll(/[\[(]\s*(\d{1,2}|WC|Q)\s*[\])]/gi)].map(match=>normalizeDesignation(match[1])).filter(Boolean);
  const labelled=(allText.match(/\b(?:seed(?:ed)?|seeding|entry(?: type)?)\s*[:#-]?\s*(\d{1,2}|WC|Q)\b/i)||[])[1]||'';
  const nameSuffix=(rawName.match(/\s*[\[(]\s*(\d{1,2}|WC|Q)\s*[\])]\s*$/i)||[])[1]||'';
  const designation=explicit||normalizeDesignation(nameSuffix)||bracketed.at(-1)||normalizeDesignation(labelled);
  const name=text(rawName.replace(/\s*[\[(]\s*(?:\d{1,2}|WC|Q)\s*[\])]\s*$/i,'').replace(/\s*\[[^\]]*\]\s*$/,''));
  const id=attribute(source,'data-player-id'),nationality=attribute(source,'data-nationality-id'),href=attribute(source,'href').replace(/&amp;/g,'&');
  return{id,name,nationality,designation,seed:/^\d+$/.test(designation)?Number(designation):null,entryType:/^(?:WC|Q)$/.test(designation)?designation:'',href};
}

function normalizeSurface(value){
  const source=text(value).replace(/\b(?:indoor|outdoor)\b/gi,' ').replace(/[|,/]+/g,' ').replace(/\s+/g,' ').trim();
  if(!source)return'';
  if(/artificial\s+clay|synthetic\s+clay/i.test(source))return'Artificial clay';
  if(/clay|red\s+clay/i.test(source))return'Clay';
  if(/hard|acrylic|plexicushion|greenset|decoturf/i.test(source))return'Hard';
  if(/carpet/i.test(source))return'Carpet';
  if(/grass/i.test(source))return'Grass';
  return source.length<=50?source:'';
}

function normalizeEnvironment(value){
  const source=text(value);
  if(/\bindoor\b/i.test(source))return'Indoor';
  if(/\boutdoor\b/i.test(source))return'Outdoor';
  return'';
}

export function tennisEuropeCourtConditions(html){
  const source=String(html||''),pairs=[];
  for(const row of source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(match=>text(match[1]));
    if(cells.length>1)pairs.push([cells[0],cells.slice(1).join(' ')]);
  }
  for(const definition of source.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))pairs.push([text(definition[1]),text(definition[2])]);
  let surface='',environment='';
  for(const [label,value] of pairs){
    if(!surface&&/^(?:court |playing )?surface$/i.test(label))surface=normalizeSurface(value);
    if(!environment&&/^(?:court )?(?:environment|indoor\s*\/\s*outdoor|indoor or outdoor)$/i.test(label))environment=normalizeEnvironment(value);
    if(!environment&&/^(?:court |playing )?surface$/i.test(label))environment=normalizeEnvironment(value);
  }
  const whole=text(source);
  if(!surface){const match=whole.match(/(?:court |playing )?surface\s*[:\-]?\s*(artificial clay|synthetic clay|clay|hard|carpet|grass|acrylic|plexicushion|greenset|decoturf)\b/i);surface=normalizeSurface(match?.[1]||'')}
  if(!environment){const match=whole.match(/(?:environment|indoor\s*\/\s*outdoor|court type)\s*[:\-]?\s*(indoor|outdoor)\b/i);environment=normalizeEnvironment(match?.[1]||'')}
  return{surface,environment,indoorOutdoor:environment};
}
