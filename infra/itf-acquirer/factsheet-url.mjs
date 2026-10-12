export function allowedFactsheet(raw) {
  const url = new URL(raw);
  const match = url.pathname.match(/^\/en\/tournament\/[^/]+\/([a-z]{3})\/(\d{4})\/(j-[a-z0-9]+-[a-z]{3}-(?:\d{4}-\d{3}|[a-z0-9]{3}-\d{4}))\/?$/i);
  const key = match?.[3].toLowerCase().split('-');
  const keyYear = key?.[3]?.length === 4 ? key[3] : key?.[4];
  if (url.protocol !== 'https:' || url.hostname !== 'www.itftennis.com' || url.port || url.username || url.password || url.search || url.hash || !match || match[2] !== keyYear) throw new Error('factsheet_url_not_allowed');
  return url;
}
