import { WebSocketServer } from 'ws'
import {
  createInputValidator,
  createLagCompensator,
  createSnapshotDelta,
  createRateLimiter,
  createAntiCheat,
  NETCODE_CONFIG,
  BAN_REASONS
} from './netcode.js'
import { getMaxPlayers, getGameMode } from '../src/game/modes/index.js'

/* =========================================================================
   Servidor de juego autoritativo (Fase 2 + Fase 18.8).
   --------------------------------------------------------------------------
   Mantiene el estado de todos los jugadores conectados y lo broadcastea
   a SNAPSHOT_RATE (30Hz). Recibe inputs de los clientes a INPUT_RATE (120Hz).

   Modelo (Fase 18.8 — netcode AAA cableado):
   - Inputs validados por createInputValidator (speed/teleport/aimbot/
     fire rate/health/weapon).
   - Lag compensation: createLagCompensator guarda historial de estados
     por cliente; al validar una kill se hace rewind al tick del cliente
     ("favor the shooter").
   - Snapshot delta: createSnapshotDelta envía solo los cambios (full
     snapshot la primera vez o tras reset).
   - Rate limiting por IP: createRateLimiter (60/s, 3000/min).
   - Heurísticas anti-cheat: createAntiCheat (HS rate, accuracy, K/D,
     tracking speed). Bans automáticos a clientes sospechosos.

   Modo: TDM (Team Deathmatch) — 2 equipos, 75 kills gana.
   ========================================================================= */

const PORT = process.env.MW_PORT || 9433
const TICK_RATE = NETCODE_CONFIG.TICK_RATE
const TICK_INTERVAL = NETCODE_CONFIG.TICK_INTERVAL
const SNAPSHOT_INTERVAL = NETCODE_CONFIG.SNAPSHOT_INTERVAL
const MAX_PLAYERS_DEFAULT = 12
const SCORE_LIMIT_DEFAULT = 75
const MAX_PLAYERS = parseInt(process.env.MW_MAX_PLAYERS, 10) || MAX_PLAYERS_DEFAULT
const SCORE_LIMIT = parseInt(process.env.MW_SCORE_LIMIT, 10) || SCORE_LIMIT_DEFAULT
const MODE = process.env.MW_MODE || 'tdm'
const RATE_LIMIT_PER_SECOND = 120
const RATE_LIMIT_PER_MINUTE = 6000

const wss = new WebSocketServer({ port: PORT })

const validator = createInputValidator()
const lagComp = createLagCompensator()
const snapshotDelta = createSnapshotDelta()
const rateLimiter = createRateLimiter({
  maxPerSecond: RATE_LIMIT_PER_SECOND,
  maxPerMinute: RATE_LIMIT_PER_MINUTE
})
const antiCheat = createAntiCheat()

const players = new Map()
const lastInputState = new Map()
const lastShotTime = new Map()
let nextId = 1
const teams = { axis: 0, allies: 0 }
let matchTime = 0
let matchOver = false

function assignTeam() {
  let axisCount = 0, alliesCount = 0
  for (const p of players.values()) {
    if (p.team === 'axis') axisCount++
    else if (p.team === 'allies') alliesCount++
  }
  return axisCount <= alliesCount ? 'axis' : 'allies'
}

const AXIS_SPAWNS = [
  { x: -40, y: 1.7, z: -40 },
  { x: -35, y: 1.7, z: -45 },
  { x: -45, y: 1.7, z: -35 },
  { x: -38, y: 1.7, z: -50 },
  { x: -50, y: 1.7, z: -38 },
  { x: -42, y: 1.7, z: -42 },
  { x: -33, y: 1.7, z: -33 },
  { x: -47, y: 1.7, z: -47 }
]
const ALLIES_SPAWNS = [
  { x: 40, y: 1.7, z: 40 },
  { x: 35, y: 1.7, z: 45 },
  { x: 45, y: 1.7, z: 35 },
  { x: 38, y: 1.7, z: 50 },
  { x: 50, y: 1.7, z: 38 },
  { x: 42, y: 1.7, z: 42 },
  { x: 33, y: 1.7, z: 33 },
  { x: 47, y: 1.7, z: 47 }
]

