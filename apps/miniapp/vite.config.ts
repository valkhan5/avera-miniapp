import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@core': r('../../supabase/functions/_shared/core/index.ts'), '@brand': r('../../packages/brand') } },
  server: { fs: { allow: [r('../..')] } },
  build: { target: 'es2020', chunkSizeWarningLimit: 600 },
});
