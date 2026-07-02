import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMatchFlow,
  MAP_POOL,
  KILLER_POV_BUFFER_SIZE
} from '@/game/match/match-flow'

describe('createMatchFlow', () => {
  let mf

  beforeEach(() => {
    mf = createMatchFlow({ voteOptions: 3, intermissionTime: 30 })
  })

  it('factory expone API completa', () => {
    expect(typeof mf.startIntermission).toBe('function')
    expect(typeof mf.update).toBe('function')
    expect(typeof mf.voteMap).toBe('function')
    expect(typeof mf.getVoteResults).toBe('function')
    expect(typeof mf.getMVP).toBe('function')
    expect(typeof mf.getAfterActionReport).toBe('function')
    expect(typeof mf.requestBackfill).toBe('function')
    expect(typeof mf.fillBackfillSlot).toBe('function')
    expect(typeof mf.recordRemoteCamera).toBe('function')
    expect(typeof mf.getKillerPOV).toBe('function')
    expect(typeof mf.reset).toBe('function')
  })

  it('startIntermission selecciona N mapas del pool', () => {
    mf.startIntermission()
    const maps = mf.getVoteMaps()
    expect(maps.length).toBe(3)
    for (const m of maps) {
      expect(MAP_POOL).toContain(m)
    }
  })

  it('voteMap registra voto válido', () => {
    mf.startIntermission()
    const maps = mf.getVoteMaps()
    expect(mf.voteMap(maps[0], 1)).toBe(true)
    expect(mf.voteMap(maps[1], 2)).toBe(true)
    const results = mf.getVoteResults()
    expect(results.length).toBe(3)
    const m0 = results.find((r) => r.mapId === maps[0])
    expect(m0.votes).toBe(1)
  })

  it('voteMap rechaza mapa no en opciones', () => {
    mf.startIntermission()
    expect(mf.voteMap('nonexistent_map', 1)).toBe(false)
  })

  it('voteMap rechaza voto fuera de intermission', () => {
    expect(mf.voteMap('pamplona', 1)).toBe(false)
  })

  it('voteMap permite cambiar voto del mismo voter', () => {
    mf.startIntermission()
    const maps = mf.getVoteMaps()
    mf.voteMap(maps[0], 1)
    mf.voteMap(maps[1], 1)
    const results = mf.getVoteResults()
    const m0 = results.find((r) => r.mapId === maps[0])
    const m1 = results.find((r) => r.mapId === maps[1])
    expect(m0.votes).toBe(0)
    expect(m1.votes).toBe(1)
  })

  it('update en intermission devuelve tick event', () => {
    mf.startIntermission()
    const r = mf.update(1)
    expect(r.event).toBe('tick')
    expect(r.timeLeft).toBeLessThan(30)
  })

  it('update al expirar devuelve intermissionEnd con mapa ganador', () => {
    mf.startIntermission()
    const maps = mf.getVoteMaps()
    mf.voteMap(maps[0], 1)
    mf.voteMap(maps[0], 2)
    mf.voteMap(maps[1], 3)
    const r = mf.update(31)
    expect(r.event).toBe('intermissionEnd')
    expect(r.winnerMap).toBe(maps[0])
  })

  it('update sin votos elige mapa aleatorio', () => {
    mf.startIntermission()
    const r = mf.update(31)
    expect(r.event).toBe('intermissionEnd')
    expect(mf.getVoteMaps()).toContain(r.winnerMap)
  })

  it('getMVP devuelve el jugador con mejor score', () => {
    const players = [
      { id: 1, name: 'A', kills: 5, deaths: 3, assists: 2, score: 100 },
      { id: 2, name: 'B', kills: 10, deaths: 2, assists: 1, score: 200 },
      { id: 3, name: 'C', kills: 3, deaths: 5, assists: 0, score: 50 }
    ]
    const mvp = mf.getMVP(players)
    expect(mvp.id).toBe(2)
  })

  it('getMVP con array vacío devuelve null', () => {
    expect(mf.getMVP([])).toBeNull()
    expect(mf.getMVP(null)).toBeNull()
  })

  it('getAfterActionReport calcula totals + MVP', () => {
    const players = [
      { id: 1, name: 'A', team: 'axis', kills: 10, deaths: 5, assists: 2, score: 200, shots: 100, hits: 30 },
      { id: 2, name: 'B', team: 'allies', kills: 8, deaths: 7, assists: 3, score: 150, shots: 80, hits: 20 }
    ]
    const report = mf.getAfterActionReport(players, { duration: 600 })
    expect(report.mvp.id).toBe(1)
    expect(report.totals.kills).toBe(18)
    expect(report.totals.deaths).toBe(12)
    expect(report.totals.accuracy).toBeCloseTo(50 / 180, 3)
    expect(report.totals.duration).toBe(600)
    expect(report.players.length).toBe(2)
  })

  it('requestBackfill crea tickets', () => {
    const tickets = mf.requestBackfill(3)
    expect(tickets.length).toBe(3)
    expect(tickets[0].id).toBeTruthy()
    expect(tickets[0].filled).toBe(false)
  })

  it('fillBackfillSlot marca ticket como filled', () => {
    const [ticket] = mf.requestBackfill(1)
    expect(mf.fillBackfillSlot(ticket.id, 99)).toBe(true)
    expect(ticket.filled).toBe(true)
    expect(ticket.playerId).toBe(99)
  })

  it('fillBackfillSlot rechaza ticket inexistente', () => {
    expect(mf.fillBackfillSlot('nonexistent', 1)).toBe(false)
  })

  it('getBackfillQueue devuelve solo tickets no filled', () => {
    const [t1, t2] = mf.requestBackfill(2)
    mf.fillBackfillSlot(t1.id, 99)
    const queue = mf.getBackfillQueue()
    expect(queue.length).toBe(1)
    expect(queue[0].id).toBe(t2.id)
  })

  it('recordRemoteCamera guarda posiciones del killer', () => {
    for (let i = 0; i < 5; i++) {
      mf.recordRemoteCamera(7, { x: i, y: 0, z: 0 }, 0.1 * i)
    }
    const pov = mf.getKillerPOV(7)
    expect(pov.length).toBe(5)
    expect(pov[4].x).toBe(4)
  })

  it('getKillerPOV devuelve array vacío si no hay data', () => {
    expect(mf.getKillerPOV(99)).toEqual([])
  })

  it('recordRemoteCamera respeta buffer size', () => {
    for (let i = 0; i < KILLER_POV_BUFFER_SIZE + 50; i++) {
      mf.recordRemoteCamera(7, { x: i, y: 0, z: 0 }, 0)
    }
    expect(mf.getKillerPOV(7).length).toBe(KILLER_POV_BUFFER_SIZE)
  })

  it('clearRemoteCamera limpia el buffer de un player', () => {
    mf.recordRemoteCamera(7, { x: 1, y: 0, z: 0 }, 0)
    mf.clearRemoteCamera(7)
    expect(mf.getKillerPOV(7)).toEqual([])
  })

  it('reset limpia todo el estado', () => {
    mf.startIntermission()
    mf.voteMap(mf.getVoteMaps()[0], 1)
    mf.recordRemoteCamera(7, { x: 1, y: 0, z: 0 }, 0)
    mf.requestBackfill(2)
    mf.reset()
    expect(mf.isIntermissionActive()).toBe(false)
    expect(mf.getVoteMaps()).toEqual([])
    expect(mf.getVoteResults()).toEqual([])
    expect(mf.getKillerPOV(7)).toEqual([])
    expect(mf.getBackfillQueue()).toEqual([])
  })
})
