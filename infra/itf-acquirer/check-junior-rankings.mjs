import { checkRanking } from './junior-ranking.mjs';

const token = process.env.ITF_ACQUIRER_TOKEN;
if (!token) throw Error('ITF_ACQUIRER_TOKEN missing');
const take = Number(process.argv[2] ?? 100);
if (!Number.isInteger(take) || take < 1 || take > 100) throw Error('take must be between 1 and 100');

const configured = process.env.ITF_ACQUISITION_URL?.trim();
if (process.env.GITHUB_ACTIONS === 'true' && !configured) {
  throw Error('ITF_ACQUISITION_URL missing');
}
const endpoint = configured
  ? new URL(configured.replace(/\/v1\/factsheet\/?$/i, '/v1/fetch'))
  : new URL('http://127.0.0.1:' + (process.env.PORT || 8788) + '/v1/fetch');
if (configured && (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
    endpoint.hash || endpoint.search || !/^\/v1\/fetch\/?$/.test(endpoint.pathname))) {
  throw Error('Invalid ITF_ACQUISITION_URL');
}

async function read(url) {
  const response = await fetch(endpoint, {
    redirect: 'error',
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(90000),
  });
  const result = await response.json().catch(() => null);
  if (response.status === 400 && result?.error === 'invalid_url') {
    throw Error('Acquirer HTTP 400 invalid_url');
  }
  if (!response.ok) throw Error('Acquirer HTTP ' + response.status);
  if (!result || typeof result.ok !== 'boolean') throw Error('Invalid acquirer response');
  return {
    ok: result.ok,
    json: result.json,
    status: Number(result.status) || response.status,
    responseKind: ['incapsula_challenge', 'non_json', 'json'].includes(result.responseKind)
      ? result.responseKind : undefined,
  };
}

for (const category of ['B', 'G']) {
  try {
    console.log(JSON.stringify(await checkRanking(category, read, take)));
  } catch (error) {
    console.error(JSON.stringify({ category, error: error.message }));
    process.exitCode = 1;
    break;
  }
}
