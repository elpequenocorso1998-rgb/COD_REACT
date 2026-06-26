import { WebSocketServer } from 'ws'

/* =========================================================================
   Servidor de juego autoritativo (Fase 2).
   --------------------------------------------------------------------------
   Mantiene el estado de todos los jugadores conectados y lo broadcastea
   a 20Hz (snapshots). Recibe inputs de los clientes a 60Hz.

   Modelo:
   - Cada cliente envía { type: 'input', input: { pos, yaw, pitch, firing,
     weapon, alive, health } } cada frame.
   - El servidor NO valida los inputs (trusted client de momento; en Fase 2.5
     añadiremos anti-cheat). Solo los retransmite a los demás.
   - Cada 50ms (20Hz) broadcastea un snapshot con el estado de todos.
   - Los kills se registran via { type: 'kill', killer, victim } y el
     servidor lleva el scoreboard.

   Modo: TDM (Team Deathmatch) — 2 equipos, 75 kills gana.
   ========================================================================= */

const PORT = process.env.MW_PORT || 9433
const TICK_RATE = 20
const TICK_INTERVAL = 1000 / TICK_RATE
const MAX_PLAYERS = 12
const SCORE_LIMIT = 75

const wss = new WebSocketServer({ port: PORT })

// Estado del juego en el servidor.
const players = new Map() // clientId -> playerState
let nextId = 1
const teams = { axis: 0, allies: 0 } // kills por equipo
let matchTime = 0
let matchOver = false

function assignTeam() {
  // Equilibra equipos: asigna al equipo con menos jugadores.
  let axisCount = 0, alliesCount = 0
  for (const p of players.values()) {
    if (p.team === 'axis') axisCount++
    else if (p.team === 'allies') alliesCount++
  }
  return axisCount <= alliesCount ? 'axis' : 'allies'
}

function spawnPoint(team) {
  // Spawns separados por equipo.
  if (team === 'axis') return { x: -40, y: 1.7, z: -40 }
  return { x: 40, y: 1.7, z: 40 }
}

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', message: 'Server full' }))
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
    ws
  }
  players.set(clientId, player)

  console.log(`[server] Player ${clientId} connected (${team}). Total: ${players.size}`)

  // Envia init al cliente recién conectado.
  ws.send(JSON.stringify({
    type: 'init',
    clientId,
    team,
    spawn,
    scoreLimit: SCORE_LIMIT,
    teams: { axis: teams.axis, allies: teams.allies }
  }))

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch (e) { return }
    handleMsg(clientId, msg)
  })

  ws.on('close', () => {
    players.delete(clientId)
    console.log(`[server] Player ${clientId} disconnected. Total: ${players.size}`)
    broadcast({ type: 'playerLeft', id: clientId })
  })
})

function handleMsg(clientId, msg) {
  const p = players.get(clientId)
  if (!p) return
  switch (msg.type) {
    case 'input':
      // El cliente envía su estado predicho. El servidor confía (Fase 2.5:
      // validación real). Actualizamos el estado del jugador.
      if (msg.input) {
        p.pos = msg.input.pos || p.pos
        p.yaw = msg.input.yaw ?? p.yaw
        p.pitch = msg.input.pitch ?? p.pitch
        p.weapon = msg.input.weapon || p.weapon
        p.firing = !!msg.input.firing
        p.alive = msg.input.alive !== undefined ? msg.input.alive : p.alive
        p.health = msg.input.health ?? p.health
      }
      break
    case 'kill':
      // Un cliente reporta una kill. El servidor valida mínimamente
      // (que víctima exista y esté viva).
      {
        const victim = players.get(msg.victim)
        const killer = players.get(msg.killer)
        if (victim && killer && victim.alive) {
          victim.alive = false
          victim.health = 0
          victim.deaths++
          killer.kills++
          killer.score += 100
          teams[killer.team]++
          broadcast({
            type: 'kill',
            killer: killer.id,
            killerName: killer.name,
            victim: victim.id,
            victimName: victim.name,
            weapon: msg.weapon || 'm4',
            headshot: !!msg.headshot
          })
          // Respawn de la víctima tras 3s.
          setTimeout(() => {
            if (players.has(victim.id)) {
              const spawn = spawnPoint(victim.team)
              victim.pos = { x: spawn.x, y: spawn.y, z: spawn.z }
              victim.alive = true
              victim.health = 100
              broadcast({ type: 'respawn', id: victim.id, pos: spawn })
            }
          }, 3000)
          // Check victoria.
          if (teams[killer.team] >= SCORE_LIMIT) {
            matchOver = true
            broadcast({ type: 'matchOver', winner: killer.team, teams: { ...teams } })
          }
        }
      }
      break
    case 'name':
      if (msg.name && typeof msg.name === 'string' && msg.name.length <= 16) {
        p.name = msg.name
      }
      break
  }
}

function broadcast(msg) {
  const data = JSON.stringify(msg)
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(data)
  }
}

// Snapshot loop: 20Hz.
setInterval(() => {
  if (matchOver) return
  matchTime += TICK_INTERVAL / 1000
  const snapshot = {
    type: 'snapshot',
    time: matchTime,
    teams: { axis: teams.axis, allies: teams.allies },
    players: Array.from(players.values()).map((p) => ({
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
    }))
  }
  broadcast(snapshot)
}, TICK_INTERVAL)

console.log(`[server] Modern Warfare server listening on :${PORT}`)
console.log(`[server] TDM, score limit: ${SCORE_LIMIT}, max players: ${MAX_PLAYERS}`)
