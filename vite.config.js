import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site at https://<user>.github.io/nfl-pbp-app/
export default defineConfig({
  base: '/nfl-pbp-app/',
  plugins: [react()],
})
