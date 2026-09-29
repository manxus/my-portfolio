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
  // The admin API refuses every login until both of these are set.
  if (env.ADMIN_USER) process.env.ADMIN_USER = env.ADMIN_USER
  if (env.ADMIN_PASS) process.env.ADMIN_PASS = env.ADMIN_PASS
  if (env.NOMINATIM_CONTACT) process.env.NOMINATIM_CONTACT = env.NOMINATIM_CONTACT

  return {
    plugins: [react(), adminApiPlugin()],
  }
})
