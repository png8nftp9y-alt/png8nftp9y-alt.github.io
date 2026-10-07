export function displayPlayerClub(value) {
 const club=String(value||'').replace(/\s+/g,' ').trim();
 const key=club.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 return key.includes('TENNIS CLUB LECCO') ? 'Tennis Club Lecco' : club;
}
export function displayPlayerName(value) {
 const name=String(value||'').replace(/\s+/g,' ').trim();
 return name && name===name.toLocaleUpperCase('it-IT')
  ? name.toLocaleLowerCase('it-IT').replace(/(^|[\s'’-])\p{L}/gu,letter=>letter.toLocaleUpperCase('it-IT')) : name;
}
export function playerSourceMetadata(source={}) {
 const result={};
 const raw=source.raw&&typeof source.raw==='object'?source.raw:{};
 const date=String(source.birthDate||source.dateOfBirth||raw.BirthDate||raw.DateOfBirth||'').slice(0,10);
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T00:00:00Z'):null;
 const validDate=parsed&&Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===date;
 const year=Number(validDate?date.slice(0,4):source.birthYear||raw.BirthYear);
 if(Number.isInteger(year)&&year>=1900&&year<=new Date().getUTCFullYear()){
  result.birthYear=year;
  if(validDate)result.birthDate=date;
 }
 const sex=String(source.sex||source.gender||raw.Sex||raw.Gender||'').toUpperCase();
 if(['M','F'].includes(sex))result.sex=sex;
 const nationality=source.nationality||source.country;
 if(typeof nationality==='string'&&nationality.trim())result.nationality=nationality.trim();
 const club=source.club||raw.tennis_club_name;
 if(typeof club==='string'&&club.trim())result.club=displayPlayerClub(club);
 return result;
}
export function personalPlayerMetadata(player,observed={}) {
 const source=playerSourceMetadata(observed),own=playerSourceMetadata(player);
 const result={...player,...source,...own,name:displayPlayerName(player.name),club:displayPlayerClub(player.club||source.club||'')};
 if(own.birthYear&&source.birthDate&&!own.birthDate&&own.birthYear!==source.birthYear)delete result.birthDate;
 if(player.membershipCard||player.sourceCircuit==='fitp'){
  const value=observed.ranking||player.ranking||'';
  result.ranking=String(value).replace(/\s+/g,'').replace(/^([1-4])NC$/i,'$1.NC').toUpperCase();
 }
 return result;
}
export async function officialFitpClub(card,fetcher=fetch) {
 if(!/^\d+$/.test(String(card||'')))return '';
 const response=await fetcher('https://dp-fit-prod-function.azurewebsites.net/api/v6/player/sheet/simple',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Origin':'https://www.fitp.it','Referer':'https://www.fitp.it/Pagina-Giocatore/'},
  body:JSON.stringify({cardNumber:btoa(String(card))}),signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error('FITP profile HTTP '+response.status);
 const profile=(await response.json())?.player;
 const club=profile?.tennis_club_name||profile?.TennisClubName||profile?.club;
 return typeof club==='string'?displayPlayerClub(club):'';
}
