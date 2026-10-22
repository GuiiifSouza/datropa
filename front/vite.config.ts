import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, /api/** vai para VITE_API_PROXY (ex.: https://devs.datropa.com), igual aos rewrites do Hosting.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const alvo = env.VITE_API_PROXY;
  return {
    plugins: [react()],
    server: alvo ? { proxy: { '/api': { target: alvo, changeOrigin: true } } } : undefined,
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
