// D1_READ_ONLY: guarded
import fs from 'node:fs/promises';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {existingDocumentManifest} from '../lib/itf-existing-document-manifest.mjs';
export async function exportItfDocumentManifest(options={}){
 const client=await openReadOnlyD1(options);
 return existingDocumentManifest(client.query);
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const config=JSON.parse(await fs.readFile('cloudflare/app-api/wrangler.generated.jsonc','utf8'));
 const databaseId=config.d1_databases?.find(x=>x.binding==='DB')?.database_id;
 if(!databaseId)throw Error('Missing configured D1 database');
 const manifest=await exportItfDocumentManifest({databaseId});
 await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-existing-documents.json',JSON.stringify(manifest));
 console.log('Existing immutable document versions: '+manifest.documents.length);
}
