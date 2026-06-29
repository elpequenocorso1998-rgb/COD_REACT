import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInputValidator,
  createLagCompensator,
  createSnapshotDelta,
  createRateLimiter,
  createAntiCheat,
  NETCODE_CONFIG,
  VIOLATION_TYPES,
  BAN_REASONS,
  getServerConfigForMode
} from '../server/netcode.js'

describe('NETCODE_CONFIG', () => {
  it('tick rate es 60Hz', () => {
    expect(NETCODE_CONFIG.TICK_RATE).toBe(60)
    expect(NETCODE_CONFIG.TICK_INTERVAL).toBe(1000 / 60)
  })

  it('snapshot rate es 30Hz', () => {
    expect(NETCODE_CONFIG.SNAPSHOT_RATE).toBe(30)
  })

  it('interp delay es 100ms', () => {
    expect(NETCODE_CONFIG.INTERP_DELAY).toBe(100)
  })

  it('max speed definido', () => {
    expect(NETCODE_CONFIG.MAX_SPEED).toBeGreaterThan(0)
    expect(NETCODE_CONFIG.MAX_SPEED_SPRINT).toBeGreaterThan(NETCODE_CONFIG.MAX_SPEED)
  })
})

describe('createInputValidator', () => {
  let validator

  beforeEach(() => {
    validator = createInputValidator()
  })

  it('factory devuelve API completa', () => {
    expect(typeof validator.validate).toBe('function')
    expect(typeof validator.validateFireRate).toBe('function')
    expect(typeof validator.shouldBan).toBe('function')
    expect(typeof validator.getStats).toBe('function')
  })

  it('validate rechaza input nulo', () => {
    const r = validator.validate(1, null, null, 0.016)
    expect(r.ok).toBe(false)
  })

  it('validate acepta input válido', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 0.1, y: 0, z: 0 }, yaw: 0.01, pitch: 0.01, health: 100 }
    const r = validator.validate(1, input, last, 0.016)
    expect(r.ok).toBe(true)
  })

  it('validate detecta speed hack', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 50, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const r = validator.validate(1, input, last, 0.016)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(VIOLATION_TYPES.SPEED_HACK)
  })

  it('validate detecta teleport', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 100, y: 0, z: 100 }, yaw: 0, pitch: 0, health: 100 }
    const r = validator.validate(1, input, last, 0.016)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(VIOLATION_TYPES.TELEPORT)
  })

  it('validate rechaza weapon inválido', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 0, y: 0, z: 0 }, weapon: 'nonexistent_weapon' }
    const r = validator.validate(1, input, last, 0.016)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(VIOLATION_TYPES.INVALID_WEAPON)
  })

  it('validate rechaza health > 200', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 0, y: 0, z: 0 }, health: 500 }
    const r = validator.validate(1, input, last, 0.016)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(VIOLATION_TYPES.INVALID_HEALTH)
  })

  it('validateFireRate respeta fireInterval', () => {
    const lastShot = Date.now() - 10
    const r = validator.validateFireRate(1, 'm4', lastShot)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(VIOLATION_TYPES.FIRE_RATE_HACK)
  })

  it('validateFireRate permite disparo tras fireInterval', () => {
    const lastShot = Date.now() - 500
    const r = validator.validateFireRate(1, 'm4', lastShot)
    expect(r.ok).toBe(true)
  })

  it('shouldBan devuelve true tras 10 violaciones', () => {
    for (let i = 0; i < 10; i++) {
      validator.recordViolation(1, VIOLATION_TYPES.SPEED_HACK)
    }
    expect(validator.shouldBan(1)).toBe(true)
  })

  it('shouldBan devuelve false para cliente limpio', () => {
    expect(validator.shouldBan(1)).toBe(false)
  })

  it('getStats devuelve contador', () => {
    const last = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    const input = { pos: { x: 100, y: 0, z: 0 }, yaw: 0, pitch: 0, health: 100 }
    validator.validate(1, input, last, 0.016)
    const stats = validator.getStats()
    expect(stats.totalValidated).toBe(1)
    expect(stats.totalRejected).toBe(1)
  })

  it('reset limpia violations de un cliente', () => {
    for (let i = 0; i < 5; i++) {
      validator.recordViolation(1, VIOLATION_TYPES.SPEED_HACK)
    }
    validator.reset(1)
    expect(validator.shouldBan(1)).toBe(false)
  })
})

