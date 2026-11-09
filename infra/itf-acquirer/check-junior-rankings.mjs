import { checkRanking } from './junior-ranking.mjs';

const token = process.env.ITF_ACQUIRER_TOKEN;
if (!token) throw Error('ITF_ACQUIRER_TOKEN missing');
const take = Number(process.argv[2] ?? 100);
if (!Number.isInteger(take) || take < 1 || take > 100) throw Error('take must be between 1 and 100');

async function read(url) {
  const response = await fetch('http://127.0.0.1:' + (process.env.PORT || 8788) + '/v1/fetch', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw Error('Acquirer HTTP ' + response.status);
  return response.json();
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
