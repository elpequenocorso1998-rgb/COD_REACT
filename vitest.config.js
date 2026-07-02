import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    // jsdom: los tests de engine/player/etc. que añadamos en el futuro
    // necesitarán requestAnimationFrame, document, HTMLElement. node env
    // fallaría opacamente al instanciarlos.
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    globals: false,
    clearMocks: true,
    // Limpia timers pendientes entre tests para evitar que timeouts del
    // store (80ms/250ms/1500ms) se disparen durante tests posteriores
    // (antes causaba flakiness order-dependent).
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/game/**/*.js'],
      exclude: ['src/game/world/shaders/**']
    }
  }
})
