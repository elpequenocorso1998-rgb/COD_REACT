/* =========================================================================
   Netcode AAA: validación server-side + lag compensation.
   --------------------------------------------------------------------------
   - Valida inputs imposibles (velocidad, fire rate, FOV, noclip).
   - Lag compensation: rewind del estado del servidor al tick del cliente
     al validar hits ("favor the shooter").
   - Snapshot delta compression (solo cambios).
   - Rate limiting por IP.
   - Heurísticas anti-cheat (HS rate, K/D, tracking speed).
   ========================================================================= */

import { WEAPONS } from '../src/game/core/config.js'
import { getMaxPlayers, getGameMode } from '../src/game/modes/index.js'

export const NETCODE_CONFIG = {
  TICK_RATE: 60,
  TICK_INTERVAL: 1000 / 60,
  SNAPSHOT_RATE: 30,
  SNAPSHOT_INTERVAL: 1000 / 30,
  INPUT_RATE: 120,
  INPUT_INTERVAL: 1000 / 120,
  INTERP_DELAY: 100,
  MAX_SPEED: 12,
  MAX_SPEED_SPRINT: 14,
  MAX_SPEED_SPRINT_TACTICAL: 16,
  MAX_PITCH: Math.PI / 2 - 0.05,
  MAX_YAW_DELTA_PER_TICK: 0.5,
  MAX_INPUTS_PER_SECOND: 200,
  HISTORY_SIZE: 200,
  BAN_THRESHOLD: 0.85
}

export const VIOLATION_TYPES = {
  SPEED_HACK: 'speed_hack',
  FIRE_RATE_HACK: 'fire_rate_hack',
  NOCLIP: 'noclip',
  AIMBOT: 'aimbot',
  WALLHACK: 'wallhack',
  TELEPORT: 'teleport',
  INVALID_HEALTH: 'invalid_health',
  INVALID_WEAPON: 'invalid_weapon',
  RATE_LIMIT: 'rate_limit'
}

export const BAN_REASONS = {
  CHEATING: 'cheating',
  VOTE_KICK: 'vote_kick',
  TEAM_KILL: 'team_kill',
  TOXICITY: 'toxicity',
  HARDWARE: 'hardware'
}

