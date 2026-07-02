import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoundFlow,
  ROUND_STATES,
  GUNFIGHT_WEAPON_ROTATION,
  getGunfightLoadout
} from '@/game/match/round-flow'

describe('createRoundFlow', () => {
  let rf

  beforeEach(() => {
    rf = createRoundFlow({
      bestOf: 6,
      roundTime: 40,
      warmupTime: 10,
      roundStartTime: 3,
      roundEndTime: 3,
      intermissionTime: 5,
      halftimeTime: 10
    })
  })

  it('factory expone API completa', () => {
    expect(typeof rf.start).toBe('function')
    expect(typeof rf.update).toBe('function')
    expect(typeof rf.endRound).toBe('function')
    expect(typeof rf.reset).toBe('function')
    expect(typeof rf.on).toBe('function')
    expect(typeof rf.getState).toBe('function')
    expect(typeof rf.getRound).toBe('function')
    expect(typeof rf.getScore).toBe('function')
    expect(typeof rf.getTimeLeft).toBe('function')
    expect(typeof rf.getWinner).toBe('function')
  })

  it('start transita a WARMUP', () => {
    expect(rf.getState()).toBe(ROUND_STATES.LOBBY)
    rf.start()
    expect(rf.getState()).toBe(ROUND_STATES.WARMUP)
    expect(rf.getTimeLeft()).toBe(10)
  })

  it('warmup → round_start → round_play', () => {
    rf.start()
    rf.update(11)
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_START)
    expect(rf.getRound()).toBe(1)
    rf.update(4)
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_PLAY)
  })

  it('endRound registra ganador y transita a ROUND_END', () => {
    rf.start()
    rf.update(11)
    rf.update(4)
    rf.endRound('axis')
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_END)
    expect(rf.getScore().axis).toBe(1)
  })

  it('round_end → intermission → next round', () => {
    rf.start()
    rf.update(11)
    rf.update(4)
    rf.endRound('axis')
    rf.update(4)
    expect(rf.getState()).toBe(ROUND_STATES.INTERMISSION)
    rf.update(6)
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_START)
    expect(rf.getRound()).toBe(2)
  })

  it('halftime intercambia lados tras round 3', () => {
    const rf2 = createRoundFlow({
      bestOf: 6, target: 4, roundTime: 40, warmupTime: 10,
      roundStartTime: 3, roundEndTime: 3, intermissionTime: 5, halftimeTime: 10
    })
    rf2.start()
    for (let i = 0; i < 3; i++) {
      rf2.update(11)
      rf2.update(4)
      rf2.endRound('axis')
      rf2.update(4)
      if (i < 2) rf2.update(6)
    }
    expect(rf2.getState()).toBe(ROUND_STATES.HALFTIME)
    const sides = rf2.getSides()
    expect(sides.axis).toBe('allies')
    expect(sides.allies).toBe('axis')
  })

  it('match_end cuando un team alcanza ceil(bestOf/2) wins', () => {
    rf.start()
    // axis gana 4 rounds (target = ceil(6/2) = 4).
    for (let i = 0; i < 4; i++) {
      rf.update(11)
      rf.update(4)
      rf.endRound('axis')
      rf.update(4)
      if (i < 3) rf.update(6)
    }
    expect(rf.getState()).toBe(ROUND_STATES.MATCH_END)
    expect(rf.getWinner()).toBe('axis')
  })

  it('overtime cuando hay empate al final del bestOf', () => {
    const rf2 = createRoundFlow({
      bestOf: 2, target: 3, roundTime: 10, enableOvertime: true,
      enableHalftime: false
    })
    rf2.start()
    // round 1: axis
    rf2.update(11)
    rf2.update(4)
    rf2.endRound('axis')
    rf2.update(4)
    rf2.update(6)
    // round 2: allies (empate 1-1, bestOf=2 alcanzado, target=3 no alcanzado)
    rf2.update(4)
    rf2.endRound('allies')
    rf2.update(4)
    expect(rf2.getState()).toBe(ROUND_STATES.OVERTIME)
    expect(rf2.isOvertime()).toBe(true)
  })

  it('round_play sin winner tras timeLeft → gana team con más vivos', () => {
    rf.start()
    rf.update(11)
    rf.update(4)
    // 1 axis vivo, 0 allies vivos → gana axis.
    rf.update(41, { axis: 1, allies: 0 })
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_END)
    expect(rf.getScore().axis).toBe(1)
  })

  it('round_play con vivos empatados → round sin ganador', () => {
    rf.start()
    rf.update(11)
    rf.update(4)
    rf.update(41, { axis: 1, allies: 1 })
    expect(rf.getState()).toBe(ROUND_STATES.ROUND_END)
    expect(rf.getScore().axis).toBe(0)
    expect(rf.getScore().allies).toBe(0)
  })

  it('on listeners disparan callbacks en stateChange', () => {
    const calls = []
    rf.on('stateChange', (p) => calls.push(p.state))
    rf.start()
    expect(calls).toContain(ROUND_STATES.WARMUP)
  })

  it('reset vuelve a LOBBY', () => {
    rf.start()
    rf.update(11)
    rf.reset()
    expect(rf.getState()).toBe(ROUND_STATES.LOBBY)
    expect(rf.getRound()).toBe(0)
    expect(rf.getScore()).toEqual({ axis: 0, allies: 0 })
  })

  it('update en LOBBY no hace nada', () => {
    rf.update(100)
    expect(rf.getState()).toBe(ROUND_STATES.LOBBY)
  })

  it('update en MATCH_END no hace nada', () => {
    rf.start()
    for (let i = 0; i < 4; i++) {
      rf.update(11)
      rf.update(4)
      rf.endRound('axis')
      rf.update(4)
      if (i < 3) rf.update(6)
    }
    const before = rf.getState()
    rf.update(100)
    expect(rf.getState()).toBe(before)
  })
})

describe('getGunfightLoadout', () => {
  it('devuelve par de armas por round', () => {
    const l = getGunfightLoadout(1)
    expect(Array.isArray(l)).toBe(true)
    expect(l.length).toBe(2)
  })

  it('rota armas cíclicamente', () => {
    const r1 = getGunfightLoadout(1)
    const r2 = getGunfightLoadout(2)
    expect(r1).not.toEqual(r2)
    // Después de GUNFIGHT_WEAPON_ROTATION.length rounds, vuelve a empezar.
    const rAfter = getGunfightLoadout(1 + GUNFIGHT_WEAPON_ROTATION.length)
    expect(rAfter).toEqual(r1)
  })
})
