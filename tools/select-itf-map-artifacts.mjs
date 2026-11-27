export const ITF_MAP_REGIONS=['europe','americas','asia_pacific','africa_middle_east','other'];
export function selectItfMapArtifacts(artifacts){
 return ITF_MAP_REGIONS.map(region=>{
  const name='itf-tournaments-'+region;
  const candidates=artifacts.filter(a=>a.name===name&&!a.expired&&Number.isSafeInteger(a.id)&&Number.isFinite(Date.parse(a.created_at)));
  candidates.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
  if(!candidates.length)throw Error('Missing current ITF artifact: '+name);
  return candidates[0].id;
 });
}
