import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import {
  createPingSystem,
  PING_TYPES,
  PING_WHEEL_ORDER
} from '@/game/match/ping-system'

function makeScene() {
  const items = []
  return {
    add: (o) => { items.push(o); return o },
    remove: (o) => {
      const i = items.indexOf(o)
      if (i >= 0) items.splice(i, 1)
    },
    get children() { return items }
  }
}

describe('createPingSystem', () => {
  let scene, sys

  beforeEach(() => {
    scene = makeScene()
    sys = createPingSystem(scene, {})
  })

  it('factory expone API completa', () => {
    expect(typeof sys.ping).toBe('function')
    expect(typeof sys.update).toBe('function')
    expect(typeof sys.reset).toBe('function')
    expect(typeof sys.dispose).toBe('function')
    expect(typeof sys.getScreenPings).toBe('function')
    expect(typeof sys.getMinimapPings).toBe('function')
    expect(typeof sys.openWheel).toBe('function')
    expect(typeof sys.closeWheel).toBe('function')
    expect(typeof sys.selectWheelSlot).toBe('function')
    expect(typeof sys.isWheelOpen).toBe('function')
  })

  it('PING_TYPES tiene 6 tipos', () => {
    expect(Object.keys(PING_TYPES).length).toBe(6)
    expect(PING_TYPES.default).toBeDefined()
    expect(PING_TYPES.danger).toBeDefined()
    expect(PING_TYPES.enemy).toBeDefined()
    expect(PING_TYPES.loot).toBeDefined()
    expect(PING_TYPES.goto).toBeDefined()
    expect(PING_TYPES.defend).toBeDefined()
  })

  it('PING_WHEEL_ORDER tiene 6 slots', () => {
    expect(PING_WHEEL_ORDER.length).toBe(6)
  })

  it('ping crea un marker en la escena', () => {
    sys.ping({ x: 10, y: 0, z: 10 }, 'default', 1)
    expect(sys.count).toBe(1)
    expect(scene.children.length).toBeGreaterThan(0)
  })

  it('ping con tipo desconocido usa default', () => {
    sys.ping({ x: 0, y: 0, z: 0 }, 'nonexistent', 1)
    expect(sys.count).toBe(1)
  })

  it('getMinimapPings devuelve posiciones 2D', () => {
    sys.ping({ x: 5, y: 0, z: 7 }, 'enemy', 1)
    const mp = sys.getMinimapPings()
    expect(mp.length).toBe(1)
    expect(mp[0].x).toBe(5)
    expect(mp[0].z).toBe(7)
    expect(mp[0].type).toBe('enemy')
  })

  it('update expira pings tras 5s', () => {
    sys.ping({ x: 0, y: 0, z: 0 }, 'default', 1)
    expect(sys.count).toBe(1)
    // Spy on performance.now to simulate 6s elapsed.
    const realNow = performance.now
    const start = realNow.call(performance)
    vi.spyOn(performance, 'now').mockReturnValue(start)
    sys.ping({ x: 0, y: 0, z: 0 }, 'default', 1)
    expect(sys.count).toBe(2)
    // Advance 6s.
    performance.now.mockReturnValue(start + 6000)
    sys.update(0.016, null)
    expect(sys.count).toBe(0)
    performance.now.mockRestore()
  })

  it('openWheel abre wheel', () => {
    expect(sys.isWheelOpen()).toBe(false)
    sys.openWheel(100, 200)
    expect(sys.isWheelOpen()).toBe(true)
    expect(sys.getWheelPos()).toEqual({ x: 100, y: 200 })
  })

  it('closeWheel cierra sin seleccionar', () => {
    sys.openWheel(0, 0)
    sys.closeWheel()
    expect(sys.isWheelOpen()).toBe(false)
  })

  it('selectWheelSlot devuelve tipo y cierra wheel', () => {
    sys.openWheel(0, 0)
    const result = sys.selectWheelSlot(0, 1)
    expect(result.type).toBe(PING_WHEEL_ORDER[0])
    expect(result.ownerId).toBe(1)
    expect(sys.isWheelOpen()).toBe(false)
  })

  it('selectWheelSlot con idx inválido devuelve null', () => {
    sys.openWheel(0, 0)
    expect(sys.selectWheelSlot(-1, 1)).toBeNull()
    expect(sys.selectWheelSlot(99, 1)).toBeNull()
  })

  it('update con camera projecta pings a screen-space', () => {
    sys.ping({ x: 0, y: 0, z: -10 }, 'default', 1)
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    camera.position.set(0, 1, 0)
    camera.lookAt(0, 0, -10)
    sys.update(0.016, camera)
    const screen = sys.getScreenPings()
    expect(screen.length).toBe(1)
    expect(screen[0].x).toBeGreaterThanOrEqual(0)
    expect(screen[0].x).toBeLessThanOrEqual(1)
  })

  it('reset limpia todos los pings', () => {
    sys.ping({ x: 0, y: 0, z: 0 }, 'default', 1)
    sys.ping({ x: 5, y: 0, z: 5 }, 'enemy', 2)
    expect(sys.count).toBe(2)
    sys.reset()
    expect(sys.count).toBe(0)
  })

  it('dispose limpia escena', () => {
    sys.ping({ x: 0, y: 0, z: 0 }, 'default', 1)
    expect(scene.children.length).toBeGreaterThan(0)
    sys.dispose()
    expect(scene.children.length).toBe(0)
  })
})
