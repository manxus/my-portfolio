import tmdbHandler from '../dev-api/tmdb.cjs';
import { requireAdmin } from './_lib/require-admin.js';

/** The Cinema editor's TMDB search on the live site. Locally the Vite plugin serves /api/tmdb. */
export default requireAdmin(tmdbHandler);
