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

  return {
    plugins: [react(), adminApiPlugin()],
  }
})
