import { describe, it, expect, vi, beforeEach } from 'vitest'

const wsMocks = []

class MockWS {
  constructor() {
    this.readyState = 1
    this.sent = []
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    wsMocks.push(this)
  }
  send(data) { this.sent.push(data) }
  close() { this.readyState = 3; if (this.onclose) this.onclose() }
}

vi.stubGlobal('WebSocket', MockWS)

let NetClient
beforeEach(async () => {
  vi.resetModules()
  wsMocks.length = 0
  ;({ createNetClient: NetClient } = await import('../src/net/client.js'))
})

describe('createNetClient', () => {
  it('factory expone API completa', () => {
    const c = NetClient('ws://localhost:9433')
    expect(typeof c.connect).toBe('function')
    expect(typeof c.disconnect).toBe('function')
    expect(typeof c.on).toBe('function')
    expect(typeof c.sendInput).toBe('function')
    expect(typeof c.sendKill).toBe('function')
    expect(typeof c.sendShot).toBe('function')
    expect(typeof c.sendHit).toBe('function')
    expect(typeof c.sendName).toBe('function')
  })

  it('init message setea clientId, team y scoreLimit', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 7, team: 'axis', scoreLimit: 50, teams: { axis: 0, allies: 0 }
    }) })
    expect(c.clientId).toBe(7)
    expect(c.team).toBe('axis')
    expect(c.scoreLimit).toBe(50)
  })

  it('snapshot full reemplaza remotePlayers', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshot',
      time: 1,
      teams: { axis: 1, allies: 2 },
      players: [
        { id: 2, name: 'A', team: 'allies', pos: { x: 1, y: 0, z: 1 }, yaw: 0, pitch: 0, weapon: 'm4', firing: false, alive: true, health: 100, kills: 0, deaths: 0, score: 0 },
        { id: 3, name: 'B', team: 'allies', pos: { x: 2, y: 0, z: 2 }, yaw: 0, pitch: 0, weapon: 'ak47', firing: false, alive: true, health: 100, kills: 0, deaths: 0, score: 0 }
      ]
    }) })
    expect(c.remotePlayers.size).toBe(2)
    expect(c.teamScores).toEqual({ axis: 1, allies: 2 })
  })

  it('snapshotDelta mergea cambios incrementales', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshot',
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [
        { id: 2, name: 'A', team: 'allies', pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, weapon: 'm4', firing: false, alive: true, health: 100, kills: 0, deaths: 0, score: 0 }
      ]
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshotDelta',
      time: 2,
      teams: { axis: 0, allies: 0 },
      players: [
        { id: 2, pos: { x: 5, y: 0, z: 5 }, yaw: 1.5 }
      ],
      removed: []
    }) })
    const p = c.remotePlayers.get(2)
    expect(p.pos.x).toBe(5)
    expect(p.yaw).toBe(1.5)
    expect(p.name).toBe('A')
  })

  it('snapshotDelta añade player nuevo', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshotDelta',
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [
        { id: 5, name: 'New', team: 'axis', pos: { x: 7, y: 0, z: 7 }, yaw: 0, pitch: 0, weapon: 'mp5', firing: true, alive: true, health: 80, kills: 1, deaths: 0, score: 100 }
      ],
      removed: []
    }) })
    expect(c.remotePlayers.size).toBe(1)
    const p = c.remotePlayers.get(5)
    expect(p.name).toBe('New')
    expect(p.health).toBe(80)
  })

  it('snapshotDelta removed elimina player', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshot',
      time: 1,
      teams: { axis: 0, allies: 0 },
      players: [
        { id: 2, name: 'A', team: 'allies', pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, weapon: 'm4', firing: false, alive: true, health: 100, kills: 0, deaths: 0, score: 0 }
      ]
    }) })
    ws.onmessage({ data: JSON.stringify({
      type: 'snapshotDelta',
      time: 2,
      teams: { axis: 0, allies: 0 },
      players: [],
      removed: [2]
    }) })
    expect(c.remotePlayers.size).toBe(0)
  })

  it('killfeed mantiene solo últimos 5', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    for (let i = 0; i < 7; i++) {
      ws.onmessage({ data: JSON.stringify({
        type: 'kill', killer: 2, killerName: 'A', victim: 3, victimName: 'B', weapon: 'm4', headshot: false
      }) })
    }
    expect(c.killfeed.length).toBe(5)
  })

  it('sendShot/sendHit/sendKill envían mensajes al server', () => {
    const c = NetClient('ws://localhost:9433')
    c.connect()
    const ws = wsMocks[0]
    ws.onopen && ws.onopen()
    ws.onmessage({ data: JSON.stringify({
      type: 'init', clientId: 1, team: 'axis', scoreLimit: 75, teams: { axis: 0, allies: 0 }
    }) })
    c.sendShot('m4')
    c.sendHit()
    c.sendKill(2, 'm4', true)
    expect(ws.sent.length).toBeGreaterThanOrEqual(3)
    const shot = JSON.parse(ws.sent.find((s) => JSON.parse(s).type === 'shot'))
    const hit = JSON.parse(ws.sent.find((s) => JSON.parse(s).type === 'hit'))
    const kill = JSON.parse(ws.sent.find((s) => JSON.parse(s).type === 'kill'))
    expect(shot.weapon).toBe('m4')
    expect(shot.t).toBeTypeOf('number')
    expect(hit.t).toBeTypeOf('number')
    expect(kill.killer).toBe(1)
    expect(kill.victim).toBe(2)
    expect(kill.headshot).toBe(true)
  })
})
