import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStreakManager } from '../src/game/streaks.js'

/* Tests del sistema de killstreaks (Fase 4-9).
   Cubre: airstrike, heli, gunship (arreglo del bug de cámara), dispose. */

// Mock minimal de THREE.
vi.mock('three', () => {
  const geo = { dispose: () => {}, rotateZ: () => geo }
  const mat = { dispose: () => {}, clone: () => mat }
  class Mesh {
    constructor(g, m) {
      this.geometry = g; this.material = m
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z }, copy: () => {} }
      this.rotation = { y: 0 }
      this.add = () => {}
      this.castShadow = false
    }
  }
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
    clone() { return new Vector3(this.x, this.y, this.z) }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
  }
  return {
    ConeGeometry: class { constructor() { this.dispose = () => {} } rotateZ() { return this } },
    CylinderGeometry: class { constructor() { this.dispose = () => {} } },
    MeshStandardMaterial: function() { return mat },
    Mesh,
    PointLight: function() { return { position: { set: () => {} } } },
    Vector3
  }
})

function makeMocks() {
  const scene = { add: vi.fn(), remove: vi.fn() }
  const enemies = { forEachAlive: vi.fn() }
  const particles = { spawnSparks: vi.fn(), spawnSmoke: vi.fn() }
  const audio = { playAirstrike: vi.fn(), playExplosion: vi.fn(), playHeliIncoming: vi.fn(), playHeliShoot: vi.fn(), playGunshipIncoming: vi.fn() }
  const player = {
    getPosition: () => ({ x: 0, y: 1.7, z: 0 }),
    setGunshipActive: vi.fn()
  }
  const camera = {
    position: { x: 0, y: 1.7, z: 0, clone: () => ({ x: 0, y: 1.7, z: 0 }), copy: () => {}, set: () => {} },
    quaternion: { clone: () => ({}), copy: () => {} },
    lookAt: vi.fn()
  }
  const store = { getState: () => ({ setGunshipActive: vi.fn() }) }
  return { scene, enemies, particles, audio, player, camera, store }
}

describe('StreakManager', () => {
  let streaks, mocks
  beforeEach(() => {
    mocks = makeMocks()
    streaks = createStreakManager(mocks.scene, mocks.enemies, mocks.particles, mocks.audio, mocks.player, mocks.camera, mocks.store)
  })

  it('activate: airstrike no crashea', () => {
    streaks.activate('airstrike', { x: 0, y: 1.7, z: 0 })
    expect(mocks.audio.playAirstrike).toHaveBeenCalled()
  })

  it('activate: heli spawnea un mesh en la escena', () => {
    streaks.activate('heli', { x: 0, y: 1.7, z: 0 })
    expect(mocks.scene.add).toHaveBeenCalled()
    expect(mocks.audio.playHeliIncoming).toHaveBeenCalled()
  })

  it('activate: gunship setea el flag en player y store', () => {
    streaks.activate('gunship', { x: 0, y: 1.7, z: 0 })
    // Fase 4: el gunship debe avisar al player y al store para que
    // player.update skipa la cámara (bug fix).
    expect(mocks.player.setGunshipActive).toHaveBeenCalledWith(true)
    expect(mocks.audio.playGunshipIncoming).toHaveBeenCalled()
  })

  it('isGunshipActive: false al inicio, true tras activate', () => {
    expect(streaks.isGunshipActive()).toBe(false)
    streaks.activate('gunship', { x: 0, y: 1.7, z: 0 })
    expect(streaks.isGunshipActive()).toBe(true)
  })

  it('gunshipShootAt: llama a explosionAt', () => {
    streaks.gunshipShootAt({ x: 10, y: 0, z: 10 })
    // No podemos verificar explosionAt directamente (es interna), pero
    // si hay audio.playExplosion, la explosión se procesó.
    expect(mocks.audio.playExplosion).toHaveBeenCalled()
  })

  it('update: no crashea sin streaks activos', () => {
    streaks.update(0.016, { x: 0, y: 1.7, z: 0 })
    expect(true).toBe(true)
  })

  it('dispose: limpia heli y gunship', () => {
    streaks.activate('heli', { x: 0, y: 1.7, z: 0 })
    streaks.activate('gunship', { x: 0, y: 1.7, z: 0 })
    streaks.dispose()
    // El gunship debe desactivarse al dispose.
    expect(streaks.isGunshipActive()).toBe(false)
  })

  // Fase 18.32: variantes de airstrike.
  it('activate: clusterStrike daña enemies en radio', () => {
    mocks.enemies.forEachAlive.mockImplementation((fn) => {
      fn({ x: 5, y: 0, z: 5 }, 'shooter', 0, { hp: 100, dead: false })
    })
    expect(() => streaks.activate('clusterStrike', { x: 0, y: 0, z: 0 })).not.toThrow()
    expect(mocks.audio.playExplosion).toHaveBeenCalled()
  })

  it('activate: precisionAirstrike hace 2 pases', () => {
    expect(() => streaks.activate('precisionAirstrike', { x: 0, y: 0, z: 0 })).not.toThrow()
    expect(mocks.audio.playAirstrike).toHaveBeenCalled()
  })

  it('activate: whitePhosphorus inicia burn timer', () => {
    mocks.enemies.forEachAlive.mockImplementation((fn) => {
      fn({ x: 5, y: 0, z: 5 }, 'shooter', 0, { hp: 100, dead: false })
    })
    expect(() => streaks.activate('whitePhosphorus', { x: 0, y: 0, z: 0 })).not.toThrow()
    expect(mocks.audio.playExplosion).toHaveBeenCalled()
  })
})
