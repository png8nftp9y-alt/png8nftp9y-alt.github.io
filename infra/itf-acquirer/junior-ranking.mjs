const endpoint = 'https://www.world.tennis/tennis/api/PlayerRankApi/GetPlayerRankings';

export function rankingUrl(category, take, skip) {
  const query = new URLSearchParams({
    circuitCode: 'JT', playerTypeCode: category, ageCategoryCode: '',
    juniorRankingType: 'itf', take, skip, isOrderAscending: 'true',
  });
  return new URL(endpoint + '?' + query);
}

export function isRankingUrl(url) {
  if (url.origin + url.pathname !== endpoint || url.username || url.password || url.hash) return false;
  const { searchParams: params } = url;
  const category = params.get('playerTypeCode');
  const take = Number(params.get('take'));
  const skip = Number(params.get('skip'));
  if (!['B', 'G'].includes(category) || !Number.isInteger(take) || take < 1 || take > 100 ||
      !Number.isInteger(skip) || skip < 0 || skip > 30000) return false;
  const expected = rankingUrl(category, take, skip).searchParams;
  return params.size === expected.size && [...expected].every(([key, value]) => params.get(key) === value);
}

export async function checkRanking(category, read, take = 100) {
  let date, total, pages = 0, lastRank = 0;
  const ids = new Set();
  do {
    const skip = ids.size;
    const result = await read(rankingUrl(category, take, skip));
    if (!result.ok) throw Error(category + ' skip=' + skip + ': ' + (result.responseKind || result.status));
    const { rankDate, totalItems, items } = result.json ?? {};
    if (typeof rankDate !== 'string' || !/^\d{2} [A-Za-z]+ \d{4}$/.test(rankDate) ||
        !Number.isFinite(Date.parse(rankDate + ' UTC')) || !Number.isInteger(totalItems) ||
        totalItems < 1 || totalItems > 30000 ||
        !Array.isArray(items) || !items.length || items.length > take || skip + items.length > totalItems) {
      throw Error(category + ' skip=' + skip + ': invalid ranking page');
    }
    date ??= rankDate;
    total ??= totalItems;
    if (date !== rankDate || total !== totalItems) throw Error(category + ': publication changed during acquisition');
    for (const { playerId, rank, points } of items) {
      if (!Number.isSafeInteger(playerId) || playerId < 1 || ids.has(playerId) ||
          !Number.isInteger(rank) || rank < 1 || rank < lastRank || !Number.isFinite(points)) {
        throw Error(category + ' skip=' + skip + ': invalid row or duplicate ID');
      }
      ids.add(playerId);
      lastRank = rank;
    }
    pages++;
  } while (ids.size < total);
  return { category, rankDate: date, totalItems: total, acquired: ids.size, pages };
}
