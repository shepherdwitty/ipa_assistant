import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** 冷门默认端口，减少和本机其它 dev 服务冲突 */
const WEB_PORT = Number(process.env.WEB_PORT || 17321)
const TTS_PORT = Number(process.env.TTS_PORT || 17322)
const TTS_TARGET = process.env.TTS_PROXY || `http://127.0.0.1:${TTS_PORT}`

export default defineConfig({
  // Electron / 本地静态服务下相对路径更稳妥
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: WEB_PORT,
    strictPort: true,
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
    port: WEB_PORT,
    strictPort: true,
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
