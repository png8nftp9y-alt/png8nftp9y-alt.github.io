const card=r=>String(r.membership_card||r.official_id||'');
export function failureInventory(failures,identities){
 const byCard=new Map();for(const identity of identities){const key=card(identity);if(!byCard.has(key))byCard.set(key,[]);byCard.get(key).push(identity);}
 const rows=failures.map(row=>{const matches=byCard.get(card(row))||[],names=[...new Set(matches.map(r=>String(r.display_name||'').trim()).filter(Boolean))];
  // This is a label classification, never proof that an identity may be deleted.
  const classification=!names.length?'no_stored_name':names.every(name=>/^equiparato(?:\s|$)/i.test(name))?'equiparato_label':'requires_review';
  return{...row,names,classification,identities:matches};
 });
 const classes={},errors={};for(const row of rows){classes[row.classification]=(classes[row.classification]||0)+1;errors[row.error]=(errors[row.error]||0)+1;}
 return{total:rows.length,classes,errors,allHaveEquiparatoLabel:rows.length>0&&rows.every(r=>r.classification==='equiparato_label'),rows};
}
