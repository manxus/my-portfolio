import { bearerToken, envTokenSigner, isCrossOrigin, json } from './admin-core.js';

/**
 * Wraps one of the dev-api proxies (TMDB, Nominatim) for the live site, where only the admin
 * editor uses them: without this anyone could spend the TMDB key's quota, or get the site's
 * Nominatim contact rate-limited.
 */
export function requireAdmin(handler) {
  return async (req, res) => {
    if (isCrossOrigin(req)) return json(res, 403, { error: 'Cross-origin request refused' });
    if (!envTokenSigner()?.verify(bearerToken(req))) {
      return json(res, 401, { error: 'Unauthorized' });
    }
    return handler(req, res);
  };
}
