/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import adminApiPlugin from './vite-plugin-admin-api.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only exposes .env to the client bundle; the dev-only API middleware
  // runs in Node and reads process.env, so load it in explicitly.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.TMDB_API_KEY = env.TMDB_API_KEY ?? ''
  // Without these the admin API falls back to admin/admin, so the credentials
  // in .env silently did nothing and the real ones were rejected.
  if (env.ADMIN_USER) process.env.ADMIN_USER = env.ADMIN_USER
  if (env.ADMIN_PASS) process.env.ADMIN_PASS = env.ADMIN_PASS

  return {
    plugins: [react(), adminApiPlugin()],
  }
})
