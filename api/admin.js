import { createAdminHandler, envTokenSigner } from './_lib/admin-core.js';
import { githubStorage, workflowSync } from './_lib/github.js';

/**
 * Every /api/admin/* route on the live site, funnelled here by the rewrite in vercel.json.
 * Locally the Vite plugin answers them instead.
 */
const handleAdmin = createAdminHandler({
  tokens: envTokenSigner(),
  storage: githubStorage,
  sync: workflowSync,
  loginDisabledReason:
    'Admin login is disabled: set ADMIN_USER, ADMIN_PASS and ADMIN_TOKEN_SECRET (32+ characters) in the Vercel project.',
});

export default handleAdmin;
