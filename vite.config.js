import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Configuración de Vite.
// - 'server.host = 0.0.0.0' permite conexiones externas (necesario dentro de Docker).
// - 'server.port = 9432' es el puerto solicitado por el usuario.
// - 'server.hmr.overlay = false' desactiva el overlay de errores para no tapar el juego.
// - resolve.alias '@' → src: alineado con jsconfig.json para que el IDE y
//   el bundler resuelvan el alias igual (antes solo jsconfig lo declaraba).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 9432,
    strictPort: true,
    hmr: { overlay: false }
  },
  preview: {
    host: '0.0.0.0',
    port: 9432,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 1500
  }
})
