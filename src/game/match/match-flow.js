/* =========================================================================
   Match flow controller (Fase 18.42 + 18.43 + 18.44 + 18.45).
   --------------------------------------------------------------------------
   - After-action report: calcula MVP, XP breakdown, accuracy, stats finales.
   - Intermission lobby: countdown + map vote (3 maps aleatorios, veto).
   - Join-in-progress backfill: slots vacíos se rellenan con bots o se
     marcan para backfill de jugadores entrantes.
   - Killer-POV killcam: buffer circular de cámaras remotas para reproducir
     la POV del killer tras muerte (parcial: requiere snapshots de remote
     players).

   Factory createMatchFlow(config) devuelve:
   - startIntermission(): inicia intermission entre partidas.
   - update(dt): tick del intermission countdown.
   - voteMap(mapId, voterId): registra voto de mapa.
   - getVoteResults(): cuenta de votos por mapa.
   - getMVP(): calcula MVP de la partida.
   - getAfterActionReport(): stats finales para UI.
   - requestBackfill(slotCount): solicita backfill de jugadores.
   - recordRemoteCamera(playerId, pos, yaw): feed para killer-POV killcam.
   - getKillerPOV(killerId): últimos 5s de cámara del killer.
   ========================================================================= */

const MAP_POOL = ['pamplona', 'desert', 'urban', 'snow', 'industrial']
const KILLER_POV_BUFFER_SIZE = 150 // ~5s a 30Hz
const KILLER_POV_SAMPLE_INTERVAL = 1 / 30

export function createMatchFlow({ voteOptions = 3, intermissionTime = 30 } = {}) {
  let intermissionTimer = 0
  let intermissionActive = false
  let voteMaps = []
  let votes = new Map() // voterId → mapId
  let remoteCameras = new Map() // playerId → buffer circular
  let backfillQueue = []

  function startIntermission() {
    intermissionActive = true
    intermissionTimer = intermissionTime
    // Elegir N mapas aleatorios del pool.
    const shuffled = [...MAP_POOL].sort(() => Math.random() - 0.5)
    voteMaps = shuffled.slice(0, Math.min(voteOptions, MAP_POOL.length))
    votes.clear()
  }

  function update(dt) {
    if (!intermissionActive) return null
    intermissionTimer -= dt
    if (intermissionTimer <= 0) {
      intermissionActive = false
      const results = getVoteResults()
      const winner = results.length > 0
        ? results.reduce((a, b) => (a.votes > b.votes ? a : b)).mapId
        : voteMaps[Math.floor(Math.random() * voteMaps.length)]
      return { event: 'intermissionEnd', winnerMap: winner, results }
    }
    return { event: 'tick', timeLeft: Math.max(0, intermissionTimer) }
  }

  function voteMap(mapId, voterId) {
    if (!intermissionActive) return false
    if (!voteMaps.includes(mapId)) return false
    votes.set(voterId, mapId)
    return true
  }

  function getVoteResults() {
    const counts = new Map()
    for (const mapId of voteMaps) counts.set(mapId, 0)
    for (const m of votes.values()) {
      counts.set(m, (counts.get(m) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([mapId, v]) => ({ mapId, votes: v }))
  }

  function getMVP(players) {
    if (!players || players.length === 0) return null
    let mvp = players[0]
    for (const p of players) {
      const score = (p.kills || 0) * 100 + (p.assists || 0) * 50 + (p.score || 0)
      const mvpScore = (mvp.kills || 0) * 100 + (mvp.assists || 0) * 50 + (mvp.score || 0)
      if (score > mvpScore) mvp = p
    }
    return mvp
  }

  function getAfterActionReport(players, matchData = {}) {
    const mvp = getMVP(players)
    const totalKills = players.reduce((s, p) => s + (p.kills || 0), 0)
    const totalDeaths = players.reduce((s, p) => s + (p.deaths || 0), 0)
    const totalShots = players.reduce((s, p) => s + (p.shots || 0), 0)
    const totalHits = players.reduce((s, p) => s + (p.hits || 0), 0)
    return {
      mvp: mvp ? {
        id: mvp.id, name: mvp.name, kills: mvp.kills, deaths: mvp.deaths,
        assists: mvp.assists, score: mvp.score
      } : null,
      totals: {
        kills: totalKills,
        deaths: totalDeaths,
        accuracy: totalShots > 0 ? totalHits / totalShots : 0,
        duration: matchData.duration || 0
      },
      players: players.map((p) => ({
        id: p.id, name: p.name, team: p.team,
        kills: p.kills || 0, deaths: p.deaths || 0,
        assists: p.assists || 0, score: p.score || 0
      }))
    }
  }

  function requestBackfill(slotCount) {
    const tickets = []
    for (let i = 0; i < slotCount; i++) {
      const ticket = {
        id: `backfill_${Date.now()}_${i}`,
        createdAt: Date.now(),
        filled: false
      }
      backfillQueue.push(ticket)
      tickets.push(ticket)
    }
    return tickets
  }

  function fillBackfillSlot(ticketId, playerId) {
    const ticket = backfillQueue.find((t) => t.id === ticketId)
    if (ticket && !ticket.filled) {
      ticket.filled = true
      ticket.playerId = playerId
      return true
    }
    return false
  }

  function getBackfillQueue() {
    return backfillQueue.filter((t) => !t.filled)
  }

  function recordRemoteCamera(playerId, pos, yaw, pitch = 0) {
    if (!remoteCameras.has(playerId)) {
      remoteCameras.set(playerId, [])
    }
    const buf = remoteCameras.get(playerId)
    buf.push({ x: pos.x, y: pos.y, z: pos.z, yaw, pitch, t: Date.now() })
    if (buf.length > KILLER_POV_BUFFER_SIZE) buf.shift()
  }

  function getKillerPOV(killerId) {
    return remoteCameras.get(killerId) || []
  }

  function clearRemoteCamera(playerId) {
    remoteCameras.delete(playerId)
  }

  function reset() {
    intermissionActive = false
    intermissionTimer = 0
    voteMaps = []
    votes.clear()
    remoteCameras.clear()
    backfillQueue = []
  }

  return {
    startIntermission, update, voteMap, getVoteResults,
    getMVP, getAfterActionReport,
    requestBackfill, fillBackfillSlot, getBackfillQueue,
    recordRemoteCamera, getKillerPOV, clearRemoteCamera,
    reset,
    getIntermissionTimeLeft: () => Math.max(0, intermissionTimer),
    isIntermissionActive: () => intermissionActive,
    getVoteMaps: () => [...voteMaps]
  }
}

export { MAP_POOL, KILLER_POV_BUFFER_SIZE, KILLER_POV_SAMPLE_INTERVAL }
