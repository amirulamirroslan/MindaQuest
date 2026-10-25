import { resolve } from 'node:path';
import { defineConfig } from 'vite';
// Pages: index.html is the 3D game (the only game since v2.17; the old 2D Phaser game was removed),
// 3d.html is the old 3D address (same game, kept so existing bookmarks still work).
export default defineConfig({
  base: './',
  define: { __MQ_BUILD__: JSON.stringify(Date.now().toString(36)) },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { rollupOptions: { input: { play3d: resolve(__dirname, 'index.html'), old3d: resolve(__dirname, '3d.html') } } },
});
