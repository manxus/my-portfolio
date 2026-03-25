import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adminApiPlugin from './vite-plugin-admin-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminApiPlugin()],
})
