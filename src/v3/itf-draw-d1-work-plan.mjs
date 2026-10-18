import fs from 'node:fs/promises';
const audit=JSON.parse(await fs.readFile('dist/v3/audits/itf-draw-d1-sync.json','utf8'));
if(!Array.isArray(audit.documents)||!Number.isInteger(audit.sqlFiles)||audit.sqlFiles<0||audit.storedDocuments!==audit.documents.length)throw Error('Invalid ITF D1 work manifest');
const hasDocuments=audit.documents.length>0;
if(hasDocuments!==(audit.sqlFiles>0)||(audit.archiveMissing||[]).length)throw Error('Incomplete ITF D1 work manifest');
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`has_documents=${hasDocuments}\n`);
console.log(JSON.stringify({status:hasDocuments?'d1_import_required':'no_complete_documents',documents:audit.documents.length,sqlFiles:audit.sqlFiles,d1Required:hasDocuments}));
