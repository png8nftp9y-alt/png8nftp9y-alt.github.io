import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const directory='seed-tennis-europe-oop';
const files=(await fs.readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
const hash=crypto.createHash('sha256');
for(const name of files){hash.update(name);hash.update('\0');hash.update(await fs.readFile(`${directory}/${name}`));hash.update('\0')}
const value=hash.digest('hex');
await fs.writeFile(`${directory}/import-hash.txt`,value+'\n');
console.log(JSON.stringify({files:files.length,importHash:value}));