function spawnPoint(team) {
  const spawns = team === 'axis' ? AXIS_SPAWNS : ALLIES_SPAWNS
  return spawns[Math.floor(Math.random() * spawns.length)]
}

function ipFromReq(req) {
  const fwd = req.headers && req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return (req.socket && req.socket.remoteAddress) || 'unknown'
}

function snapshotPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    pos: p.pos,
    yaw: p.yaw,
    pitch: p.pitch,
    weapon: p.weapon,
    firing: p.firing,
    alive: p.alive,
    health: p.health,
    kills: p.kills,
    deaths: p.deaths,
    score: p.score
  }
}

wss.on('connection', (ws, req) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', message: 'Server full' }))
    ws.close()
    return
  }

  const ip = ipFromReq(req)
  if (antiCheat.isBanned(ip)) {
    ws.send(JSON.stringify({ type: 'error', message: 'You are banned' }))
    ws.close()
    return
  }

  const clientId = nextId++
  const team = assignTeam()
  const spawn = spawnPoint(team)
  const player = {
    id: clientId,
    name: `Player${clientId}`,
    team,
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    yaw: 0,
    pitch: 0,
    weapon: 'm4',
    firing: false,
    alive: true,
    health: 100,
    kills: 0,
    deaths: 0,
    score: 0,
    ip,
    ws
  }
  players.set(clientId, player)
  lastInputState.set(clientId, {
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    yaw: 0,
    pitch: 0,
    health: 100
  })

  console.log(`[server] Player ${clientId} connected (${team}) ip=${ip}. Total: ${players.size}`)

  ws.send(JSON.stringify({
    type: 'init',
    clientId,
    team,
    spawn,
    scoreLimit: SCORE_LIMIT,
    teams: { axis: teams.axis, allies: teams.allies },
    tickRate: TICK_RATE,
    snapshotRate: NETCODE_CONFIG.SNAPSHOT_RATE,
    interpDelay: NETCODE_CONFIG.INTERP_DELAY
  }))

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch (e) { return }

    if (!rateLimiter.check(ip)) {
      validator.recordViolation(clientId, 'rate_limit')
      return
    }
    handleMsg(clientId, msg)
  })

  ws.on('close', () => {
    players.delete(clientId)
    lastInputState.delete(clientId)
    lastShotTime.delete(clientId)
    lagComp.clearClient(clientId)
    validator.reset(clientId)
    antiCheat.reset(clientId)
    console.log(`[server] Player ${clientId} disconnected. Total: ${players.size}`)
    broadcast({ type: 'playerLeft', id: clientId })
  })
})

