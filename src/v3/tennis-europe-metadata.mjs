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
  if(/^(?:WILD\s*CARD|WC)$/.test(marker))return'WC';
  if(/^(?:QUALIFIER|QUALIFIED|Q)$/.test(marker))return'Q';
  if(/^(?:LUCKY\s*LOSER|LL)$/.test(marker))return'LL';
  return'';
}

function normalizedName(value){return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase()}
function normalizedEvent(value){const source=text(value).toUpperCase(),code=(source.match(/\b(?:BS|GS|BD|GD)\d{2}\b/)||[])[0]||source.replace(/[^A-Z0-9]+/g,' ').trim(),phase=/\bQUALIF(?:YING|ICATION)?\b/.test(source)?'Q':/\bMAIN\s+DRAW\b/.test(source)?'MD':'';return[code,phase].filter(Boolean).join('|')}

export function tennisEuropeParticipant(link){
  const source=String(link||''),valueHtml=(source.match(/<span\b[^>]*class=["'][^"']*nav-link__value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||source;
  const rawName=text(valueHtml),allText=text(source);
  const explicit=['data-seed','data-seeding','data-entry-type','data-entry','data-designation'].map(name=>normalizeDesignation(attribute(source,name))).find(Boolean)||'';
  const bracketed=[...allText.matchAll(/[\[(]\s*(\d{1,2}|WC|Q|LL)\s*[\])]/gi)].map(match=>normalizeDesignation(match[1])).filter(Boolean);
  const labelled=(allText.match(/\b(?:seed(?:ed)?|seeding|entry(?: type)?)\s*[:#-]?\s*(\d{1,2}|WC|Q|LL|Wild\s*Card|Lucky\s*Loser|Qualifier)\b/i)||[])[1]||'';
  const nameSuffix=(rawName.match(/\s*[\[(]\s*(\d{1,2}|WC|Q|LL)\s*[\])]\s*$/i)||[])[1]||'';
  const designation=explicit||normalizeDesignation(nameSuffix)||bracketed.at(-1)||normalizeDesignation(labelled);
  const name=text(rawName.replace(/\s*[\[(]\s*(?:\d{1,2}|WC|Q|LL)\s*[\])]\s*$/i,'').replace(/\s*\[[^\]]*\]\s*$/,''));
  const id=attribute(source,'data-player-id'),nationality=attribute(source,'data-nationality-id'),href=attribute(source,'href').replace(/&amp;/g,'&');
  return{id,name,nationality,designation,seed:/^\d+$/.test(designation)?Number(designation):null,entryType:/^(?:WC|Q|LL)$/.test(designation)?designation:'',href};
}

export function tennisEuropeDesignationIndex(seedsHtml='',acceptanceHtml=''){
  const seeds=[],entries=[];
  for(const table of String(seedsHtml||'').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    let event=normalizedEvent(text(table[1]));
    for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
      const header=(row[1].match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)||[])[1];
      if(header){const headerEvent=normalizedEvent(text(row[1]));if(headerEvent)event=headerEvent;continue}
      const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
      const seed=normalizeDesignation(text(cells[0]?.[1]||''));
      if(!/^\d+$/.test(seed))continue;
      const players=[...row[1].matchAll(/<a\b[^>]*(?:data-player-id=["'][^"']+["']|href=["'][^"']*(?:player\.aspx|player-profile\/|\/sport\/player)[^"']*["'])[^>]*>([\s\S]*?)<\/a>/gi)].map(match=>text(match[1])).filter(Boolean);
      for(const name of players)seeds.push({name:normalizedName(name),event,designation:seed});
    }
  }
  let section='';
  for(const row of String(acceptanceHtml||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(match=>text(match[1]));
    if(!cells.length)continue;
    if(/^(?:Main|Qualifying)$/i.test(cells[0])){section=cells[0];continue}
    const rowText=text(row[1]),marker=(rowText.match(/[\[(]\s*(WC|Q|LL)\s*[\])]/i)||[])[1]||(/\bLucky\s*Loser\b/i.test(rowText)?'LL':/\bWild\s*Card\b/i.test(rowText)?'WC':/\bQualifier\b/i.test(rowText)?'Q':'');
    if(!marker)continue;
    const linked=[...row[1].matchAll(/<a\b[^>]*(?:data-player-id=["'][^"']+["']|href=["'][^"']*(?:player\.aspx|player-profile\/|\/sport\/player)[^"']*["'])[^>]*>([\s\S]*?)<\/a>/gi)].map(match=>text(match[1])).find(Boolean),countryCell=cells.findIndex(cell=>/^\[[A-Z]{2,3}\]$/.test(cell)),fallback=countryCell>=0?cells[countryCell+1]:cells.find(cell=>/[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(cell)&&!/Wild\s*Card|Lucky\s*Loser|Qualifier/i.test(cell)),name=linked||fallback||'';
    if(name)entries.push({name:normalizedName(name.replace(/^\[[A-Z]{2,3}\]\s*/,'')),section,designation:normalizeDesignation(marker)});
  }
  return{seeds,entries};
}

export function applyTennisEuropeDesignations(matches,index){
  for(const match of matches||[]){
    const event=normalizedEvent([match.event,match.draw,match.round].filter(Boolean).join(' '));
    for(const player of match.players||[]){
      if(player.designation)continue;
      const name=normalizedName(player.name),entry=(index?.entries||[]).find(item=>item.name===name),candidates=(index?.seeds||[]).filter(item=>item.name===name),phase=event.split('|')[1]||'',seed=candidates.find(item=>item.event===event)||candidates.find(item=>{const itemPhase=item.event.split('|')[1]||'';return phase==='Q'?itemPhase==='Q':itemPhase!=='Q'})||candidates[0];
      const designation=entry?.designation||seed?.designation||'';
      if(!designation)continue;
      player.designation=designation;
      player.seed=/^\d+$/.test(designation)?Number(designation):null;
      player.entryType=/^(?:WC|Q|LL)$/.test(designation)?designation:'';
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
