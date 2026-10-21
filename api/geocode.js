import geocodeHandler from '../dev-api/geocode.cjs';
import { requireAdmin } from './_lib/require-admin.js';

/** The Travel editor's place search on the live site. Locally the Vite plugin serves /api/geocode. */
export default requireAdmin(geocodeHandler);
