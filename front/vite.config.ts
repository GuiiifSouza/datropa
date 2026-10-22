import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, /api/** vai para VITE_API_PROXY (ex.: https://datropa.web.app), igual aos rewrites do Hosting.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const alvo = env.VITE_API_PROXY;
  return {
    plugins: [react()],
    // /__ traz o /__/firebase/init.json do Hosting, para o login funcionar também em dev.
    server: alvo ? { proxy: { '/api': { target: alvo, changeOrigin: true }, '/__': { target: alvo, changeOrigin: true } } } : undefined,
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
