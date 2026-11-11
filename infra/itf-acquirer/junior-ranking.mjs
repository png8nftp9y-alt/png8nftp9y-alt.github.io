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

export async function checkRanking(category, read, take = 100, { recoverTies = false } = {}) {
  let date, total, pages = 0, lastRank = 0;
  const ids = new Map();
  const affectedPages = new Set();

  async function readPage(skip, recovery = false) {
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

    let previousRank = recovery ? 0 : lastRank;
    for (const { playerId, rank, points } of items) {
      if (!Number.isSafeInteger(playerId) || playerId < 1 ||
          !Number.isInteger(rank) || rank < 1 || rank < previousRank || !Number.isFinite(points)) {
        throw Error(category + ' skip=' + skip + ': invalid ranking row');
      }
      previousRank = rank;
      const known = ids.get(playerId);
      if (!known) {
        ids.set(playerId, { rank, points, skip });
        continue;
      }
      if (!recoverTies || known.rank !== rank || known.points !== points) {
        throw Error(category + ' skip=' + skip + ': duplicate ID or inconsistent ranking row');
      }
      if (!recovery) {
        affectedPages.add(known.skip);
        affectedPages.add(skip);
      }
    }
    if (!recovery) lastRank = previousRank;
    pages++;
    if (ids.size > total) throw Error(category + ': acquired more distinct IDs than declared');
    return items.length;
  }

  let skip = 0;
  do {
    skip += await readPage(skip);
  } while (skip < total);

  // Shift the page boundaries to bring tied rows into the same response.
  for (const shift of [Math.floor(take / 2), Math.floor(take / 4)]) {
    if (ids.size === total || !shift) break;
    const offsets = new Set([...affectedPages].flatMap(offset =>
      [Math.max(0, offset - shift), offset + shift]).filter(offset => offset < total));
    for (const offset of offsets) {
      await readPage(offset, true);
      if (ids.size === total) break;
    }
  }
  if (ids.size !== total) throw Error(category + ': acquired ' + ids.size + '/' + total + ' distinct IDs');
  return { category, rankDate: date, totalItems: total, acquired: ids.size, pages };
}
