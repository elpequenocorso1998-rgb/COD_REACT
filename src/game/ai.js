/* =========================================================================
   AI — state machine táctica para enemigos.
   --------------------------------------------------------------------------
   Antes enemies.js perseguía al jugador en línea recta. Ahora cada bot
   tiene un estado con lógica específica:

     Engage   — avanza hacia el jugador manteniendo línea de visión.
     Flank    — rodea al jugador por un lado.
     TakeCover — busca cobertura cercana (raycast horizontal).
     Suppress — dispara sin avanzar para mantener al jugador agachado.
     Retreat  — retrocede si está malherido y el jugador avanzó.
     Advance  — avanza por navmesh (pathfinding real).
     Reload   — inmóvil recargando (solo shooters).
     Dead     — ragdoll activo.

   Las transiciones se evalúan cada ~0.2s (no cada frame) para evitar
   jitter y ahorrar CPU. El navmesh se usa para Advance/Flank; el resto
   usa raycasts + steering directo.

   Suppression: si un disparo del jugador pasa cerca (raycast a <2m),
   el bot entra en TakeCover por 2s. Esto simula fuego de supresión.
   ========================================================================= */

const DECISION_INTERVAL = 0.2 // segundos entre re-evaluación de estados
const FLANK_DISTANCE = 12     // distancia a la que empieza a flanquear
const COVER_SEARCH_RADIUS = 8 // radio de búsqueda de cobertura
const RETREAT_HP_PERCENT = 0.25 // bajo 25% HP → retreat
const SUPPRESS_DURATION = 2.0  // duración del estado suppress

export const AI_STATES = {
  ENGAGE: 'engage',
  FLANK: 'flank',
  TAKE_COVER: 'take_cover',
  SUPPRESS: 'suppress',
  RETREAT: 'retreat',
  ADVANCE: 'advance',
  RELOAD: 'reload',
  DEAD: 'dead'
}