function handleMsg(clientId, msg) {
  const p = players.get(clientId)
  if (!p) return
  switch (msg.type) {
    case 'input': {
      if (!msg.input) return
      const last = lastInputState.get(clientId)
      const dt = TICK_INTERVAL / 1000
      const v = validator.validate(clientId, msg.input, last, dt)
      if (!v.ok) {
        if (validator.shouldBan(clientId)) {
          antiCheat.ban(p.ip, BAN_REASONS.CHEATING, 3600 * 1000)
          p.ws.send(JSON.stringify({ type: 'error', message: 'Banned for cheating' }))
          p.ws.close()
          return
        }
        return
      }
      p.pos = msg.input.pos || p.pos
      p.yaw = msg.input.yaw ?? p.yaw
      p.pitch = msg.input.pitch ?? p.pitch
      p.weapon = msg.input.weapon || p.weapon
      p.firing = !!msg.input.firing
      p.alive = msg.input.alive !== undefined ? msg.input.alive : p.alive
      if (typeof msg.input.health === 'number') {
        p.health = msg.input.health
      }
      lastInputState.set(clientId, {
        pos: { ...p.pos },
        yaw: p.yaw,
        pitch: p.pitch,
        health: p.health
      })
      lagComp.recordSnapshot(clientId, snapshotPlayer(p))
      break
    }
    case 'kill': {
      const victim = players.get(msg.victim)
      const killer = players.get(msg.killer)
      if (!victim || !killer) return
      if (killer.id !== clientId) return
      if (!victim.alive) return

      const shotTime = msg.t || Date.now()
      const fireCheck = validator.validateFireRate(clientId, killer.weapon, lastShotTime.get(clientId))
      if (!fireCheck.ok) {
        if (validator.shouldBan(clientId)) {
          antiCheat.ban(p.ip, BAN_REASONS.CHEATING, 3600 * 1000)
          p.ws.close()
        }
        return
      }
      lastShotTime.set(clientId, shotTime)

      const rewindState = lagComp.rewind(victim.id, shotTime)
      if (!rewindState || !rewindState.alive) return

      victim.alive = false
      victim.health = 0
      victim.deaths++
      killer.kills++
      killer.score += 100
      teams[killer.team]++
      antiCheat.recordPlayerAction(killer.id, { type: 'kill', headshot: !!msg.headshot })

      broadcast({
        type: 'kill',
        killer: killer.id,
        killerName: killer.name,
        victim: victim.id,
        victimName: victim.name,
        weapon: msg.weapon || 'm4',
        headshot: !!msg.headshot
      })

      setTimeout(() => {
        if (players.has(victim.id)) {
          const spawn = spawnPoint(victim.team)
          victim.pos = { x: spawn.x, y: spawn.y, z: spawn.z }
          victim.alive = true
          victim.health = 100
          broadcast({ type: 'respawn', id: victim.id, pos: spawn })
        }
      }, 3000)

      if (teams[killer.team] >= SCORE_LIMIT) {
        matchOver = true
        broadcast({ type: 'matchOver', winner: killer.team, teams: { ...teams } })
      }
      break
    }
    case 'name':
      if (msg.name && typeof msg.name === 'string' && msg.name.length <= 16) {
        p.name = msg.name
      }
      break
    case 'shot':
      if (msg.weapon) {
        const t = msg.t || Date.now()
        const fr = validator.validateFireRate(clientId, msg.weapon, lastShotTime.get(clientId))
        if (fr.ok) {
          lastShotTime.set(clientId, t)
          antiCheat.recordPlayerAction(clientId, { type: 'shot' })
        }
      }
      break
    case 'hit':
      antiCheat.recordPlayerAction(clientId, { type: 'hit' })
      break
  }
}

function broadcast(msg) {
  const data = JSON.stringify(msg)
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(data)
  }
}

function buildSnapshot() {
  return {
    time: matchTime,
    teams: { axis: teams.axis, allies: teams.allies },
    players: Array.from(players.values()).map(snapshotPlayer)
  }
}

setInterval(() => {
  if (matchOver) return
  matchTime += SNAPSHOT_INTERVAL / 1000
  const snap = buildSnapshot()
  const delta = snapshotDelta.diff(snap)
  if (delta.type === 'full') {
    broadcast({ type: 'snapshot', ...delta.snapshot })
  } else {
    broadcast({
      type: 'snapshotDelta',
      time: delta.time,
      teams: delta.teams,
      players: delta.players,
      removed: delta.removed || []
    })
  }
}, SNAPSHOT_INTERVAL)

setInterval(() => {
  for (const p of players.values()) {
    if (antiCheat.isSuspicious(p.id, p.deaths) && !antiCheat.isBanned(p.ip)) {
      console.warn(`[server] Player ${p.id} flagged as suspicious`)
      antiCheat.ban(p.ip, BAN_REASONS.CHEATING, 3600 * 1000)
      try {
        p.ws.send(JSON.stringify({ type: 'error', message: 'Banned: suspicious activity' }))
        p.ws.close()
      } catch (e) { /* ignore */ }
    }
  }
}, 10000)

const modeInfo = getGameMode(MODE)
console.log(`[server] Modern Warfare server listening on :${PORT}`)
console.log(`[server] mode=${MODE} tick=${TICK_RATE}Hz snap=${NETCODE_CONFIG.SNAPSHOT_RATE}Hz max=${MAX_PLAYERS} scoreLimit=${SCORE_LIMIT}`)
console.log(`[server] antiCheat+suspiciousScan enabled, rateLimit=${RATE_LIMIT_PER_SECOND}/s ${RATE_LIMIT_PER_MINUTE}/min`)
