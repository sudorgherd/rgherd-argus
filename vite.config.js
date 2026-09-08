import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@argus-host': fileURLToPath(new URL('./src/modules/host/index.js', import.meta.url)),
    },
  },
})
