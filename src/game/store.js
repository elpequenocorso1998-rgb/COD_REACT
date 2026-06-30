import { create } from 'zustand'
import { PLAYER, WEAPONS, GRENADES } from './config.js'
import { addXP, recordKill, recordDeath, recordWave, getProgress,
  addWeaponXP, addBattlePassXP, progressDaily } from './progression.js'
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
  GAMEOVER: 'gameover',
  LOBBY: 'lobby',     // Fase 2: lobby multijugador
  MATCH_OVER: 'match_over', // Fase 2: fin de partida MP
  SPECTATING: 'spectating'  // Fase 18.5: spectate en MP death
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
    const secondary = WEAPONS[loadout.secondary]
    const maxHp = getEffectiveMaxHealth(loadout)
    // Inicializamos ammo/reserve de primary y secondary del loadout.
    // El resto de armas NO se inicializan aquí: si el jugador cambia a un
    // arma que no es de su loadout (Shift+1-7), obtiene 0 balas (no el
    // exploit de full ammo on first switch). Antes el `?? w.magSize` daba
    // munición gratis a cualquier arma nueva.
    const weaponAmmo = { [loadout.primary]: primary.magSize }
    const weaponReserve = { [loadout.primary]: primary.reserveStart }
    if (secondary) {
      weaponAmmo[loadout.secondary] = secondary.magSize
      weaponReserve[loadout.secondary] = secondary.reserveStart
    }
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
      weaponAmmo,
      weaponReserve,
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
    killStreak: 0,                  // kills consecutivos sin morir
    availableStreaks: [],           // killstreaks desbloqueados pendientes de usar
    activeStreaks: [],              // killstreaks activos ahora [{id, type, until}]
    lastKillAt: 0,                  // timestamp de la última kill (ventana multikill)
    multikillCount: 0,              // kills dentro de la ventana de 3s
    multikillLabel: null,           // callout efímero ("Double Kill", etc.)

    // --- Field upgrades (Fase 18.4) ---
    fieldUpgradeCharge: 0,          // 0..100, gana 25 por kill, 10 por hit
    fieldUpgradeCooldown: 0,        // segundos restantes de cooldown
    activeFieldUpgrade: null,       // id del field upgrade del loadout actual

    // --- Spectator (Fase 18.5) ---
    spectateTargetId: null,         // clientId del jugador seguido
    spectateMode: 'follow_third',   // 'free' | 'follow_first' | 'follow_third'
    respawnAt: 0,                   // timestamp en el que el jugador respawnea

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
    maxStamina: 100,

    // --- Granadas (Fase 4): count por tipo, no infinitas ---
    grenadeCounts: { ...GRENADES.startCounts },
    lastGrenadeAt: 0,             // timestamp del último lanzamiento (cooldown)

    // --- Gunship activo (Fase 4): el player.update skipa la cámara ---
    gunshipActive: false,

    // --- Flashbang al jugador (Fase 4): overlay blanco + stun ---
    flashbanged: 0,               // timestamp hasta el que dura el flash

    // --- FPS counter (Fase 6): actualizado por el engine cada 500ms ---
    fps: 0,

    // --- Multijugador (Fase 2) ---
    mpConnected: false,            // true si conectado al servidor MP
    mpClientId: null,              // nuestro ID en el servidor
    mpTeam: null,                  // 'axis' | 'allies'
    mpTeamScores: { axis: 0, allies: 0 }, // kills por equipo
    mpScoreLimit: 75,              // límite de kills para ganar
    mpKillfeed: [],                // últimos kills [{killer, victim, weapon, headshot, t}]
    mpRemotePlayers: [],           // estado de jugadores remotos (del último snapshot)
    mpMatchOver: false,            // partida terminada
    mpWinner: null                 // equipo ganador
    }
  }

  return {
    ...initialState(),

    // --- Acciones ---
    setState: (gameState) => set({ gameState }),
    setLoading: (loading) => set({ loading }),

    // Fase 1.5: actualiza la stamina (llamado cada frame desde engine).
    setStamina: (stamina, maxStamina) => set({ stamina, maxStamina }),

    // Fase 2: acciones multijugador.
    setMpConnected: (connected) => set({ mpConnected: connected }),
    setMpInit: (clientId, team, scoreLimit, teamScores) => set({
      mpClientId: clientId, mpTeam: team, mpScoreLimit: scoreLimit,
      mpTeamScores: teamScores || { axis: 0, allies: 0 },
      mpConnected: true, mpMatchOver: false, mpWinner: null
    }),
    setMpSnapshot: (players, teams) => set({
      mpRemotePlayers: players, mpTeamScores: teams
    }),
    addMpKill: (kill) => set((s) => ({
      mpKillfeed: [...s.mpKillfeed, { ...kill, t: Date.now() }].slice(-5)
    })),
    setMpMatchOver: (winner, teams) => set({
      mpMatchOver: true, mpWinner: winner, mpTeamScores: teams || { axis: 0, allies: 0 },
      gameState: GAME_STATES.MATCH_OVER
    }),
    clearMpKillfeed: () => set({ mpKillfeed: [] }),

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
      // Cargamos munición del arma nueva. Si no está en el map (arma fuera
      // del loadout), devolvemos 0 balas — no full ammo. Antes el `?? w.magSize`
      // era un exploit: cambiar a un arma nueva daba munición gratis.
      const w = WEAPONS[weaponId]
      const ammo = newAmmo[weaponId] ?? 0
      const reserve = newReserve[weaponId] ?? 0
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

    // Fase 4: regeneración de vida (llamada cada frame desde engine si
    // ha pasado el regenDelay sin recibir daño). Sin esto el chip damage
    // se acumula y el juego es injugable.
    regenHealth: (amount) => set((s) => {
      if (s.gameState !== GAME_STATES.PLAYING) return s
      if (s.health >= s.maxHealth) return s
      return { health: Math.min(s.maxHealth, s.health + amount) }
    }),

    // Fase 4: curación directa (pickup de salud).
    addHealth: (amount) => set((s) => ({
      health: Math.min(s.maxHealth, s.health + amount)
    })),

    // Fase 4: añade munición de reserva al arma actual (pickup de munición).
    addReserve: (amount) => set((s) => {
      const newReserve = s.reserve + amount
      const weaponReserve = { ...s.weaponReserve, [s.currentWeapon]: newReserve }
      return { reserve: newReserve, weaponReserve }
    }),

    // Fase 4: consume una granada del tipo dado. Devuelve true si tenía.
    useGrenade: (type) => {
      const counts = get().grenadeCounts
      const count = counts[type] ?? 0
      if (count <= 0) return false
      set({ grenadeCounts: { ...counts, [type]: count - 1 } })
      return true
    },

    // Fase 4: añade granadas de un tipo (pickup de granada).
    addGrenade: (type, amount = 1) => set((s) => {
      const current = s.grenadeCounts[type] ?? 0
      const maxed = Math.min(GRENADES.maxPerType, current + amount)
      return { grenadeCounts: { ...s.grenadeCounts, [type]: maxed } }
    }),

    // Fase 4: marca el gunship como activo/inactivo (player.update lo lee).
    setGunshipActive: (active) => set({ gunshipActive: active }),

    // Fase 18.4: field upgrades — charge, cooldown, active.
    setActiveFieldUpgrade: (fuId) => set({ activeFieldUpgrade: fuId }),
    addFieldUpgradeCharge: (amount) => set((s) => ({
      fieldUpgradeCharge: Math.min(100, s.fieldUpgradeCharge + amount)
    })),
    consumeFieldUpgradeCharge: () => set({ fieldUpgradeCharge: 0 }),
    setFieldUpgradeCooldown: (seconds) => set({ fieldUpgradeCooldown: Math.max(0, seconds) }),

    // Fase 18.5: spectate mode en MP death.
    startSpectating: (targetId = null) => set({
      gameState: GAME_STATES.SPECTATING,
      spectateTargetId: targetId,
      spectateMode: 'follow_third',
      respawnAt: (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 3000
    }),
    setSpectateTarget: (targetId) => set({ spectateTargetId: targetId }),
    cycleSpectateTarget: (remotePlayers, currentClientId) => {
      const allies = remotePlayers.filter((p) => p.id !== currentClientId && p.health > 0)
      if (allies.length === 0) return
      const cur = get().spectateTargetId
      const idx = allies.findIndex((p) => p.id === cur)
      const next = allies[(idx + 1) % allies.length]
      set({ spectateTargetId: next.id })
    },
    cycleSpectateMode: () => set((s) => {
      const modes = ['follow_first', 'follow_third', 'free']
      const idx = modes.indexOf(s.spectateMode)
      return { spectateMode: modes[(idx + 1) % modes.length] }
    }),

    // Fase 4: flashbang al jugador (overlay blanco + stun temporal).
    flashPlayer: (durationMs) => {
      const until = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + durationMs
      set({ flashbanged: until })
      trackTimeout(() => {
        if (get().flashbanged === until) set({ flashbanged: 0 })
      }, durationMs)
    },

    // Fase 6: actualiza el FPS counter (llamado por el engine periódicamente).
    setFps: (fps) => set({ fps }),

    // Acierto en enemigo: suma puntos y muestra hitmarker.
    // type: 'body' | 'headshot' | 'kill' (determina color + sonido).
    registerHit: (points = 10, type = 'body') => {
      const id = nextId()
      set((s) => ({
        score: s.score + points,
        hitmarkers: [...s.hitmarkers, { id, type }],
        fieldUpgradeCharge: Math.min(100, s.fieldUpgradeCharge + 10)
      }))
      trackTimeout(() => {
        set((s) => ({ hitmarkers: s.hitmarkers.filter((h) => h.id !== id) }))
      }, 250)
    },

    // Enemigo eliminado. Trackea killstreak, multikill y desbloquea streaks.
    // Fase 6: `headshot` opcional para progresar el daily de headshots.
    registerKill: (points = 100, headshot = false) => {
      const id = nextId()
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // Multikill: ventana de 3s desde la última kill.
      const prevKillAt = get().lastKillAt
      const inWindow = prevKillAt > 0 && (now - prevKillAt) < 3000
      const newMultikill = inWindow ? get().multikillCount + 1 : 1
      const multikillLabel = multikillLabelFor(newMultikill)

      set((s) => {
        const newStreak = s.killStreak + 1
        // Desbloquea killstreaks al cruzar umbrales.
        // Fase 6: los tipos vienen del loadout (loadout.killstreaks),
        // no de thresholds fijos. Antes loadout.killstreaks era config muerta.
        const newAvailable = [...s.availableStreaks]
        const loadoutKs = getLoadout().killstreaks || ['uav', 'airstrike', 'heli', 'gunship']
        const thresholds = [3, 5, 7, 11]
        for (let i = 0; i < thresholds.length && i < loadoutKs.length; i++) {
          if (newStreak === thresholds[i]) {
            newAvailable.push({ id: nextId(), type: loadoutKs[i] })
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
          multikillLabel,
          fieldUpgradeCharge: Math.min(100, s.fieldUpgradeCharge + 25)
        }
      })
      trackTimeout(() => {
        set((s) => ({ killmarkers: s.killmarkers.filter((k) => k !== id) }))
      }, 500)
      // El callout de multikill desaparece tras 1.5s.
      if (multikillLabel) {
        progressDaily('multikill', 1)
        trackTimeout(() => {
          if (get().multikillLabel === multikillLabel) {
            set({ multikillLabel: null })
          }
        }, 1500)
      }
      // --- Progresión: XP por kill (10× score) + level up ---
      const xpResult = addXP(points * 10)
      recordKill()
      // Fase 3: weapon XP + battle pass XP + daily challenges.
      const currentWeapon = get().currentWeapon
      addWeaponXP(currentWeapon, points)
      addBattlePassXP(points * 2)
      progressDaily('kills_50', 1)
      if (headshot) progressDaily('headshots_10', 1)
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
        const isMp = get().mpConnected
        const deathState = newHealth <= 0
          ? (isMp ? GAME_STATES.SPECTATING : GAME_STATES.GAMEOVER)
          : get().gameState
        set((s) => ({
          health: newHealth,
          damageFlash: true,
          lastDamageAt: now,
          damageDirections: [...s.damageDirections, { id, angle: fromDirection }],
          // Muerte limpia: firing/reloading a false, killStreak reseteado.
          // Fase 18.5: en MP va a SPECTATING (respawn tras 3s); en PvE a GAMEOVER.
          gameState: newHealth <= 0 ? deathState : s.gameState,
          firing: newHealth <= 0 ? false : s.firing,
          reloading: newHealth <= 0 ? false : s.reloading,
          deaths: newHealth <= 0 ? s.deaths + 1 : s.deaths,
          killStreak: newHealth <= 0 ? 0 : s.killStreak,
          multikillCount: newHealth <= 0 ? 0 : s.multikillCount,
          multikillLabel: newHealth <= 0 ? null : s.multikillLabel,
          respawnAt: newHealth <= 0 && isMp
            ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 3000
            : s.respawnAt
        }))
        trackTimeout(() => {
          set((s) => ({ damageDirections: s.damageDirections.filter((d) => d.id !== id) }))
        }, 1200)
      } else {
        const isMp2 = get().mpConnected
        const deathState2 = newHealth <= 0
          ? (isMp2 ? GAME_STATES.SPECTATING : GAME_STATES.GAMEOVER)
          : get().gameState
        set((s) => ({
          health: newHealth,
          damageFlash: true,
          lastDamageAt: now,
          gameState: newHealth <= 0 ? deathState2 : s.gameState,
          firing: newHealth <= 0 ? false : s.firing,
          reloading: newHealth <= 0 ? false : s.reloading,
          deaths: newHealth <= 0 ? s.deaths + 1 : s.deaths,
          killStreak: newHealth <= 0 ? 0 : s.killStreak,
          multikillCount: newHealth <= 0 ? 0 : s.multikillCount,
          multikillLabel: newHealth <= 0 ? null : s.multikillLabel,
          respawnAt: newHealth <= 0 && isMp2
            ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 3000
            : s.respawnAt
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
    // Fase 4: refill parcial entre oleadas — sin esto, el jugador se queda
    // sin munición de reserva tras unas oleadas y el juego se atasca.
    startWave: (wave, count) => {
      recordWave(wave)
      if (wave > 1) {
        // Refill: 30% de la reserva máxima del arma actual + 1 granada frag.
        // No es full heal ni full ammo: hay que seguir recogiendo pickups.
        set((s) => {
          const w = WEAPONS[s.currentWeapon]
          const refillAmt = Math.ceil(w.reserveStart * 0.3)
          const newReserve = s.reserve + refillAmt
          const weaponReserve = { ...s.weaponReserve, [s.currentWeapon]: newReserve }
          // +1 frag (si no está al máximo).
          const fragCount = s.grenadeCounts.frag ?? 0
          const grenadeCounts = fragCount < GRENADES.maxPerType
            ? { ...s.grenadeCounts, frag: fragCount + 1 }
            : s.grenadeCounts
          return {
            wave, enemiesRemaining: count,
            reserve: newReserve, weaponReserve, grenadeCounts
          }
        })
        progressDaily('waves_5', 1)
      } else {
        set({ wave, enemiesRemaining: count })
      }
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
      const secondary = WEAPONS[loadout.secondary]
      const maxHp = getEffectiveMaxHealth(loadout)
      // Inicializamos ammo/reserve de primary y secondary (igual que en
      // initialState). El resto de armas empiezan con 0.
      const weaponAmmo = { [loadout.primary]: primary.magSize }
      const weaponReserve = { [loadout.primary]: primary.reserveStart }
      if (secondary) {
        weaponAmmo[loadout.secondary] = secondary.magSize
        weaponReserve[loadout.secondary] = secondary.reserveStart
      }
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
        weaponAmmo,
        weaponReserve,
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
        // Fase 18.4: field upgrades reset.
        fieldUpgradeCharge: 0,
        fieldUpgradeCooldown: 0,
        activeFieldUpgrade: loadout.fieldUpgrade || null,
        scoreboardOpen: false,
        // Progresión se mantiene (es persistente entre partidas).
        playerLevel: prog.level,
        playerXP: prog.xp,
        playerXPNeeded: prog.xpNeeded,
        levelUpFlash: null,
        // Fase 1.5: stamina al máximo al iniciar partida.
        stamina: 100,
        maxStamina: 100,
        // Fase 4: granadas, gunship y flash reseteados.
        grenadeCounts: { ...GRENADES.startCounts },
        lastGrenadeAt: 0,
        gunshipActive: false,
        flashbanged: 0
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
