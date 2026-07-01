/* =========================================================================
   Cliente de red (Fase 2 + Fase 18.8).
   --------------------------------------------------------------------------
   Conecta al servidor WebSocket. Envía inputs del jugador local a 120Hz
   y recibe snapshots a 30Hz (full + delta). Maneja:
   - init: configuración inicial (clientId, team, spawn, scoreLimit).
   - snapshot: snapshot completo (reemplaza todo el estado remoto).
   - snapshotDelta: delta con solo los cambios (merge incremental).
   - kill: notificación de baja (para killfeed).
   - respawn: jugador reaparece.
   - matchOver: fin de partida.
   - playerLeft: jugador desconectado.

   El servidor valida inputs server-side (anti-cheat + lag compensation).
   El remote-players.js interpola entre snapshots para suavizar movimiento.
   ========================================================================= */

export function createNetClient(serverUrl) {
  let ws = null
  let clientId = null
  let team = null
  let scoreLimit = 75
  let connected = false
  let matchOver = false

  // Estado remoto: { id -> { pos, yaw, pitch, weapon, firing, alive, ... } }
  const remotePlayers = new Map()
  // Scoreboard remoto: { axis: kills, allies: kills }
  let teamScores = { axis: 0, allies: 0 }
  // Killfeed: array de { killer, victim, weapon, headshot, t }
  const killfeed = []
  // Callbacks registrados por el engine.
  const handlers = {
    onInit: [],
    onSnapshot: [],
    onKill: [],
    onRespawn: [],
    onMatchOver: [],
    onPlayerLeft: [],
    onDisconnect: []
  }

  function on(event, fn) {
    if (handlers[event]) handlers[event].push(fn)
  }

  function emit(event, payload) {
    if (!handlers[event]) return
    for (const fn of handlers[event]) fn(payload)
  }

  function connect() {
    try {
      ws = new WebSocket(serverUrl)
    } catch (e) {
      console.warn('[net] No se pudo conectar:', e)
      return
    }
    ws.onopen = () => {
      connected = true
      console.log('[net] Conectado a', serverUrl)
    }
    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch (err) { return }
      handleMessage(msg)
    }
    ws.onclose = () => {
      connected = false
      console.log('[net] Desconectado')
      emit('onDisconnect', {})
    }
    ws.onerror = () => {
      // onclose se llamará después.
    }
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'init':
        clientId = msg.clientId
        team = msg.team
        scoreLimit = msg.scoreLimit
        teamScores = msg.teams || { axis: 0, allies: 0 }
        emit('onInit', msg)
        break
      case 'snapshot':
        remotePlayers.clear()
        for (const p of msg.players) {
          if (p.id !== clientId) remotePlayers.set(p.id, p)
        }
        teamScores = msg.teams
        emit('onSnapshot', { players: Array.from(remotePlayers.values()), teams: teamScores, time: msg.time })
        break
      case 'snapshotDelta': {
        if (Array.isArray(msg.removed)) {
          for (const id of msg.removed) remotePlayers.delete(id)
        }
        if (Array.isArray(msg.players)) {
          for (const delta of msg.players) {
            if (delta.id === clientId) continue
            const cur = remotePlayers.get(delta.id)
            if (cur) {
              const merged = { ...cur, ...delta }
              if (delta.pos) merged.pos = { ...delta.pos }
              remotePlayers.set(delta.id, merged)
            } else {
              remotePlayers.set(delta.id, {
                id: delta.id,
                name: delta.name || `Player${delta.id}`,
                team: delta.team,
                pos: delta.pos || { x: 0, y: 0, z: 0 },
                yaw: delta.yaw || 0,
                pitch: delta.pitch || 0,
                weapon: delta.weapon || 'm4',
                firing: !!delta.firing,
                alive: delta.alive !== undefined ? delta.alive : true,
                health: delta.health !== undefined ? delta.health : 100,
                kills: delta.kills || 0,
                deaths: delta.deaths || 0,
                score: delta.score || 0
              })
            }
          }
        }
        if (msg.teams) teamScores = msg.teams
        emit('onSnapshot', { players: Array.from(remotePlayers.values()), teams: teamScores, time: msg.time })
        break
      }
      case 'kill':
        killfeed.push({
          killer: msg.killerName,
          victim: msg.victimName,
          weapon: msg.weapon,
          headshot: msg.headshot,
          t: Date.now()
        })
        // Mantenemos solo los últimos 5.
        while (killfeed.length > 5) killfeed.shift()
        emit('onKill', msg)
        break
      case 'respawn':
        emit('onRespawn', msg)
        break
      case 'matchOver':
        matchOver = true
        emit('onMatchOver', msg)
        break
      case 'playerLeft':
        remotePlayers.delete(msg.id)
        emit('onPlayerLeft', msg)
        break
    }
  }

  // Envía el input del jugador local al servidor.
  function sendInput(input) {
    if (!connected || !ws || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'input', input }))
  }

  function sendKill(victimId, weapon, headshot) {
    if (!connected || !ws || ws.readyState !== 1 || !clientId) return
    ws.send(JSON.stringify({ type: 'kill', killer: clientId, victim: victimId, weapon, headshot, t: Date.now() }))
  }

  function sendShot(weapon) {
    if (!connected || !ws || ws.readyState !== 1 || !clientId) return
    ws.send(JSON.stringify({ type: 'shot', weapon, t: Date.now() }))
  }

  function sendHit() {
    if (!connected || !ws || ws.readyState !== 1 || !clientId) return
    ws.send(JSON.stringify({ type: 'hit', t: Date.now() }))
  }

  function sendName(name) {
    if (!connected || !ws || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'name', name }))
  }

  function disconnect() {
    if (ws) { ws.close(); ws = null }
    connected = false
    remotePlayers.clear()
  }

  return {
    connect, disconnect, on, sendInput, sendKill, sendShot, sendHit, sendName,
    get connected() { return connected },
    get clientId() { return clientId },
    get team() { return team },
    get scoreLimit() { return scoreLimit },
    get teamScores() { return teamScores },
    get killfeed() { return killfeed },
    get remotePlayers() { return remotePlayers },
    get matchOver() { return matchOver }
  }
}
