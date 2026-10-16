const transientInternal = error => {
 const message=[error?.message,error?.cause?.message].filter(Boolean).join(' ');
 return error?.code===7500 || error?.cause?.code===7500 || /\b7500\b|internal error; reference\s*=|D1_ERROR:\s*internal error/i.test(message);
};
// Retry this read only; never repeat a write or turn a persistent error into empty data.
export async function readD1Rows(db,sql,params=[],{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
 if(!/^\s*SELECT\b/i.test(sql))throw Error('read_only_guard');
 const delays=[200,600];
 for(let attempt=0;;attempt++){
  try{return (await db.prepare(sql).bind(...params).all()).results||[];}
  catch(error){if(attempt>=delays.length||!transientInternal(error))throw error;await wait(delays[attempt]);}
 }
}
