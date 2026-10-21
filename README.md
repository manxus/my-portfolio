# Build Verified — portfolio

React + Vite SPA with a game-style shell and Steam data.

**Editing content:** run `npm run dev` and triple-click the copyright on the main menu. That opens the local admin, which edits `src/data/*.json` through the Vite admin API. It needs `ADMIN_USER` / `ADMIN_PASS` in `.env` (see [.env.example](.env.example)); commit the changed JSON to publish.

**Editing on the live site (e.g. from a phone):** the same admin runs on Vercel through `api/admin.js`. A save there commits the JSON to `main` through the GitHub API. Vercel skips building those commits (`ignoreCommand` in [vercel.json](vercel.json)), so you can save as often as you like, then press **PUBLISH** in the admin toolbar to put every saved change live in one deploy about a minute later. The daily bot syncs deploy too, so unpublished saves also go live with the next one. **Sync now** starts the game's GitHub Actions workflow instead of running the script. One-time setup:

1. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) for this repository only, with **Contents: Read and write** and **Actions: Read and write**.
2. In the Vercel project's environment variables (Production), set `ADMIN_USER`, `ADMIN_PASS` (long and unique, because this login is on the public internet), `ADMIN_TOKEN_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `GITHUB_TOKEN`, `GITHUB_REPO=manxus/my-portfolio`, `TMDB_API_KEY`, `NOMINATIM_CONTACT` and `VITE_ADMIN_ENABLED=true` (a **Config** variable: Vercel refuses `VITE_` names as Secret). Recommended: create a deploy hook under **Settings → Git → Deploy Hooks** for `main` and save its URL as `VERCEL_DEPLOY_HOOK_URL`, so **PUBLISH** deploys even when Vercel misses a push.
3. Optional but recommended: set `ADMIN_TOTP_SECRET` to a base32 secret and add it to an authenticator app. Login then also asks for the 6-digit code.
4. Redeploy.

Pull before working locally, since the live admin commits to `main` as well.

---

## React + Vite (template notes)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in the ESLint configuration.