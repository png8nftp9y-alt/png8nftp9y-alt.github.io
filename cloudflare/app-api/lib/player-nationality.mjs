// Equivalent source codes are comparison keys; original affiliation is retained.
export const playerNationalityKey=value=>({ROM:'ROU',MGO:'MNE',IT:'ITA',ITALY:'ITA',ITALIA:'ITA',CH:'SUI',SWITZERLAND:'SUI'}[String(value||'').trim().toUpperCase()]||String(value||'').trim().toUpperCase());
