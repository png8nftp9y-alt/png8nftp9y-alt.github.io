import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// Bound both row count and SQL key bytes; no larger D1 statements are introduced.
export function acceptanceQueryBatches(rows){
 const result=[];let batch=[],bytes=0;
 for(const row of rows){const size=new TextEncoder().encode(sqlString(row.source_key)).length+1;
  if(batch.length&&(batch.length>=400||bytes+size>60000)){result.push(batch);batch=[];bytes=0;}
  batch.push(row);bytes+=size;
 }
 if(batch.length)result.push(batch);return result;
}
