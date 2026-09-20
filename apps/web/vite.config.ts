import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  const url = new URL(env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1');
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('VITE_API_BASE_URL must use HTTP(S)');
  return {
    plugins: [react(), tailwindcss()],
    // The root .env is also used by the API's development process.
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        command === 'build' ? 'production' : 'development',
      ),
    },
    envDir: '../..',
    server: { port: 5173, strictPort: true },
  };
});
