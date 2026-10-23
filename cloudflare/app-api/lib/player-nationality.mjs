// Equivalent source codes are comparison keys; original affiliation is retained.
export const playerNationalityKey=value=>({ROM:'ROU',MGO:'MNE',IT:'ITA',ITALY:'ITA',ITALIA:'ITA',CH:'SUI',SWITZERLAND:'SUI'}[String(value||'').trim().toUpperCase()]||String(value||'').trim().toUpperCase());
// Tennis federation code LIB means Lebanon (ITF constitution); LBY/Libya is distinct.
// RTF/BTF are comparison aliases only for Tennis Europe sources. Preserve source
// affiliation and displayed flags: this function never rewrites a player payload.
export const playerFederationMatchKey=(circuit,value)=>{
 const nation=playerNationalityKey(value);
 if(nation==='LIB')return 'LBN';
 return circuit==='tennis-europe'?({RTF:'RUS',BTF:'BLR'}[nation]||nation):nation;
};
