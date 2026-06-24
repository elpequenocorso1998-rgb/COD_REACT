import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite.
// - 'server.host = 0.0.0.0' permite conexiones externas (necesario dentro de Docker).
// - 'server.port = 9432' es el puerto solicitado por el usuario.
// - 'server.hmr.overlay = false' desactiva el overlay de errores para no tapar el juego.
export default defineConfig({
  plugins: [react()],
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
