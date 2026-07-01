/* =========================================================================
   Round flow controller (Fase 18.38 + 18.40 + 18.41).
   --------------------------------------------------------------------------
   Orquesta el flujo de partida para modos basados en rounds:
   - Pre-match countdown + warmup (todos los modos MP).
   - Round transitions (Gunfight, S&D): round_start → round_play →
     round_end → intermission → next round.
   - Halftime: a mitad del bestOf, los equipos intercambian lados.
   - Overtime: si empate al final, 1 round extra con reglas especiales.
   - Match end:_winner announcement + transition to intermission.

   Factory createRoundFlow(config) devuelve:
   - state: estado actual ('lobby'|'warmup'|'round_start'|'round_play'|
     'round_end'|'halftime'|'intermission'|'overtime'|'match_end').
   - start(): inicia warmup.
   - update(dt, aliveTeams): tick del estado, transiciones automáticas.
   - endRound(winnerTeam): termina el round actual.
   - getRound() / getScore() / getState() / getTimeLeft().
   - reset().
   ========================================================================= */

export const ROUND_STATES = {
  LOBBY: 'lobby',
  WARMUP: 'warmup',
  ROUND_START: 'round_start',
  ROUND_PLAY: 'round_play',
  ROUND_END: 'round_end',
  HALFTIME: 'halftime',
  INTERMISSION: 'intermission',
  OVERTIME: 'overtime',
  MATCH_END: 'match_end'
}

export function createRoundFlow({
  bestOf = 6,
  target = null,
  roundTime = 40,
  warmupTime = 10,
  roundStartTime = 3,
  roundEndTime = 3,
  intermissionTime = 5,
  halftimeTime = 10,
  enableHalftime = true,
  enableOvertime = true
} = {}) {
  const winTarget = target || Math.ceil(bestOf / 2)
  let state = ROUND_STATES.LOBBY
  let timeLeft = 0
  let round = 0
  let scores = { axis: 0, allies: 0 }
  let sides = { axis: 'axis', allies: 'allies' } // team → side
  let overtime = false
  let matchWinner = null
  let callbacks = {}

  function on(event, fn) {
    if (!callbacks[event]) callbacks[event] = []
    callbacks[event].push(fn)
  }

  function emit(event, payload) {
    if (!callbacks[event]) return
    for (const fn of callbacks[event]) fn(payload)
  }

  function start() {
    state = ROUND_STATES.WARMUP
    timeLeft = warmupTime
    round = 0
    scores = { axis: 0, allies: 0 }
    overtime = false
    matchWinner = null
    emit('stateChange', { state, timeLeft })
  }

  function endRound(winnerTeam) {
    if (state !== ROUND_STATES.ROUND_PLAY) return
    if (winnerTeam && scores[winnerTeam] !== undefined) {
      scores[winnerTeam]++
    }
    state = ROUND_STATES.ROUND_END
    timeLeft = roundEndTime
    emit('roundEnd', { round, winner: winnerTeam, scores: { ...scores } })
    emit('stateChange', { state, timeLeft })
  }

  function update(dt, aliveTeams = {}) {
    if (state === ROUND_STATES.LOBBY || state === ROUND_STATES.MATCH_END) return
    timeLeft -= dt
    if (timeLeft > 0) return
    // Transición según estado actual.
    switch (state) {
      case ROUND_STATES.WARMUP:
        startNewRound()
        break
      case ROUND_STATES.ROUND_START:
        state = ROUND_STATES.ROUND_PLAY
        timeLeft = roundTime
        emit('roundStart', { round })
        emit('stateChange', { state, timeLeft })
        break
      case ROUND_STATES.ROUND_PLAY: {
        // Tiempo agotado: gana el team con más vivos.
        const axisAlive = aliveTeams.axis || 0
        const alliesAlive = aliveTeams.allies || 0
        const winner = axisAlive > alliesAlive ? 'axis'
          : (alliesAlive > axisAlive ? 'allies' : null)
        endRound(winner)
        break
      }
      case ROUND_STATES.ROUND_END:
        // Check fin de partida.
        if (checkMatchEnd()) break
        // Check halftime.
        if (enableHalftime && !overtime && round === Math.floor(bestOf / 2)) {
          state = ROUND_STATES.HALFTIME
          timeLeft = halftimeTime
          // Intercambio de lados.
          const tmp = sides.axis
          sides.axis = sides.allies
          sides.allies = tmp
          emit('halftime', { sides: { ...sides } })
          emit('stateChange', { state, timeLeft })
        } else {
          state = ROUND_STATES.INTERMISSION
          timeLeft = intermissionTime
          emit('stateChange', { state, timeLeft })
        }
        break
      case ROUND_STATES.HALFTIME:
        state = ROUND_STATES.INTERMISSION
        timeLeft = intermissionTime
        emit('stateChange', { state, timeLeft })
        break
      case ROUND_STATES.INTERMISSION:
        startNewRound()
        break
      case ROUND_STATES.OVERTIME:
        startNewRound()
        break
      default:
        break
    }
  }

  function startNewRound() {
    round++
    state = ROUND_STATES.ROUND_START
    timeLeft = roundStartTime
    emit('stateChange', { state, timeLeft, round })
  }

  function checkMatchEnd() {
    // Match ends if a team reaches winTarget.
    if (scores.axis >= winTarget || scores.allies >= winTarget) {
      state = ROUND_STATES.MATCH_END
      matchWinner = scores.axis > scores.allies ? 'axis' : 'allies'
      timeLeft = 0
      emit('matchEnd', { winner: matchWinner, scores: { ...scores } })
      emit('stateChange', { state, timeLeft })
      return true
    }
    // Overtime: si se jugaron todos los rounds del bestOf y empatan.
    if (enableOvertime && round >= bestOf && scores.axis === scores.allies) {
      state = ROUND_STATES.OVERTIME
      timeLeft = intermissionTime
      overtime = true
      emit('overtime', { round, scores: { ...scores } })
      emit('stateChange', { state, timeLeft })
      return true
    }
    // Match ends if all rounds played without tie and no team reached target.
    if (round >= bestOf) {
      state = ROUND_STATES.MATCH_END
      matchWinner = scores.axis > scores.allies ? 'axis' : 'allies'
      timeLeft = 0
      emit('matchEnd', { winner: matchWinner, scores: { ...scores } })
      emit('stateChange', { state, timeLeft })
      return true
    }
    return false
  }

  function reset() {
    state = ROUND_STATES.LOBBY
    timeLeft = 0
    round = 0
    scores = { axis: 0, allies: 0 }
    sides = { axis: 'axis', allies: 'allies' }
    overtime = false
    matchWinner = null
    callbacks = {}
  }

  return {
    start, update, endRound, reset, on,
    getState: () => state,
    getRound: () => round,
    getScore: () => ({ ...scores }),
    getSides: () => ({ ...sides }),
    getTimeLeft: () => Math.max(0, timeLeft),
    getWinner: () => matchWinner,
    isOvertime: () => overtime
  }
}

// Fase 18.38: Gunfight — weapon rotation per round.
export const GUNFIGHT_WEAPON_ROTATION = [
  ['m4', 'm4'],
  ['mp5', 'mp5'],
  ['sniper', 'sniper'],
  ['shotgun', 'shotgun'],
  ['ak47', 'ak47'],
  ['pistol', 'pistol'],
  ['lmg', 'lmg'],
  ['m4', 'mp5']
]

export function getGunfightLoadout(round) {
  return GUNFIGHT_WEAPON_ROTATION[(round - 1) % GUNFIGHT_WEAPON_ROTATION.length]
}
