// Existing app birth years and five explicit owner confirmations, 2026-10-30.
// Exact stable IDs only; never infer from name, age or an Under category.
const years=Object.freeze({
  "aila-zennaro": 2012,
  "alessio-nava": 2017,
  "andrea-losa": 2014,
  "anna-gambarini": 2015,
  "camilla-lingeri": 2015,
  "carlo-ghislotti": 2016,
  "daniele-gelli": 2015,
  "darko-sartori": 2011,
  "edoardo-grimoldi": 2015,
  "filippo-vitali": 2014,
  "francesco-bocchio": 2015,
  "francesco-renzulli": 2012,
  "giulia-scozzafava": 2012,
  "gregorio-puccio": 2014,
  "martina-danesi": 2009,
  "matilde-mainetti": 2012,
  "matteo-bocchio": 2017,
  "mattia-garibaldi": 2015,
  "nicholas-scappa": 2015,
  "nikola-kerkenyakov": 2012,
  "noemi-paganini": 2015,
  "virginia-cereghini": 2013,
  "virginia-rossoni": 2016,
  "cw-5dad2aaa746cfd520dbe4e3313afe309": 2010,
  "cw-ba794d788cf429468eb070db20de4cad": 2007,
  "cw-bdb8d1e902ddd81f98afdd33d6f52844": 2016,
  "cw-e51996ce09302dd1a0c6279a13447d53": 2016,
  "cw-e99845ef949cc7dd2a99ff26e17af781": 2012
});
export function confirmedObservedBirthYear(player){return years[player?.id]||years[player?.canonicalId]||null;}
