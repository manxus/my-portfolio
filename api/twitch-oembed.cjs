const TWITCH_OEMBED = 'https://api.twitch.tv/oembed';

function isAllowedTwitchUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('twitch.tv');
  } catch {
    return false;
  }
}

async function fetchTwitchOembed(pageUrl) {
  const oembedUrl = `${TWITCH_OEMBED}?${new URLSearchParams({
    url: pageUrl,
    format: 'json',
  })}`;

  const res = await fetch(oembedUrl);
  if (!res.ok) {
    throw new Error(`Twitch oEmbed failed (${res.status})`);
  }
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const requestUrl = new URL(req.url, 'http://localhost');
  const pageUrl = requestUrl.searchParams.get('url');

  if (!pageUrl || !isAllowedTwitchUrl(pageUrl)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid Twitch URL' }));
  }

  try {
    const data = await fetchTwitchOembed(pageUrl);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      thumbnail_url: data.thumbnail_url || null,
      title: data.title || null,
    }));
  } catch (err) {
    console.error('[twitch-oembed]', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to fetch Twitch oEmbed' }));
  }
};