export function createAIController(navmesh) {
  // Inicializa el estado IA de un enemigo recién spawneado.
  function init(e) {
    e.ai = {
      state: AI_STATES.ADVANCE,
      decisionTimer: 0,
      path: null,
      pathIdx: 0,
      repathTimer: 0,
      flankDir: Math.random() < 0.5 ? 1 : -1,
      coverPos: null,
      coverTimer: 0,
      suppressTimer: 0,
      reloadTimer: 0,
      stuckTime: 0,
      lastX: e.group.position.x,
      lastZ: e.group.position.z
    }
  }

  // Marca al bot como suprimido (recibió fuego cerca).
  function suppress(e) {
    if (!e.ai) return
    e.ai.suppressTimer = SUPPRESS_DURATION
    if (e.ai.state !== AI_STATES.TAKE_COVER && e.ai.state !== AI_STATES.DEAD) {
      e.ai.state = AI_STATES.SUPPRESS
    }
  }

  // Update: devuelve el waypoint objetivo o null si el bot no debe
  // moverse (estado TakeCover/Suppress/Reload/Dead). El caller
  // (enemies.js) decide cómo aplicar movimiento y disparo.
  function update(e, dt, playerPos) {
    if (!e.ai) init(e)
    const ai = e.ai
    if (e.dead) { ai.state = AI_STATES.DEAD; return null }

    ai.decisionTimer -= dt
    if (ai.decisionTimer <= 0) {
      ai.decisionTimer = DECISION_INTERVAL
      _evaluateState(e, ai, playerPos)
    }

    // Decaimiento de timers.
    if (ai.suppressTimer > 0) ai.suppressTimer -= dt
    if (ai.coverTimer > 0) ai.coverTimer -= dt
    if (ai.reloadTimer > 0) ai.reloadTimer -= dt

    return _computeTarget(e, ai, dt, playerPos)
  }

  function _evaluateState(e, ai, playerPos) {
    const dx = playerPos.x - e.group.position.x
    const dz = playerPos.z - e.group.position.z
    const dist = Math.hypot(dx, dz)
    const hpPct = e.hp / e.maxHp

    // Reload: si es shooter y no tiene "munición" (cooldown muy alto),
    // recarga. Simplificado: cada 5 disparos, 2s de reload.
    if (e.isRanged && e.shotsFired >= 5 && ai.reloadTimer <= 0) {
      ai.state = AI_STATES.RELOAD
      ai.reloadTimer = 2.0
      e.shotsFired = 0
      return
    }
    if (ai.state === AI_STATES.RELOAD && ai.reloadTimer > 0) return

    // Retreat: HP bajo y jugador cerca.
    if (hpPct < RETREAT_HP_PERCENT && dist < 15) {
      ai.state = AI_STATES.RETREAT
      return
    }

    // Suppressed: si el timer está activo, busca cobertura.
    if (ai.suppressTimer > 0) {
      const cover = _findCover(e, playerPos)
      if (cover) {
        ai.coverPos = cover
        ai.coverTimer = 1.5
        ai.state = AI_STATES.TAKE_COVER
        return
      }
      // Sin cobertura: queda en suppress (inmóvil, dispara).
      ai.state = AI_STATES.SUPPRESS
      return
    }

    // Ranged en rango: suppress (dispara sin avanzar).
    if (e.isRanged && dist > 8 && dist < 25 && ai.coverTimer <= 0) {
      // 50% suppress, 50% engage (variedad).
      if (Math.random() < 0.5) {
        ai.state = AI_STATES.SUPPRESS
        return
      }
    }

    // Flank: si está a media distancia y tiene línea de visión, flanquea.
    if (dist > FLANK_DISTANCE && dist < 30 && Math.random() < 0.3) {
      ai.state = AI_STATES.FLANK
      return
    }

    // Default: advance hacia el jugador por navmesh.
    ai.state = AI_STATES.ADVANCE
  }

  // Busca una cobertura cercana: raycast horizontal desde el bot en 8
  // direcciones; la primera que golpee un collider a <COVER_SEARCH_RADIUS
  // marca la cobertura (justo al lado del collider, lejos del jugador).
  const _coverDirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]
  ]
  function _findCover(e, playerPos) {
    const px = playerPos.x, pz = playerPos.z
    let best = null, bestScore = -Infinity
    for (const [dx, dz] of _coverDirs) {
      // Samplea a lo largo del rayo.
      for (let r = 1.5; r <= COVER_SEARCH_RADIUS; r += 1.5) {
        const x = e.group.position.x + dx * r
        const z = e.group.position.z + dz * r
        if (!navmesh || !navmesh._world) {
          // Sin navmesh: no hay coberturas.
          return null
        }
        if (navmesh._world.collidesAt(x, z, 0.4)) {
          // Hay un collider aquí: la cobertura está justo antes (r-1.5).
          const cx = e.group.position.x + dx * (r - 1.0)
          const cz = e.group.position.z + dz * (r - 1.0)
          // Score: cuanto más lejos del jugador y más cerca del bot, mejor.
          const distToPlayer = Math.hypot(cx - px, cz - pz)
          const distToBot = Math.hypot(cx - e.group.position.x, cz - e.group.position.z)
          const score = distToPlayer - distToBot * 0.3
          if (score > bestScore) {
            bestScore = score
            best = { x: cx, z: cz }
          }
          break // ya encontramos collider en esta dirección
        }
      }
    }
    return best
  }

  // Devuelve el waypoint objetivo según el estado.
  function _computeTarget(e, ai, dt, playerPos) {
    const px = playerPos.x, pz = playerPos.z

    switch (ai.state) {
      case AI_STATES.SUPPRESS:
      case AI_STATES.RELOAD:
      case AI_STATES.DEAD:
        return null // inmóvil

      case AI_STATES.TAKE_COVER: {
        if (ai.coverTimer <= 0 || !ai.coverPos) {
          ai.state = AI_STATES.ADVANCE
          return { x: px, z: pz }
        }
        return ai.coverPos
      }

      case AI_STATES.RETREAT: {
        // Alejarse del jugador.
        const dx = e.group.position.x - px
        const dz = e.group.position.z - pz
        const d = Math.hypot(dx, dz) || 1
        return { x: e.group.position.x + dx / d * 5, z: e.group.position.z + dz / d * 5 }
      }

      case AI_STATES.FLANK: {
        // Perpendicular al jugador, en dirección flankDir.
        const dx = px - e.group.position.x
        const dz = pz - e.group.position.z
        const d = Math.hypot(dx, dz) || 1
        // Vector perpendicular.
        const perpX = -dz / d * ai.flankDir
        const perpZ = dx / d * ai.flankDir
        // Avanza también un poco hacia el jugador.
        return {
          x: e.group.position.x + perpX * 4 + dx / d * 2,
          z: e.group.position.z + perpZ * 4 + dz / d * 2
        }
      }

      case AI_STATES.ADVANCE:
      default: {
        // Pathfinding por navmesh si está disponible; si no, directo.
        if (!navmesh) return { x: px, z: pz }
        ai.repathTimer -= dt
        if (ai.repathTimer <= 0 || !ai.path) {
          ai.repathTimer = 0.5
          ai.path = navmesh.findPath(e.group.position.x, e.group.position.z, px, pz)
          ai.pathIdx = 0
        }
        if (ai.path && ai.path.length > 0) {
          // Siguiente waypoint.
          while (ai.pathIdx < ai.path.length) {
            const wp = ai.path[ai.pathIdx]
            const d = Math.hypot(wp.x - e.group.position.x, wp.z - e.group.position.z)
            if (d > 0.8) return wp
            ai.pathIdx++
          }
        }
        return { x: px, z: pz }
      }
    }
  }

  function getState(e) { return e.ai ? e.ai.state : AI_STATES.ADVANCE }

  return { init, update, suppress, getState }
}
