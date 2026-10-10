// Explicit user instruction (2026-10-11): do not consider this unverified
// legacy name record a player missing an ID. Preserve the source and identity.
// This is a source-key exclusion, not a classification of similarly named people.
export function includedPlayerIdSourceSql(alias='') {
 const prefix=alias?alias+'.':'';
 return `NOT (${prefix}circuit='tennis-europe' AND ${prefix}source_key='tennis-europe|name:MOEZ BEN AMOR')`;
}
