import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function contentHash(snapshot){
  if(snapshot?.status!=='green')throw new Error('Europe OOP snapshot is not green');
  // Only the root acquisition timestamp is excluded. Every other field counts.
  const {generatedAt,...content}=snapshot;
  if(!generatedAt||!Number.isFinite(Date.parse(generatedAt)))throw new Error('Invalid OOP acquisition timestamp');
  return createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
}
export function refreshCheckedAt(snapshot,pointer){
  if(!pointer.lastCheckedAt)return snapshot; // Legacy pointers remain readable.
  const checked=Date.parse(pointer.lastCheckedAt);
  if(!Number.isFinite(checked)||checked<Date.parse(snapshot.generatedAt))throw new Error('Invalid OOP last check');
  if(pointer.contentSha256!==contentHash(snapshot))throw new Error('OOP content fingerprint mismatch');
  return {...snapshot,generatedAt:pointer.lastCheckedAt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [command,file,pointerFile]=process.argv.slice(2),snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
  if(command==='hash')console.log(contentHash(snapshot));
  else if(command==='refresh')fs.writeFileSync(file,JSON.stringify(refreshCheckedAt(snapshot,JSON.parse(fs.readFileSync(pointerFile,'utf8'))),null,2)+'\n');
  else throw new Error('Usage: hash SNAPSHOT | refresh SNAPSHOT POINTER');
}
