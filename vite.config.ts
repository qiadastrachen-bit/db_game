import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync } from 'node:fs';

/** 把 vendor 字体（assets/fonts）原样拷进 dist（?url 逐个导入不适用于 97 个分片） */
function copyFonts(): Plugin {
  return {
    name: 'copy-fonts',
    closeBundle() {
      if (existsSync('assets/fonts')) {
        cpSync('assets/fonts', 'dist/assets/fonts', { recursive: true });
      }
    },
  };
}

// 相对路径打包，保证 dist/ 可以在任意静态子路径部署
export default defineConfig({
  base: './',
  plugins: [copyFonts()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600, // phaser 单包较大，仅放宽告警
  },
  server: {
    host: true, // 允许 npm run dev -- --host 127.0.0.1 / --port 7100 等 CLI 参数直接转发
    strictPort: false,
  },
});
