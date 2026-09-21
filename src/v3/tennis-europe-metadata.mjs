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

function normalizedName(value){return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase()}
function normalizedEvent(value){return text(value).toUpperCase().replace(/\b(?:MAIN DRAW|QUALIFYING|DRAW)\b/g,' ').replace(/[^A-Z0-9]+/g,' ').trim()}

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

export function tennisEuropeDesignationIndex(seedsHtml='',acceptanceHtml=''){
  const seeds=[],entries=[];
  for(const table of String(seedsHtml||'').matchAll(/<table\b[^>]*class=["'][^"']*\bseeding\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)){
    let event='';
    for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
      const header=(row[1].match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)||[])[1];
      if(header){event=text(header);continue}
      const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
      const seed=normalizeDesignation(text(cells[0]?.[1]||''));
      if(!/^\d+$/.test(seed))continue;
      const players=[...row[1].matchAll(/<a\b[^>]*href=["'][^"']*(?:player\.aspx|player-profile\/)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match=>text(match[1])).filter(Boolean);
      for(const name of players)seeds.push({name:normalizedName(name),event:normalizedEvent(event),designation:seed});
    }
  }
  let section='';
  for(const row of String(acceptanceHtml||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(match=>text(match[1]));
    if(!cells.length)continue;
    if(/^(?:Main|Qualifying)$/i.test(cells[0])){section=cells[0];continue}
    if(cells.length<2)continue;
    const marker=(cells[0].match(/[\[(]\s*(WC|Q)\s*[\])]/i)||[])[1]||'';
    if(marker)entries.push({name:normalizedName(cells[1].replace(/^\[[A-Z]{3}\]\s*/,'')),section,designation:marker.toUpperCase()});
  }
  return{seeds,entries};
}

export function applyTennisEuropeDesignations(matches,index){
  for(const match of matches||[]){
    const event=normalizedEvent(match.event||match.draw||'');
    for(const player of match.players||[]){
      if(player.designation)continue;
      const name=normalizedName(player.name),entry=(index?.entries||[]).find(item=>item.name===name),seed=(index?.seeds||[]).find(item=>item.name===name&&(!item.event||!event||item.event.includes(event)||event.includes(item.event)))||(index?.seeds||[]).find(item=>item.name===name);
      const designation=entry?.designation||seed?.designation||'';
      if(!designation)continue;
      player.designation=designation;
      player.seed=/^\d+$/.test(designation)?Number(designation):null;
      player.entryType=/^(?:WC|Q)$/.test(designation)?designation:'';
    }
  }
  return matches;
}

function normalizeSurface(value){
  const source=text(value).replace(/\b(?:indoor|outdoor)\b/gi,' ').replace(/[|,/]+/g,' ').replace(/\s+/g,' ').trim();
  if(!source)return'';
  if(/artificial\s+clay|synthetic\s+clay/i.test(source))return'Artificial clay';
  if(/clay|red\s+clay/i.test(source))return'Clay';
  if(/hard|acryl+ic|plexicushion|greenset|decoturf/i.test(source))return'Hard';
  if(/carpet/i.test(source))return'Carpet';
  if(/grass/i.test(source))return'Grass';
  return source.length<=50?source:'';
}

function normalizeEnvironment(value){
  const source=text(value);
  if(/\bindoors?\b/i.test(source))return'Indoor';
  if(/\boutdoors?\b/i.test(source))return'Outdoor';
  return'';
}

export function tennisEuropeCourtConditions(html){
  const source=String(html||''),pairs=[];
  for(const row of source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(match=>text(match[1]));
    if(cells.length>1)pairs.push([cells[0],cells.slice(1).join(' ')]);
  }
  for(const definition of source.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))pairs.push([text(definition[1]),text(definition[2])]);
  for(const item of source.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
    const labels=[...item[1].matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)].map(match=>text(match[1]));
    if(labels.length>1)pairs.push([labels[0].replace(/:\s*$/,''),labels[1]]);
  }
  let surface='',environment='';
  for(const [label,value] of pairs){
    if(!surface&&/^(?:court |playing )?surface(?: boys| girls)?$/i.test(label))surface=normalizeSurface(value);
    if(!environment&&/^(?:court )?(?:environment|indoor\s*\/\s*outdoor|indoor or outdoor|location type)$/i.test(label))environment=normalizeEnvironment(value);
    if(!environment&&/^(?:court |playing )?surface$/i.test(label))environment=normalizeEnvironment(value);
  }
  const whole=text(source);
  if(!surface){const court=source.match(/icon-court[\s\S]{0,500}?nav-link__value[^>]*>([\s\S]*?)<\/span>/i);surface=normalizeSurface(court?.[1]||'')}
  if(!surface){const match=whole.match(/(?:court |playing )?surface\s*[:\-]?\s*(artificial clay|synthetic clay|clay|hard|carpet|grass|acrylic|plexicushion|greenset|decoturf)\b/i);surface=normalizeSurface(match?.[1]||'')}
  if(!environment){const match=whole.match(/(?:environment|indoor\s*\/\s*outdoor|court type)\s*[:\-]?\s*(indoor|outdoor)\b/i);environment=normalizeEnvironment(match?.[1]||'')}
  return{surface,environment,indoorOutdoor:environment};
}
