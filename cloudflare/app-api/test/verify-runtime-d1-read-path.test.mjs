// D1_TEST_READ_ONLY_TRANSPORT D1_TEST_MUTATIONS_REJECTED
import './runtime-document-reader.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
test('read-path verification cannot mutate production data',async()=>{const {query}=createReadOnlyD1Client(async()=>[]);await query('SELECT value FROM app_state');await assert.rejects(query('DELETE FROM app_state'));});
