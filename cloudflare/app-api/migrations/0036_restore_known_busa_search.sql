-- Search identity retained from the original configured roster (data.json).
-- Do not follow the player automatically or replace already acquired metadata.
INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload)
SELECT 'fitp|id:6562748855','fitp','6562748855','MARTINA BUSA','Martina Busa',
 '{"name":"Martina Busa","officialId":"6562748855","membershipCard":"6562748855","source":"original-configured-roster"}'
WHERE NOT EXISTS (SELECT 1 FROM observed_players WHERE source_key='fitp|id:6562748855')
AND NOT EXISTS (SELECT 1 FROM observed_players WHERE circuit='fitp' AND official_id='6562748855');
