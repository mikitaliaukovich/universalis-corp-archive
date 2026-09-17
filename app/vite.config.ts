import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  // all lore text is bundled into the main chunk on purpose (no runtime fetches)
  build: { chunkSizeWarningLimit: 1500 },
})
