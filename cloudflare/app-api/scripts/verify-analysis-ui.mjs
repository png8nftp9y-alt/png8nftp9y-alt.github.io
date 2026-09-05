import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('../../../v3.js', import.meta.url)), 'utf8');

assert.doesNotMatch(source, /\bprompt\s*\(/, 'v3.js must not use native prompt dialogs');
assert.doesNotMatch(source, /\bconfirm\s*\(/, 'v3.js must not use native confirm dialogs');
for (const marker of [
  'function analysisEditor()',
  'function editMatchAnalysis(',
  'Analisi della partita',
  'aria-label="Testo analisi"',
  '>Salva<',
  '>Elimina<',
  "method:'PUT'",
  "method:'DELETE'",
  "location.origin+'/app-api'"
]) {
  assert.ok(source.includes(marker), `missing analysis UI marker: ${marker}`);
}
console.log(JSON.stringify({ analysisUi: 'green', nativePrompt: false, nativeConfirm: false, actions: ['read', 'save', 'update', 'delete'] }));