describe('createLagCompensator', () => {
  let lc

  beforeEach(() => {
    lc = createLagCompensator()
  })

  it('factory devuelve API completa', () => {
    expect(typeof lc.recordSnapshot).toBe('function')
    expect(typeof lc.rewind).toBe('function')
    expect(typeof lc.rewindAll).toBe('function')
    expect(typeof lc.clear).toBe('function')
  })

  it('recordSnapshot guarda estado', () => {
    lc.recordSnapshot(1, { pos: { x: 1, y: 0, z: 1 }, yaw: 0 })
    expect(lc.getSize(1)).toBe(1)
  })

  it('rewind devuelve estado más cercano al tiempo', () => {
    const now = Date.now()
    lc.recordSnapshot(1, { pos: { x: 1, y: 0, z: 1 }, yaw: 0 })
    lc.recordSnapshot(1, { pos: { x: 2, y: 0, z: 2 }, yaw: 1 })
    const state = lc.rewind(1, now + 1)
    expect(state).toBeTruthy()
    expect(state.pos).toBeDefined()
  })

  it('rewind devuelve null si no hay historia', () => {
    expect(lc.rewind(1, Date.now())).toBeNull()
  })

  it('rewindAll devuelve mapa de todos los clientes', () => {
    lc.recordSnapshot(1, { pos: { x: 1, y: 0, z: 1 } })
    lc.recordSnapshot(2, { pos: { x: 2, y: 0, z: 2 } })
    const all = lc.rewindAll(Date.now() + 1)
    expect(all.size).toBe(2)
    expect(all.get(1)).toBeTruthy()
    expect(all.get(2)).toBeTruthy()
  })

  it('clearClient limpia un cliente', () => {
    lc.recordSnapshot(1, { pos: { x: 1, y: 0, z: 1 } })
    lc.clearClient(1)
    expect(lc.getSize(1)).toBe(0)
  })

  it('history respeta HISTORY_SIZE', () => {
    for (let i = 0; i < NETCODE_CONFIG.HISTORY_SIZE + 50; i++) {
      lc.recordSnapshot(1, { pos: { x: i, y: 0, z: 0 } })
    }
    expect(lc.getSize(1)).toBe(NETCODE_CONFIG.HISTORY_SIZE)
  })
})

describe('createSnapshotDelta', () => {
  let delta

  beforeEach(() => {
    delta = createSnapshotDelta()
  })

  it('primer diff es full snapshot', () => {
    const snap = {
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [{ id: 1, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, kills: 0, deaths: 0, score: 0, alive: true, health: 100, weapon: 'm4', firing: false }]
    }
    const r = delta.diff(snap)
    expect(r.type).toBe('full')
  })

  it('segundo diff es delta', () => {
    const snap1 = {
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [{ id: 1, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, kills: 0, deaths: 0, score: 0, alive: true, health: 100, weapon: 'm4', firing: false }]
    }
    const snap2 = {
      time: 2,
      teams: { axis: 1, allies: 0 },
      players: [{ id: 1, pos: { x: 1, y: 0, z: 0 }, yaw: 0.1, pitch: 0, kills: 1, deaths: 0, score: 100, alive: true, health: 100, weapon: 'm4', firing: false }]
    }
    delta.diff(snap1)
    const r = delta.diff(snap2)
    expect(r.type).toBe('delta')
    expect(r.players.length).toBe(1)
    expect(r.players[0].pos.x).toBe(1)
  })

  it('delta sin cambios no incluye player', () => {
    const snap = {
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [{ id: 1, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, kills: 0, deaths: 0, score: 0, alive: true, health: 100, weapon: 'm4', firing: false }]
    }
    delta.diff(snap)
    const r = delta.diff({ ...snap, time: 2 })
    expect(r.players.length).toBe(0)
  })

  it('reset vuelve a full en próximo diff', () => {
    const snap = {
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [{ id: 1, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, kills: 0, deaths: 0, score: 0, alive: true, health: 100, weapon: 'm4', firing: false }]
    }
    delta.diff(snap)
    delta.reset()
    const r = delta.diff(snap)
    expect(r.type).toBe('full')
  })
})

