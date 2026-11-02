import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  define: { __BUILD_ID__: JSON.stringify(sha) },
  build: { chunkSizeWarningLimit: 4000, reportCompressedSize: false },
  test: { include: ['tests/**/*.test.ts'] },
});
