import { create } from 'zustand'
import { PLAYER, WEAPONS } from './config.js'
import { addXP, recordKill, recordDeath, recordWave, getProgress } from './progression.js'
import { getLoadout, getPrimaryWeapon, getEffectiveMaxHealth, applyLoadoutToWeapon } from './loadout.js'

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
   - Valores de arma/jugador importados de config.js (antes hardcodeados
     aquí y en enemies.js, con riesgo de desincronización).
   - takeDamage atómico: una sola llamada set() calcula vida, flash,
     dirección y transición a GAMEOVER (antes 3 sets separados).
   - En muerte se limpia firing/reloading y se cancelan timeouts pendientes.
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
  // Cap para evitar overflow teórico en sesiones muy largas.
  if (_idCounter > Number.MAX_SAFE_INTEGER - 1) _idCounter = 1
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

  // Cancela todos los timeouts pendientes (llamado por reset y por muerte).
  function clearPendingTimeouts() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts.clear()
  }

  // Estado inicial derivado de config (single source of truth).
  // Fase 1.4: usa el loadout del jugador (perks + attachments aplicados).
  const initialState = () => {
    const loadout = getLoadout()
    const primary = getPrimaryWeapon(loadout)
    const maxHp = getEffectiveMaxHealth(loadout)
    return {
      // --- Estado general ---
      gameState: GAME_STATES.MENU,    // pantalla activa
      loading: true,                  // true mientras Three.js monta la escena
      score: 0,                       // puntuación total
      wave: 1,                        // oleada actual
      enemiesRemaining: 0,            // enemigos vivos en la oleada

      // --- Jugador ---
      health: maxHp,
      maxHealth: maxHp,

      // --- Arma ---
      // Fase 1.4: arma inicial = primary del loadout (con attachments).
      currentWeapon: loadout.primary,
      weaponAmmo: { [loadout.primary]: primary.magSize },
      weaponReserve: { [loadout.primary]: primary.reserveStart },
      ammo: primary.magSize,
      magSize: primary.magSize,
      reserve: primary.reserveStart,
      reloading: false,

    // --- Feedback visual ---
    firing: false,                  // crosshair se ensancha
    hitmarkers: [],                 // lista de {id, type} efímeros para pintar X
    killmarkers: [],                // X grande dorada al matar
    damageFlash: false,             // viñeta roja al recibir daño
    damageDirections: [],           // indicadores direccionales {id, angle}
    lastDamageAt: 0,                // timestamp del último daño (para i-frames)

    // --- Stats y killstreaks ---
    kills: 0,                       // kills totales (scoreboard)
    deaths: 0,                      // muertes totales (scoreboard)
    killStreak: 0,                  // kills consecutivas sin morir
    availableStreaks: [],           // killstreaks desbloqueados pendientes de usar
    activeStreaks: [],              // killstreaks activos ahora [{id, type, until}]
    lastKillAt: 0,                  // timestamp de la última kill (ventana multikill)
    multikillCount: 0,              // kills dentro de la ventana de 3s
    multikillLabel: null,           // callout efímero ("Double Kill", etc.)

    // --- UAV (killstreak de 3): revela enemigos en el minimap ---
    uavActive: false,

    // --- Scoreboard ---
    scoreboardOpen: false,           // overlay Tab hold

    // --- Progresión (XP/nivel, reflejada en HUD desde progression.js) ---
    playerLevel: getProgress().level,
    playerXP: getProgress().xp,
    playerXPNeeded: getProgress().xpNeeded,
    levelUpFlash: null,              // {level, unlocks} efímero al subir de nivel

    // --- Stamina (Fase 1.5) ---
    stamina: 100,
    maxStamina: 100
    }
  }

  return {
    ...initialState(),

    // --- Acciones ---
    setState: (gameState) => set({ gameState }),
    setLoading: (loading) => set({ loading }),

    // Fase 1.5: actualiza la stamina (llamado cada frame desde engine).
    setStamina: (stamina, maxStamina) => set({ stamina, maxStamina }),

    // Cambia de arma: guarda la munición del arma actual y carga la de la nueva.
    switchWeapon: (weaponId) => {
      if (!WEAPONS[weaponId]) return
      const { currentWeapon, weaponAmmo, weaponReserve } = get()
      if (weaponId === currentWeapon) return
      // Guardamos munición del arma actual.
      const newAmmo = { ...weaponAmmo }
      const newReserve = { ...weaponReserve }
      newAmmo[currentWeapon] = get().ammo
      newReserve[currentWeapon] = get().reserve
      // Cargamos munición del arma nueva (o inicializamos si es primera vez).
      const w = WEAPONS[weaponId]
      const ammo = newAmmo[weaponId] ?? w.magSize
      const reserve = newReserve[weaponId] ?? w.reserveStart
      set({
        currentWeapon: weaponId,
        ammo, reserve,
        magSize: w.magSize,
        reloading: false,
        weaponAmmo: newAmmo,
        weaponReserve: newReserve
      })
    },

    // Devuelve la definición del arma equipada actualmente.
    // Fase 1.4: aplica el loadout (attachments + perks) al arma equipada.
    getCurrentWeapon: () => applyLoadoutToWeapon(get().currentWeapon, getLoadout()),

    // Disparo: consume 1 bala y marca el crosshair como "firing".
    fire: () => {
      // Lectura + escritura atómica vía set con función (evita race con
      // doble llamada en el mismo tick).
      let fired = false
      set((s) => {
        if (s.reloading || s.ammo <= 0) return s
        fired = true
        return { ammo: s.ammo - 1, firing: true }
      })
      if (!fired) return false
      // el crosshair vuelve a su tamaño tras 80ms
      trackTimeout(() => set({ firing: false }), 80)
      return true
    },

    // Recarga: mueve balas de la reserva al cargador.
    reload: () => {
      const { ammo, magSize, reserve, reloading, currentWeapon } = get()
      if (reloading || ammo === magSize || reserve <= 0) return
      const w = WEAPONS[currentWeapon]
      set({ reloading: true })
      trackTimeout(() => {
        set((s) => {
          const need = s.magSize - s.ammo
          const move = Math.min(need, s.reserve)
          return {
            ammo: s.ammo + move,
            reserve: s.reserve - move,
            reloading: false
          }
        })
      }, w.reloadTime * 1000) // config en segundos → ms para setTimeout
    },

    // Acierto en enemigo: suma puntos y muestra hitmarker.
    // type: 'body' | 'headshot' | 'kill' (determina color + sonido).
    registerHit: (points = 10, type = 'body') => {
      const id = nextId()
      set((s) => ({
        score: s.score + points,
        hitmarkers: [...s.hitmarkers, { id, type }]
      }))
      trackTimeout(() => {
        set((s) => ({ hitmarkers: s.hitmarkers.filter((h) => h.id !== id) }))
      }, 250)
    },

    // Enemigo eliminado. Trackea killstreak, multikill y desbloquea streaks.
    registerKill: (points = 100) => {
      const id = nextId()
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // Multikill: ventana de 3s desde la última kill.
      const prevKillAt = get().lastKillAt
      const inWindow = prevKillAt > 0 && (now - prevKillAt) < 3000
      const newMultikill = inWindow ? get().multikillCount + 1 : 1
      const multikillLabel = multikillLabelFor(newMultikill)

      set((s) => {
        const newStreak = s.killStreak + 1
        // Desbloquea killstreaks al cruzar umbrales (3/5/7/11).
        const newAvailable = [...s.availableStreaks]
        const thresholds = [
          { count: 3, type: 'uav' },
          { count: 5, type: 'airstrike' },
          { count: 7, type: 'heli' },
          { count: 11, type: 'gunship' }
        ]
        for (const t of thresholds) {
          if (newStreak === t.count) {
            newAvailable.push({ id: nextId(), type: t.type })
          }
        }
        return {
          score: s.score + points,
          kills: s.kills + 1,
          enemiesRemaining: Math.max(0, s.enemiesRemaining - 1),
          killmarkers: [...s.killmarkers, id],
          killStreak: newStreak,
          availableStreaks: newAvailable,
          lastKillAt: now,
          multikillCount: newMultikill,
          multikillLabel
        }
      })
      trackTimeout(() => {
        set((s) => ({ killmarkers: s.killmarkers.filter((k) => k !== id) }))
      }, 500)
      // El callout de multikill desaparece tras 1.5s.
      if (multikillLabel) {
        trackTimeout(() => {
          if (get().multikillLabel === multikillLabel) {
            set({ multikillLabel: null })
          }
        }, 1500)
      }
      // --- Progresión: XP por kill (10× score) + level up ---
      const xpResult = addXP(points * 10)
      recordKill()
      if (xpResult.leveledUp) {
        set({
          playerLevel: xpResult.newLevel,
          playerXP: xpResult.xp,
          playerXPNeeded: xpResult.xpNeeded,
          levelUpFlash: { level: xpResult.newLevel, unlocks: xpResult.newUnlocks }
        })
        // El flash de level up desaparece tras 3s.
        trackTimeout(() => set({ levelUpFlash: null }), 3000)
      } else {
        set({ playerXP: xpResult.xp, playerXPNeeded: xpResult.xpNeeded })
      }
    },

    // Consume un killstreak desbloqueado y lo activa.
    useStreak: (streakId) => {
      const { availableStreaks } = get()
      const streak = availableStreaks.find((s) => s.id === streakId)
      if (!streak) return false
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const duration = streakDuration(streak.type)
      set((s) => ({
        availableStreaks: s.availableStreaks.filter((s2) => s2.id !== streakId),
        activeStreaks: [...s.activeStreaks, { id: streakId, type: streak.type, until: now + duration }]
      }))
      // UAV: activa reveal del minimap.
      if (streak.type === 'uav') set({ uavActive: true })
      // Auto-expira el streak.
      trackTimeout(() => {
        set((s) => ({
          activeStreaks: s.activeStreaks.filter((s2) => s2.id !== streakId)
        }))
        if (streak.type === 'uav') {
          // Solo desactiva UAV si no hay otro UAV activo.
          const stillUav = get().activeStreaks.some((s2) => s2.type === 'uav')
          if (!stillUav) set({ uavActive: false })
        }
      }, duration)
      return true
    },

    // Toggle del scoreboard (Tab hold).
    toggleScoreboard: (open) => {
      set({ scoreboardOpen: open })
    },

    // Daño al jugador.
    // I-frames: tras recibir daño, 0.5s de invulnerabilidad (PLAYER.invulnTime)
    // para evitar melts instantáneos cuando varios enemigos golpean en el
    // mismo frame. Antes no había i-frames y 3 enemigos mataban al jugador
    // de golpe.
    // ATÓMICO: una sola llamada set() calcula vida, flash, dirección y
    // transición a GAMEOVER. Antes eran 3 sets separados que dejaban estado
    // intermedio inconsistente.
    takeDamage: (amount, fromDirection = null) => {
      const { health, gameState, lastDamageAt } = get()
      if (gameState !== GAME_STATES.PLAYING) return
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (now - lastDamageAt < PLAYER.invulnTime * 1000) return
      const newHealth = Math.max(0, health - amount)

      if (fromDirection !== null) {
        const id = nextId()
        set((s) => ({
          health: newHealth,
          damageFlash: true,
          lastDamageAt: now,
          damageDirections: [...s.damageDirections, { id, angle: fromDirection }],
          // Muerte limpia: firing/reloading a false, killStreak reseteado.
          gameState: newHealth <= 0 ? GAME_STATES.GAMEOVER : s.gameState,
          firing: newHealth <= 0 ? false : s.firing,
          reloading: newHealth <= 0 ? false : s.reloading,
          deaths: newHealth <= 0 ? s.deaths + 1 : s.deaths,
          killStreak: newHealth <= 0 ? 0 : s.killStreak,
          multikillCount: newHealth <= 0 ? 0 : s.multikillCount,
          multikillLabel: newHealth <= 0 ? null : s.multikillLabel
        }))
        trackTimeout(() => {
          set((s) => ({ damageDirections: s.damageDirections.filter((d) => d.id !== id) }))
        }, 1200)
      } else {
        set((s) => ({
          health: newHealth,
          damageFlash: true,
          lastDamageAt: now,
          gameState: newHealth <= 0 ? GAME_STATES.GAMEOVER : s.gameState,
          firing: newHealth <= 0 ? false : s.firing,
          reloading: newHealth <= 0 ? false : s.reloading,
          deaths: newHealth <= 0 ? s.deaths + 1 : s.deaths,
          killStreak: newHealth <= 0 ? 0 : s.killStreak,
          multikillCount: newHealth <= 0 ? 0 : s.multikillCount,
          multikillLabel: newHealth <= 0 ? null : s.multikillLabel
        }))
      }
      if (newHealth <= 0) {
        // Al morir cancelamos la recarga pendiente y el timeout del flash
        // de daño para que no muten el estado post-muerte.
        clearPendingTimeouts()
        // Progresión: XP de consolación + registramos muerte/oleada.
        const xpResult = addXP(50)
        recordDeath()
        recordWave(get().wave)
        set({
          playerLevel: xpResult.newLevel,
          playerXP: xpResult.xp,
          playerXPNeeded: xpResult.xpNeeded
        })
      } else {
        trackTimeout(() => set({ damageFlash: false }), 150)
      }
    },

    // Inicia una nueva oleada.
    startWave: (wave, count) => {
      recordWave(wave)
      set({ wave, enemiesRemaining: count })
    },

    // Resetea todo para una nueva partida.
    // IMPORTANTE: cancela los timeouts pendientes para que el feedback
    // efímero (hitmarkers, damage flash, recarga) de la partida anterior
    // no reaparezca sobre la nueva (bug fixed).
    reset: () => {
      clearPendingTimeouts()
      const prog = getProgress()
      // Fase 1.4: aplica el loadout del jugador (perks + attachments).
      const loadout = getLoadout()
      const primary = getPrimaryWeapon(loadout)
      const maxHp = getEffectiveMaxHealth(loadout)
      set({
        gameState: GAME_STATES.PLAYING,
        score: 0,
        wave: 1,
        enemiesRemaining: 0,
        health: maxHp,
        maxHealth: maxHp,
        lastDamageAt: 0,
        // Fase 1.4: arma inicial = primary del loadout (con attachments).
        currentWeapon: loadout.primary,
        weaponAmmo: { [loadout.primary]: primary.magSize },
        weaponReserve: { [loadout.primary]: primary.reserveStart },
        ammo: primary.magSize,
        magSize: primary.magSize,
        reserve: primary.reserveStart,
        reloading: false,
        firing: false,
        hitmarkers: [],
        killmarkers: [],
        damageFlash: false,
        damageDirections: [],
        // Stats y streaks reseteados para la nueva partida.
        kills: 0,
        deaths: 0,
        killStreak: 0,
        availableStreaks: [],
        activeStreaks: [],
        lastKillAt: 0,
        multikillCount: 0,
        multikillLabel: null,
        uavActive: false,
        scoreboardOpen: false,
        // Progresión se mantiene (es persistente entre partidas).
        playerLevel: prog.level,
        playerXP: prog.xp,
        playerXPNeeded: prog.xpNeeded,
        levelUpFlash: null,
        // Fase 1.5: stamina al máximo al iniciar partida.
        stamina: 100,
        maxStamina: 100
      })
    }
  }
})

// --- Helpers de killstreaks y multikills (a nivel módulo, sin estado) ---

// Devuelve el label del multikill según el count (0 o 1 = sin callout).
function multikillLabelFor(count) {
  if (count >= 8) return 'MONSTER KILL'
  if (count >= 6) return 'MEGA KILL'
  if (count >= 4) return 'MULTI KILL'
  if (count >= 3) return 'TRIPLE KILL'
  if (count >= 2) return 'DOUBLE KILL'
  return null
}

// Duración (ms) de cada tipo de killstreak.
function streakDuration(type) {
  switch (type) {
    case 'uav': return 30000       // 30s de reveal
    case 'airstrike': return 8000  // 8s de ventana de bombardeo
    case 'heli': return 60000      // 60s de helicóptero aliado
    case 'gunship': return 30000   // 30s de control de cañón aéreo
    default: return 10000
  }
}
