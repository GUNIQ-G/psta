import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 모든 인터페이스에서 수신
    port: 3000,
    strictPort: false,
    // Disable host check for proxy access
    allowedHosts: ['.dztechwill.com', 'psta.dztechwill.com'],
    hmr: {
      overlay: false, // Disable error overlay
      clientPort: undefined, // Don't specify client port (prevents WebSocket connection)
    },
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://0.0.0.0:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});