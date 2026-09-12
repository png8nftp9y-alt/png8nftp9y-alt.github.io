import fs from 'node:fs';

const files=process.argv.slice(2);
if(!files.length)throw new Error('Nessun file SQL passato al guard D1');
const limits={
  bytes:Number(process.env.D1_GUARD_MAX_BYTES||15_000_000),
  statements:Number(process.env.D1_GUARD_MAX_STATEMENTS||5_000),
  deletes:Number(process.env.D1_GUARD_MAX_DELETES||500),
  deleteSubqueries:Number(process.env.D1_GUARD_MAX_DELETE_SUBQUERIES||32),
};
for(const file of files){
  const stat=fs.statSync(file);
  const sql=fs.readFileSync(file,'utf8').replace(/--[^\n]*/g,'');
  const statements=sql.split(';').map(value=>value.trim()).filter(Boolean);
  const deletes=statements.filter(value=>/^DELETE\s+FROM\b/i.test(value));
  const deleteSubqueries=deletes.filter(value=>/\b(?:SELECT|EXISTS)\b/i.test(value));
  const failures=[];
  if(stat.size>limits.bytes)failures.push(`bytes=${stat.size}>${limits.bytes}`);
  if(statements.length>limits.statements)failures.push(`statements=${statements.length}>${limits.statements}`);
  if(deletes.length>limits.deletes)failures.push(`deletes=${deletes.length}>${limits.deletes}`);
  if(deleteSubqueries.length>limits.deleteSubqueries)failures.push(`deleteSubqueries=${deleteSubqueries.length}>${limits.deleteSubqueries}`);
  console.log(JSON.stringify({guard:'d1-import',file,bytes:stat.size,statements:statements.length,deletes:deletes.length,deleteSubqueries:deleteSubqueries.length,status:failures.length?'blocked':'green'}));
  if(failures.length)throw new Error(`Import D1 bloccato prima dell'esecuzione: ${file}: ${failures.join(', ')}`);
}
