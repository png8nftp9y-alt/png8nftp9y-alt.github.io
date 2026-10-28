import fs from 'node:fs/promises';
import {overlayEmptyRecovery} from './tennis-europe-empty-overlay.mjs';
const p='dist/v3/tennis_europe_oop_historical.json';
const current=JSON.parse(await fs.readFile('empty-current/current-archive.json','utf8')),candidate=JSON.parse(await fs.readFile(p,'utf8'));
const merged=overlayEmptyRecovery(current,candidate);await fs.writeFile(p,JSON.stringify(merged,null,2)+'\n');console.log(JSON.stringify({preservedCurrentMatches:current.matches.length,finalMatches:merged.matches.length,counts:merged.counts}));
