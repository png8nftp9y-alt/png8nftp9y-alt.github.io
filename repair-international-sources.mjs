import fs from 'node:fs/promises';
for(const file of ['te-entries.mjs','itf-entries.mjs']){const source=await fs.readFile(file,'utf8');if(source.includes('{{https'))throw Error(file+' contiene URL compresse');if(!source.includes('2026-06-20'))throw Error(file+' non copre dal 20 giugno 2026')}
const te=await fs.readFile('te-entries.mjs','utf8');if(!te.includes('await page.goto(url'))throw Error('Tennis Europe non naviga la sorgente richiesta');if(!te.includes('TE_CALENDAR'))throw Error('Calendario ufficiale Tennis Europe assente');
const itf=await fs.readFile('itf-entries.mjs','utf8');if(!itf.includes('circuitCode=JT'))throw Error('Parametro circuito junior ITF assente');if(!itf.includes('waitForResponse'))throw Error('Browser flow ITF assente');
console.log('International source validation complete');
