export function displayPlayerName(value) {
 const name=String(value||'').replace(/\s+/g,' ').trim();
 return name && name===name.toLocaleUpperCase('it-IT')
  ? name.toLocaleLowerCase('it-IT').replace(/(^|[\s'’-])\p{L}/gu,letter=>letter.toLocaleUpperCase('it-IT')) : name;
}
export function personalPlayerMetadata(player,observed={}) {
 return {...player,name:displayPlayerName(player.name),club:player.club||observed.club||''};
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
 return typeof club==='string'?club.replace(/\s+/g,' ').trim():'';
}
