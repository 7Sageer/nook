import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 代理 /images/ 请求到 Wails 后端
      '/images': {
        target: 'http://localhost:34115',
        changeOrigin: true,
      },
    },
  },
})
