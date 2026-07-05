const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'BuildVerifiedPortfolio/1.0';
const ACCEPT_LANGUAGE = 'en';

/** Scripts we hide from search labels when an English alternative exists */
const NON_LATIN_SCRIPT = /[\u0E00-\u0E7F\u4E00-\u9FFF\u3400-\u4DBF\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u0400-\u04FF\u0900-\u097F]/;

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

function hasNonLatinScript(text) {
  return NON_LATIN_SCRIPT.test(String(text ?? ''));
}

function shortenDisplayName(displayName) {
  const parts = String(displayName)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 3) return parts.join(', ');
  return [parts[0], parts[parts.length - 1]].join(', ');
}

function cleanRegion(region) {
  return String(region ?? '')
    .replace(/\s+(Province|District|Region|County|Prefecture|Oblast)$/i, '')
    .trim();
}

function pickEnglishName(item) {
  const namedetails = item.namedetails || {};

  for (const [key, value] of Object.entries(namedetails)) {
    if (!value || hasNonLatinScript(value)) continue;
    if (key === 'name:en' || key.endsWith(':en')) {
      return String(value).trim();
    }
  }

  if (item.name && !hasNonLatinScript(item.name)) {
    return String(item.name).trim();
  }

  return '';
}

function pickLatinAddressPart(address, keys) {
  for (const key of keys) {
    const value = address?.[key];
    if (value && !hasNonLatinScript(value)) {
      return String(value).trim();
    }
  }
  return '';
}

function englishCountryName(address) {
  const fromAddress = pickLatinAddressPart(address, ['country']);
  if (fromAddress) return fromAddress;

  const code = address?.country_code;
  if (!code) return '';

  try {
    return REGION_NAMES.of(String(code).toUpperCase()) || '';
  } catch {
    return '';
  }
}

function buildEnglishLabel(item) {
  const address = item.address || {};
  const primary = pickEnglishName(item);

  if (item.display_name && !hasNonLatinScript(item.display_name)) {
    return shortenDisplayName(item.display_name);
  }

  const locality =
    primary ||
    pickLatinAddressPart(address, [
      'island',
      'city',
      'town',
      'village',
      'municipality',
      'suburb',
      'neighbourhood',
      'hamlet',
      'county',
      'state_district',
    ]);

  const region = cleanRegion(
    pickLatinAddressPart(address, ['province', 'state', 'region']) ||
      address.province ||
      address.state ||
      '',
  );
  const country = englishCountryName(address);

  const parts = [locality, region, country].filter(Boolean);
  const unique = parts.filter((part, index) => part !== parts[index - 1]);

  if (unique.length > 0) return unique.join(', ');
  if (primary && country) return `${primary}, ${country}`;
  if (primary) return primary;

  return '';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

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
  const q = (requestUrl.searchParams.get('q') || '').trim();

  if (q.length < 2) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Query must be at least 2 characters' }));
  }

  if (q.length > 120) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Query too long' }));
  }

  try {
    const searchUrl = `${NOMINATIM}?${new URLSearchParams({
      q,
      format: 'json',
      limit: '10',
      addressdetails: '1',
      namedetails: '1',
      'accept-language': ACCEPT_LANGUAGE,
    })}`;

    const upstream = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Accept-Language': ACCEPT_LANGUAGE,
      },
    });

    if (!upstream.ok) {
      throw new Error(`Nominatim failed (${upstream.status})`);
    }

    const data = await upstream.json();
    const seen = new Set();
    const results = (Array.isArray(data) ? data : [])
      .map((item) => ({
        placeId: String(item.place_id),
        label: buildEnglishLabel(item),
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
      .filter((item) => {
        if (
          !item.label ||
          hasNonLatinScript(item.label) ||
          !Number.isFinite(item.lat) ||
          !Number.isFinite(item.lng)
        ) {
          return false;
        }
        const dedupeKey = `${item.label}|${item.lat.toFixed(4)}|${item.lng.toFixed(4)}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, 6);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ results }));
  } catch (err) {
    console.error('[geocode]', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to search locations' }));
  }
};
