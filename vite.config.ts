import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const TTS_TARGET = process.env.TTS_PROXY || 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 方便 iPad 同一局域网访问 dev 服务
    host: true,
    proxy: {
      '/api/tts': {
        target: TTS_TARGET,
        changeOrigin: true,
      },
      '/health': {
        target: TTS_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api/tts': {
        target: TTS_TARGET,
        changeOrigin: true,
      },
      '/health': {
        target: TTS_TARGET,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
