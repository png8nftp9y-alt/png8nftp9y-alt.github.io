import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
export function allAppRankingInput(registry,projections){
 if(!projections||projections.complete!==true||!Array.isArray(projections.players)||!Array.isArray(projections.matches))throw Error('ranking_app_export_incomplete');
 const byId=new Map(registry.map(p=>[p.id,p]));
 for(const p of projections.players){if(!p.id||!p.name)throw Error('ranking_player_identity_missing');byId.set(p.id,{...byId.get(p.id),...p});}
 const players=[...byId.values()];
 // Validate stable identities and source completeness before generating any import SQL.
 buildIncrementalSyncPlan({current:registry,incoming:players,keyOf:p=>p.id,sourceComplete:projections.complete});
 const matches=new Map();for(const m of projections.matches){if(!m.playerId||!(m.matchId||m.id))throw Error('ranking_match_identity_missing');matches.set(m.playerId+'|'+(m.matchId||m.id),m);}
 return{players,matches:[...matches.values()]};
}
