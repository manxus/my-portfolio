const STEAMCMD_API = 'https://api.steamcmd.net/v1/info';
const ASSET_CDN =
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

/** @type {Map<number, { libraryCapsuleUrl: string|null, libraryHeaderUrl: string|null }>} */
const assetCache = new Map();

function pickAssetPath(node) {
  if (!node) return null;
  return node.image2x?.english || node.image?.english || null;
}

/** Same portrait grid art the Steam client uses (library_capsule from product info). */
export async function fetchSteamLibraryAssets(appId) {
  const id = Number(appId);
  if (!Number.isFinite(id) || id <= 0) {
    return { libraryCapsuleUrl: null, libraryHeaderUrl: null };
  }
  if (assetCache.has(id)) return assetCache.get(id);

  const empty = { libraryCapsuleUrl: null, libraryHeaderUrl: null };
  try {
    const res = await fetch(`${STEAMCMD_API}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const full = data?.data?.[String(id)]?.common?.library_assets_full;
    const capsulePath = pickAssetPath(full?.library_capsule);
    const headerPath = pickAssetPath(full?.library_header);
    const result = {
      libraryCapsuleUrl: capsulePath
        ? `${ASSET_CDN}/${id}/${capsulePath}`
        : null,
      libraryHeaderUrl: headerPath
        ? `${ASSET_CDN}/${id}/${headerPath}`
        : null,
    };
    assetCache.set(id, result);
    return result;
  } catch {
    assetCache.set(id, empty);
    return empty;
  }
}

/** Legacy CDN paths — works for older titles that predate hashed library_capsule assets. */
export function legacyLibraryCapsuleUrls(appId) {
  const id = Number(appId);
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
  ];
}

export function defaultHeaderUrl(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}
