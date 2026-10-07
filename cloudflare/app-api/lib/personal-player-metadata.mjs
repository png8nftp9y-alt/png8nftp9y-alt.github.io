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
export function personalPlayerMetadata(player,observed={}) {
 const result={...player,name:displayPlayerName(player.name),club:displayPlayerClub(player.club||observed.club||'')};
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
