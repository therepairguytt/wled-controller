import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiHost = env.VITE_API_HOST; 
  const apiPort = parseInt(env.VITE_API_PORT);
  const appHost = env.VITE_APP_HOST;
  const appPort = parseInt(env.VITE_APP_PORT);

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    server: {
      host: env.VITE_APP_HOST || '0.0.0.0', 
      port: parseInt(env.VITE_APP_PORT) || 3030,
      
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