export function createInputValidator() {
  const lastInputs = new Map()
  const violations = new Map()
  const stats = {
    totalValidated: 0,
    totalRejected: 0,
    violationsByType: {}
  }

  function validate(clientId, input, lastState, dt) {
    stats.totalValidated++
    if (!input) return { ok: false, reason: 'no_input' }

    const last = lastState || { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const now = Date.now()
    const lastInputTime = lastInputs.get(clientId) || 0
    const elapsed = now - lastInputTime
    if (elapsed < 1000 / NETCODE_CONFIG.INPUT_RATE - 1) {
      return { ok: false, reason: 'too_fast' }
    }
    lastInputs.set(clientId, now)

    if (input.pos && last.pos) {
      const dx = input.pos.x - last.pos.x
      const dz = input.pos.z - last.pos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const maxTeleport = 50
      if (dist > maxTeleport) {
        recordViolation(clientId, VIOLATION_TYPES.TELEPORT)
        return { ok: false, reason: VIOLATION_TYPES.TELEPORT, dist }
      }
      const maxDist = NETCODE_CONFIG.MAX_SPEED_SPRINT_TACTICAL * Math.max(dt, 0.016) * 1.15
      if (dist > maxDist) {
        recordViolation(clientId, VIOLATION_TYPES.SPEED_HACK)
        return { ok: false, reason: VIOLATION_TYPES.SPEED_HACK, dist, maxDist }
      }
    }

    if (input.pitch !== undefined) {
      if (Math.abs(input.pitch) > NETCODE_CONFIG.MAX_PITCH) {
        recordViolation(clientId, VIOLATION_TYPES.NOCLIP)
        return { ok: false, reason: 'invalid_pitch' }
      }
    }

    if (input.yaw !== undefined && last.yaw !== undefined) {
      const yawDelta = Math.abs(normalizeAngle(input.yaw - last.yaw))
      if (yawDelta > NETCODE_CONFIG.MAX_YAW_DELTA_PER_TICK * 3) {
        recordViolation(clientId, VIOLATION_TYPES.AIMBOT)
      }
    }

    if (input.health !== undefined && input.health > 200) {
      recordViolation(clientId, VIOLATION_TYPES.INVALID_HEALTH)
      return { ok: false, reason: VIOLATION_TYPES.INVALID_HEALTH }
    }

    if (input.weapon && !WEAPONS[input.weapon]) {
      recordViolation(clientId, VIOLATION_TYPES.INVALID_WEAPON)
      return { ok: false, reason: VIOLATION_TYPES.INVALID_WEAPON }
    }

    return { ok: true }
  }

  function validateFireRate(clientId, weaponId, lastShotTime) {
    const weapon = WEAPONS[weaponId]
    if (!weapon) return { ok: false, reason: 'invalid_weapon' }
    const minInterval = weapon.fireInterval * 1000 * 0.85
    const now = Date.now()
    if (lastShotTime && (now - lastShotTime) < minInterval) {
      recordViolation(clientId, VIOLATION_TYPES.FIRE_RATE_HACK)
      return { ok: false, reason: VIOLATION_TYPES.FIRE_RATE_HACK }
    }
    return { ok: true }
  }

  function recordViolation(clientId, type) {
    stats.totalRejected++
    stats.violationsByType[type] = (stats.violationsByType[type] || 0) + 1
    if (!violations.has(clientId)) {
      violations.set(clientId, { count: 0, types: {}, lastViolation: 0 })
    }
    const v = violations.get(clientId)
    v.count++
    v.types[type] = (v.types[type] || 0) + 1
    v.lastViolation = Date.now()
  }

  function getViolations(clientId) {
    return violations.get(clientId) || { count: 0, types: {} }
  }

  function shouldBan(clientId) {
    const v = violations.get(clientId)
    if (!v) return false
    if (v.count >= 10) return true
    if (v.types[VIOLATION_TYPES.SPEED_HACK] >= 5) return true
    if (v.types[VIOLATION_TYPES.TELEPORT] >= 3) return true
    if (v.types[VIOLATION_TYPES.AIMBOT] >= 8) return true
    return false
  }

  function reset(clientId) {
    violations.delete(clientId)
    lastInputs.delete(clientId)
  }

  function getStats() {
    return { ...stats, activeClients: violations.size }
  }

  return {
    validate,
    validateFireRate,
    recordViolation,
    getViolations,
    shouldBan,
    reset,
    getStats
  }
}

export function createLagCompensator() {
  const history = new Map()

  function recordSnapshot(clientId, state) {
    if (!history.has(clientId)) {
      history.set(clientId, [])
    }
    const buf = history.get(clientId)
    buf.push({ time: Date.now(), state: { ...state } })
    if (buf.length > NETCODE_CONFIG.HISTORY_SIZE) {
      buf.shift()
    }
  }

  function rewind(clientId, targetTime) {
    const buf = history.get(clientId)
    if (!buf || buf.length === 0) return null
    let closest = buf[0]
    let minDiff = Math.abs(closest.time - targetTime)
    for (let i = 1; i < buf.length; i++) {
      const diff = Math.abs(buf[i].time - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closest = buf[i]
      }
    }
    return closest.state
  }

  function rewindAll(targetTime) {
    const result = new Map()
    for (const [clientId, buf] of history.entries()) {
      const state = rewind(clientId, targetTime)
      if (state) result.set(clientId, state)
    }
    return result
  }

  function clearClient(clientId) {
    history.delete(clientId)
  }

  function clear() {
    history.clear()
  }

  function getSize(clientId) {
    return history.get(clientId)?.length || 0
  }

  return { recordSnapshot, rewind, rewindAll, clearClient, clear, getSize }
}

export function createSnapshotDelta() {
  let lastSnapshot = null

  function diff(currentSnapshot) {
    if (!lastSnapshot) {
      lastSnapshot = JSON.parse(JSON.stringify(currentSnapshot))
      return { type: 'full', snapshot: currentSnapshot }
    }
    const delta = {
      type: 'delta',
      time: currentSnapshot.time,
      teams: currentSnapshot.teams,
      players: []
    }
    const lastById = new Map()
    for (const p of lastSnapshot.players) {
      lastById.set(p.id, p)
    }
    for (const p of currentSnapshot.players) {
      const last = lastById.get(p.id)
      if (!last) {
        delta.players.push(p)
        continue
      }
      const playerDelta = { id: p.id }
      let changed = false
      if (p.pos.x !== last.pos.x || p.pos.y !== last.pos.y || p.pos.z !== last.pos.z) {
        playerDelta.pos = p.pos
        changed = true
      }
      if (p.yaw !== last.yaw) { playerDelta.yaw = p.yaw; changed = true }
      if (p.pitch !== last.pitch) { playerDelta.pitch = p.pitch; changed = true }
      if (p.weapon !== last.weapon) { playerDelta.weapon = p.weapon; changed = true }
      if (p.firing !== last.firing) { playerDelta.firing = p.firing; changed = true }
      if (p.alive !== last.alive) { playerDelta.alive = p.alive; changed = true }
      if (p.health !== last.health) { playerDelta.health = p.health; changed = true }
      if (p.kills !== last.kills) { playerDelta.kills = p.kills; changed = true }
      if (p.deaths !== last.deaths) { playerDelta.deaths = p.deaths; changed = true }
      if (p.score !== last.score) { playerDelta.score = p.score; changed = true }
      if (changed) delta.players.push(playerDelta)
    }
    const currentIds = new Set(currentSnapshot.players.map((p) => p.id))
    const removed = lastSnapshot.players.filter((p) => !currentIds.has(p.id))
    if (removed.length > 0) delta.removed = removed.map((p) => p.id)
    lastSnapshot = JSON.parse(JSON.stringify(currentSnapshot))
    return delta
  }

  function reset() {
    lastSnapshot = null
  }

  return { diff, reset }
}

export function createRateLimiter({ maxPerSecond = 60, maxPerMinute = 3000 } = {}) {
  const buckets = new Map()

  function check(ip) {
    const now = Date.now()
    if (!buckets.has(ip)) {
      buckets.set(ip, { second: [], minute: [] })
    }
    const b = buckets.get(ip)
    b.second = b.second.filter((t) => now - t < 1000)
    b.minute = b.minute.filter((t) => now - t < 60000)
    if (b.second.length >= maxPerSecond) return false
    if (b.minute.length >= maxPerMinute) return false
    b.second.push(now)
    b.minute.push(now)
    return true
  }

  function reset(ip) {
    if (ip) buckets.delete(ip)
    else buckets.clear()
  }

  function getStats(ip) {
    if (!ip) return { tracked: buckets.size }
    const b = buckets.get(ip)
    if (!b) return null
    return { perSecond: b.second.length, perMinute: b.minute.length }
  }

  return { check, reset, getStats }
}

export function createAntiCheat() {
  const playerStats = new Map()
  const bans = new Map()
  const reports = []

  function recordPlayerAction(clientId, action) {
    if (!playerStats.has(clientId)) {
      playerStats.set(clientId, {
        kills: 0,
        headshots: 0,
        shots: 0,
        hits: 0,
        maxTrackingSpeed: 0,
        suspiciousActions: 0,
        lastAction: 0
      })
    }
    const s = playerStats.get(clientId)
    if (action.type === 'kill') {
      s.kills++
      if (action.headshot) s.headshots++
    }
    if (action.type === 'shot') s.shots++
    if (action.type === 'hit') s.hits++
    if (action.type === 'tracking') {
      s.maxTrackingSpeed = Math.max(s.maxTrackingSpeed, action.speed)
      if (action.speed > 15) s.suspiciousActions++
    }
    s.lastAction = Date.now()
  }

  function getHSRate(clientId) {
    const s = playerStats.get(clientId)
    if (!s || s.kills === 0) return 0
    return s.headshots / s.kills
  }

  function getAccuracy(clientId) {
    const s = playerStats.get(clientId)
    if (!s || s.shots === 0) return 0
    return s.hits / s.shots
  }

  function getKDRatio(clientId, deaths) {
    const s = playerStats.get(clientId)
    if (!s || deaths === 0) return s ? s.kills : 0
    return s.kills / deaths
  }

  function isSuspicious(clientId, deaths = 0) {
    const hsRate = getHSRate(clientId)
    const accuracy = getAccuracy(clientId)
    const kd = getKDRatio(clientId, deaths)
    const s = playerStats.get(clientId)
    if (!s) return false
    if (hsRate > 0.85 && s.kills > 10) return true
    if (accuracy > 0.95 && s.shots > 50) return true
    if (kd > 25 && s.kills > 15) return true
    if (s.maxTrackingSpeed > 20) return true
    if (s.suspiciousActions > 5) return true
    return false
  }

  function ban(clientId, reason = BAN_REASONS.CHEATING, duration = 0) {
    const ban = {
      clientId,
      reason,
      bannedAt: Date.now(),
      duration,
      expires: duration > 0 ? Date.now() + duration : 0
    }
    bans.set(clientId, ban)
    return ban
  }

  function isBanned(clientId) {
    const ban = bans.get(clientId)
    if (!ban) return false
    if (ban.duration === 0) return true
    if (Date.now() > ban.expires) {
      bans.delete(clientId)
      return false
    }
    return true
  }

  function unban(clientId) {
    bans.delete(clientId)
  }

  function report(clientId, reportedBy, reason, description = '') {
    reports.push({
      clientId,
      reportedBy,
      reason,
      description,
      timestamp: Date.now()
    })
  }

  function getReports() {
    return [...reports]
  }

  function getStats(clientId) {
    return playerStats.get(clientId) || null
  }

  function reset(clientId) {
    if (clientId) playerStats.delete(clientId)
    else playerStats.clear()
  }

  return {
    recordPlayerAction,
    getHSRate,
    getAccuracy,
    getKDRatio,
    isSuspicious,
    ban,
    isBanned,
    unban,
    report,
    getReports,
    getStats,
    reset
  }
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export function getServerConfigForMode(modeId) {
  const mode = getGameMode(modeId)
  if (!mode) return { maxPlayers: 12, tickRate: NETCODE_CONFIG.TICK_RATE }
  return {
    maxPlayers: getMaxPlayers(modeId),
    tickRate: NETCODE_CONFIG.TICK_RATE,
    snapshotRate: NETCODE_CONFIG.SNAPSHOT_RATE,
    scoreLimit: mode.scoreLimit,
    respawn: mode.respawn,
    respawnDelay: mode.respawnDelay
  }
}
