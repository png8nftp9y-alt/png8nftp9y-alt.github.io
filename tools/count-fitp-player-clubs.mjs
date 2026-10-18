import {pathToFileURL} from 'node:url';
import {openReadOnlyD1} from '../cloudflare/app-api/lib/read-only-d1-client.mjs';
// D1_READ_ONLY: guarded
const valid=column=>`CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END`;
const present=field=>`(json_type(payload,'$.${field}')='text' AND lower(trim(json_extract(payload,'$.${field}'),char(9)||char(10)||char(13)||' ')) NOT IN ('','tesseramento da completare','non disponibile','null'))`;
export const clubCoverageSql=`WITH
live AS (
 SELECT l.source_key,COALESCE(a.canonical_id,l.canonical_id) AS canonical_id,l.circuit,l.official_id
 FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
), native AS (
 SELECT circuit,official_id,MIN(canonical_id) AS canonical_id FROM live
 WHERE official_id<>'' GROUP BY circuit,official_id HAVING COUNT(DISTINCT canonical_id)=1
), people AS (
 SELECT p.canonical_id FROM player_identity_people p WHERE EXISTS(SELECT 1 FROM live l WHERE l.canonical_id=p.canonical_id)
), records AS (
 SELECT source_key,NULL AS player_id,circuit,official_id,${valid('payload')} AS payload FROM observed_players
 UNION ALL SELECT source_key,NULL,circuit,official_id,${valid('payload')} FROM search_acquired_players
 UNION ALL SELECT NULL,p.canonical_id,NULL,NULL,${valid('p.payload')} FROM player_identity_people p JOIN people v ON v.canonical_id=p.canonical_id
 UNION ALL SELECT observed_source_key,courtwatch_id,NULL,NULL,${valid('payload')} FROM user_app_player_additions
 UNION ALL SELECT json_extract(${valid('payload')},'$.sourceKey'),id,NULL,NULL,${valid('payload')} FROM app_players
), identified AS (
 SELECT r.*,COALESCE(s.canonical_id,a.canonical_id,p.canonical_id,n.canonical_id) AS person,
 COALESCE(NULLIF(r.circuit,''),NULLIF(json_extract(r.payload,'$.sourceCircuit'),''),CASE WHEN json_extract(r.payload,'$.membershipCard') IS NOT NULL THEN 'fitp' WHEN json_extract(r.payload,'$.worldTennisId') IS NOT NULL THEN 'itf' END) AS source_circuit,
 COALESCE(NULLIF(r.official_id,''),NULLIF(CAST(json_extract(r.payload,'$.sourcePlayerId') AS TEXT),''),NULLIF(CAST(json_extract(r.payload,'$.membershipCard') AS TEXT),''),NULLIF(CAST(json_extract(r.payload,'$.worldTennisId') AS TEXT),'')) AS native_id
 FROM records r LEFT JOIN live s ON s.source_key=r.source_key
 LEFT JOIN player_identity_aliases a ON a.alias_id=r.player_id
 LEFT JOIN people p ON p.canonical_id=r.player_id
 LEFT JOIN native n ON n.circuit=COALESCE(NULLIF(r.circuit,''),NULLIF(json_extract(r.payload,'$.sourceCircuit'),''),CASE WHEN json_extract(r.payload,'$.membershipCard') IS NOT NULL THEN 'fitp' WHEN json_extract(r.payload,'$.worldTennisId') IS NOT NULL THEN 'itf' END)
 AND n.official_id=COALESCE(NULLIF(r.official_id,''),NULLIF(CAST(json_extract(r.payload,'$.sourcePlayerId') AS TEXT),''),NULLIF(CAST(json_extract(r.payload,'$.membershipCard') AS TEXT),''),NULLIF(CAST(json_extract(r.payload,'$.worldTennisId') AS TEXT),''))
), grouped AS (
 SELECT CASE WHEN person IS NOT NULL THEN 'person:'||person
 WHEN NULLIF(trim(CAST(json_extract(payload,'$.membershipCard') AS TEXT)),'') IS NOT NULL THEN 'native:fitp:'||CAST(json_extract(payload,'$.membershipCard') AS TEXT)
 WHEN source_circuit IS NOT NULL AND native_id IS NOT NULL THEN 'native:'||source_circuit||':'||native_id
 WHEN source_key IS NOT NULL THEN 'source:'||source_key ELSE 'app:'||player_id END AS identity_key,
 MAX(person IS NOT NULL) AS mapped,MAX(CASE WHEN ${present('club')} OR ${present('raw.tennis_club_name')} THEN 1 ELSE 0 END) AS has_club
 FROM identified GROUP BY identity_key
 HAVING MAX(source_circuit='fitp' OR NULLIF(trim(CAST(json_extract(payload,'$.membershipCard') AS TEXT)),'') IS NOT NULL OR EXISTS(SELECT 1 FROM live f WHERE f.canonical_id=identified.person AND f.circuit='fitp'))=1
)
SELECT CASE WHEN mapped THEN 'verified_players' ELSE 'unmapped_profiles' END AS scope,
COUNT(*) AS total,SUM(has_club) AS with_club,COUNT(*)-SUM(has_club) AS without_club
FROM grouped GROUP BY mapped ORDER BY mapped DESC`;
export async function countPlayerClubs(query){
 const rows=await query(clubCoverageSql);
 for(const r of rows)if(!Number.isInteger(r.total)||r.total!==r.with_club+r.without_club)throw Error('club_coverage_invalid_counts');
 return{checkedAt:new Date().toISOString(),status:'counted',circuit:'fitp',rows,notes:['FITP verified players are deduplicated by canonical identity, including personal recovered clubs.','FITP unmapped profiles are deduplicated by exact official ID or source key; unresolved mappings are reported separately.','A present club is stored data, not proof of current affiliation.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {query}=await openReadOnlyD1();console.log('PLAYER_CLUB_COVERAGE='+JSON.stringify(await countPlayerClubs(query)));
}