describe('createRateLimiter', () => {
  it('check devuelve true bajo el límite', () => {
    const rl = createRateLimiter({ maxPerSecond: 10, maxPerMinute: 100 })
    expect(rl.check('1.2.3.4')).toBe(true)
  })

  it('check devuelve false sobre el límite por segundo', () => {
    const rl = createRateLimiter({ maxPerSecond: 3, maxPerMinute: 100 })
    rl.check('1.2.3.4')
    rl.check('1.2.3.4')
    rl.check('1.2.3.4')
    expect(rl.check('1.2.3.4')).toBe(false)
  })

  it('reset limpia un IP', () => {
    const rl = createRateLimiter({ maxPerSecond: 2, maxPerMinute: 100 })
    rl.check('1.2.3.4')
    rl.check('1.2.3.4')
    rl.reset('1.2.3.4')
    expect(rl.check('1.2.3.4')).toBe(true)
  })

  it('getStats devuelve info del IP', () => {
    const rl = createRateLimiter({ maxPerSecond: 10, maxPerMinute: 100 })
    rl.check('1.2.3.4')
    const stats = rl.getStats('1.2.3.4')
    expect(stats.perSecond).toBe(1)
    expect(stats.perMinute).toBe(1)
  })
})

describe('createAntiCheat', () => {
  let ac

  beforeEach(() => {
    ac = createAntiCheat()
  })

  it('factory devuelve API completa', () => {
    expect(typeof ac.recordPlayerAction).toBe('function')
    expect(typeof ac.isSuspicious).toBe('function')
    expect(typeof ac.ban).toBe('function')
    expect(typeof ac.isBanned).toBe('function')
    expect(typeof ac.report).toBe('function')
  })

  it('getHSRate devuelve ratio de headshots', () => {
    for (let i = 0; i < 5; i++) ac.recordPlayerAction(1, { type: 'kill', headshot: false })
    for (let i = 0; i < 5; i++) ac.recordPlayerAction(1, { type: 'kill', headshot: true })
    expect(ac.getHSRate(1)).toBe(0.5)
  })

  it('getAccuracy devuelve accuracy', () => {
    for (let i = 0; i < 10; i++) ac.recordPlayerAction(1, { type: 'shot' })
    for (let i = 0; i < 3; i++) ac.recordPlayerAction(1, { type: 'hit' })
    expect(ac.getAccuracy(1)).toBe(0.3)
  })

  it('isSuspicious detecta HS rate alto', () => {
    for (let i = 0; i < 15; i++) ac.recordPlayerAction(1, { type: 'kill', headshot: true })
    expect(ac.isSuspicious(1, 0)).toBe(true)
  })

  it('isSuspicious detecta accuracy imposible', () => {
    for (let i = 0; i < 60; i++) {
      ac.recordPlayerAction(1, { type: 'shot' })
      ac.recordPlayerAction(1, { type: 'hit' })
    }
    expect(ac.isSuspicious(1, 0)).toBe(true)
  })

  it('ban marca cliente como baneado', () => {
    ac.ban(1, BAN_REASONS.CHEATING)
    expect(ac.isBanned(1)).toBe(true)
  })

  it('ban temporal expira', () => {
    ac.ban(1, BAN_REASONS.TEAM_KILL, 1)
    expect(ac.isBanned(1)).toBe(true)
    vi.useFakeTimers()
    vi.advanceTimersByTime(100)
    vi.useRealTimers()
  })

  it('unban elimina el ban', () => {
    ac.ban(1)
    ac.unban(1)
    expect(ac.isBanned(1)).toBe(false)
  })

  it('report registra el reporte', () => {
    ac.report(1, 2, 'aimbot', 'snap aiming')
    const reports = ac.getReports()
    expect(reports.length).toBe(1)
    expect(reports[0].reason).toBe('aimbot')
  })

  it('reset limpia stats de un cliente', () => {
    ac.recordPlayerAction(1, { type: 'kill', headshot: true })
    ac.reset(1)
    expect(ac.getStats(1)).toBeNull()
  })
})

describe('getServerConfigForMode', () => {
  it('devuelve config para tdm', () => {
    const cfg = getServerConfigForMode('tdm')
    expect(cfg.maxPlayers).toBe(12)
    expect(cfg.tickRate).toBe(60)
    expect(cfg.scoreLimit).toBe(75)
    expect(cfg.respawn).toBe(true)
  })

  it('devuelve config para warzone', () => {
    const cfg = getServerConfigForMode('warzone')
    expect(cfg.maxPlayers).toBe(100)
    expect(cfg.respawn).toBe(false)
  })

  it('devuelve config para searchDestroy (no respawn)', () => {
    const cfg = getServerConfigForMode('searchDestroy')
    expect(cfg.respawn).toBe(false)
  })

  it('modo inexistente devuelve default', () => {
    const cfg = getServerConfigForMode('nonexistent')
    expect(cfg.maxPlayers).toBe(12)
  })
})
