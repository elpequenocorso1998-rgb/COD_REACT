import { create } from 'zustand'

/* =========================================================================
   Store global del juego (Zustand).
   --------------------------------------------------------------------------
   Centralizamos TODO el estado que React necesita pintar en el HUD o en los
   menús. El bucle de Three.js lee/escribe este estado sin provocar re-renders
   constantes: usamos getState() para lecturas puntuales y set() solo cuando
   hay algo que el HUD deba reflejar (vida, munición, etc.).

   Mejoras:
   - Todos los setTimeout se trackean en `pendingTimeouts` y se cancelan en
     reset() para evitar que marcadores/estado de la partida anterior
     reaparezcan tras un reinicio rápido (bug fixed).
   - IDs efímeros con contador monótono (sin colisiones bajo fuego rápido).
   ========================================================================= */

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover'
}

// Contador monótono para IDs de hitmarkers/killmarkers/damageDirections.
// Más seguro que Date.now()+Math.random() (sin colisiones bajo ráfaga).
let _idCounter = 0
function nextId() {
  _idCounter += 1
  return _idCounter
}

export const useGameStore = create((set, get) => {
  // Timeouts pendientes: se cancelan en reset() para evitar que feedback
  // de la partida anterior (hitmarkers, damage flash, recarga) reaparezca
  // tras un reinicio rápido.
  const pendingTimeouts = new Set()

  // Wrapper sobre setTimeout que registra el id y se auto-limpia al disparar.
  // Devuelve el id por si hace falta cancelarlo manualmente.
  function trackTimeout(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts.delete(id)
      fn()
    }, ms)
    pendingTimeouts.add(id)
    return id
  }

  // Cancela todos los timeouts pendientes (llamado por reset).
  function clearPendingTimeouts() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts.clear()
  }

  return {
    // --- Estado general ---
    gameState: GAME_STATES.MENU,    // pantalla activa
    loading: true,                  // true mientras Three.js monta la escena
    score: 0,                       // puntuación total
    wave: 1,                        // oleada actual
    enemiesRemaining: 0,            // enemigos vivos en la oleada

    // --- Jugador ---
    health: 100,
    maxHealth: 100,

    // --- Arma ---
    ammo: 30,
    magSize: 30,
    reserve: 90,
    reloading: false,

    // --- Feedback visual ---
    firing: false,                  // crosshair se ensancha
    hitmarkers: [],                 // lista de IDs efímeros para pintar X
    killmarkers: [],                // X grande dorada al matar
    damageFlash: false,             // viñeta roja al recibir daño
    damageDirections: [],           // indicadores direccionales {id, angle}

    // --- Acciones ---
    setState: (gameState) => set({ gameState }),
    setLoading: (loading) => set({ loading }),

    // Disparo: consume 1 bala y marca el crosshair como "firing".
    fire: () => {
      const { ammo, reloading } = get()
      if (reloading || ammo <= 0) return false
      set({ ammo: ammo - 1, firing: true })
      // el crosshair vuelve a su tamaño tras 80ms
      trackTimeout(() => set({ firing: false }), 80)
      return true
    },

    // Recarga: mueve balas de la reserva al cargador.
    reload: () => {
      const { ammo, magSize, reserve, reloading } = get()
      if (reloading || ammo === magSize || reserve <= 0) return
      set({ reloading: true })
      trackTimeout(() => {
        const need = magSize - get().ammo
        const move = Math.min(need, get().reserve)
        set((s) => ({
          ammo: s.ammo + move,
          reserve: s.reserve - move,
          reloading: false
        }))
      }, 1500) // 1.5s de tiempo de recarga
    },

    // Acierto en enemigo: suma puntos y muestra hitmarker.
    registerHit: (points = 10) => {
      const id = nextId()
      set((s) => ({
        score: s.score + points,
        hitmarkers: [...s.hitmarkers, id]
      }))
      trackTimeout(() => {
        set((s) => ({ hitmarkers: s.hitmarkers.filter((h) => h !== id) }))
      }, 250)
    },

    // Enemigo eliminado.
    registerKill: (points = 100) => {
      const id = nextId()
      set((s) => ({
        score: s.score + points,
        enemiesRemaining: Math.max(0, s.enemiesRemaining - 1),
        killmarkers: [...s.killmarkers, id]
      }))
      trackTimeout(() => {
        set((s) => ({ killmarkers: s.killmarkers.filter((k) => k !== id) }))
      }, 500)
    },

    // Daño al jugador.
    takeDamage: (amount, fromDirection = null) => {
      const { health, gameState } = get()
      if (gameState !== GAME_STATES.PLAYING) return
      const newHealth = Math.max(0, health - amount)
      set({ health: newHealth, damageFlash: true })
      trackTimeout(() => set({ damageFlash: false }), 150)

      // Indicador direccional si se pasa el ángulo.
      if (fromDirection !== null) {
        const id = nextId()
        set((s) => ({ damageDirections: [...s.damageDirections, { id, angle: fromDirection }] }))
        trackTimeout(() => {
          set((s) => ({ damageDirections: s.damageDirections.filter((d) => d.id !== id) }))
        }, 1200)
      }

      if (newHealth <= 0) set({ gameState: GAME_STATES.GAMEOVER })
    },

    // Inicia una nueva oleada.
    startWave: (wave, count) => set({ wave, enemiesRemaining: count }),

    // Resetea todo para una nueva partida.
    // IMPORTANTE: cancela los timeouts pendientes para que el feedback
    // efímero (hitmarkers, damage flash, recarga) de la partida anterior
    // no reaparezca sobre la nueva (bug fixed).
    reset: () => {
      clearPendingTimeouts()
      set({
        gameState: GAME_STATES.PLAYING,
        score: 0,
        wave: 1,
        enemiesRemaining: 0,
        health: 100,
        maxHealth: 100,
        ammo: 30,
        magSize: 30,
        reserve: 90,
        reloading: false,
        firing: false,
        hitmarkers: [],
        killmarkers: [],
        damageFlash: false,
        damageDirections: []
      })
    }
  }
})
