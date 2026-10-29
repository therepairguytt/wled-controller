import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiHost = env.VITE_API_HOST || '127.0.0.1';
  const apiPort = parseInt(env.VITE_API_PORT) || 8000;
  const appHost = env.VITE_APP_HOST || '127.0.0.1';
  const appPort = parseInt(env.VITE_APP_PORT) || 3030;
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },

    server: {
      host: appHost,
      port: appPort,
      
      proxy: {
        '/api': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://${apiHost}:${apiPort}`,
          ws: true,
        },
      },
    },
  }
})
