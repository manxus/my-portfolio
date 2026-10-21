/**
 * Whether this build carries a working admin UI. Always on under `npm run dev`
 * (the Vite middleware serves the API); in a production build only when the
 * deploy sets VITE_ADMIN_ENABLED=true, which is where the serverless admin API
 * lives. Folds to a constant at build time, so a build without the flag keeps
 * every admin surface inert.
 */
export const ADMIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ADMIN_ENABLED === 'true';
