import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    __BUILD_CHANNEL__: JSON.stringify(process.env.BUILD_CHANNEL ?? ''),
    __BUILD_DATE__: JSON.stringify(process.env.BUILD_DATE ?? ''),
  },
})
