import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPickupSystem } from '@/game/items/pickups'

/* Tests del sistema de pickups (Fase 5).
   Cubre: onEnemyKilled (drop), update (proximidad), applyPickup, scavenger. */

// Mock minimal de THREE.
vi.mock('three', () => {
  const mat = { dispose: () => {} }
  class Mesh {
    constructor(g, m) {
      this.geometry = g; this.material = m
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
      this.rotation = { y: 0 }
      this.castShadow = false
    }
  }
  return {
    OctahedronGeometry: class { constructor() { this.dispose = () => {} } },
    BoxGeometry: class { constructor() { this.dispose = () => {} } },
    SphereGeometry: class { constructor() { this.dispose = () => {} } },
    MeshStandardMaterial: function() { return mat },
    Mesh
  }
})

// Mock de loadout.hasPerk.
vi.mock('@/game/player/loadout', () => ({
  hasPerk: vi.fn(() => false)
}))

function makeMocks() {
  const scene = { add: vi.fn(), remove: vi.fn() }
  const store = {
    getState: () => ({
      addHealth: vi.fn(),
      addReserve: vi.fn(),
      addGrenade: vi.fn()
    })
  }
  const particles = {}
  const audio = { playHitMarker: vi.fn() }
  return { scene, store, particles, audio }
}

describe('PickupSystem', () => {
  let sys, mocks
  beforeEach(() => {
    mocks = makeMocks()
    sys = createPickupSystem(mocks.scene, mocks.store, mocks.particles, mocks.audio)
  })

  it('onEnemyKilled: no siempre suelta (dropChance 0.3)', () => {
    for (let i = 0; i < 100; i++) {
      sys.onEnemyKilled({ x: i, y: 0, z: 0 })
    }
    // Con dropChance 0.3, esperamos entre 10 y 60 drops en 100 kills.
    const addedCount = mocks.scene.add.mock.calls.length
    expect(addedCount).toBeGreaterThan(10)
    expect(addedCount).toBeLessThan(60)
  })

  it('update: pickup es recogido por proximidad', () => {
    // Forzamos un drop en (5, 0, 5).
    // Llamamos onEnemyKilled muchas veces hasta que suelte.
    let dropped = false
    for (let i = 0; i < 100 && !dropped; i++) {
      const before = mocks.scene.add.mock.calls.length
      sys.onEnemyKilled({ x: 5, y: 0, z: 5 })
      if (mocks.scene.add.mock.calls.length > before) dropped = true
    }
    expect(dropped).toBe(true)
    // El player pasa por encima → debería recogerse.
    sys.update(0.016, { x: 5, y: 1.7, z: 5 })
    // Al recogerse, se llama a scene.remove.
    expect(mocks.scene.remove).toHaveBeenCalled()
  })

  it('update: pickup NO se recoge si el player está lejos', () => {
    let dropped = false
    for (let i = 0; i < 100 && !dropped; i++) {
      const before = mocks.scene.add.mock.calls.length
      sys.onEnemyKilled({ x: 50, y: 0, z: 50 })
      if (mocks.scene.add.mock.calls.length > before) dropped = true
    }
    expect(dropped).toBe(true)
    // Player lejos → no se recoge.
    sys.update(0.016, { x: 0, y: 1.7, z: 0 })
    expect(mocks.scene.remove).not.toHaveBeenCalled()
  })

  it('scavenger: 100% drop de munición', async () => {
    const { hasPerk } = await import('@/game/player/loadout')
    hasPerk.mockReturnValue(true)
    // Con scavenger, cada kill suelta munición (100%).
    sys.onEnemyKilled({ x: 0, y: 0, z: 0 })
    sys.onEnemyKilled({ x: 1, y: 0, z: 1 })
    sys.onEnemyKilled({ x: 2, y: 0, z: 2 })
    expect(mocks.scene.add.mock.calls.length).toBe(3) // 3 kills = 3 drops
    hasPerk.mockReturnValue(false)
  })

  it('reset: elimina todos los pickups', () => {
    // Soltamos algunos pickups.
    for (let i = 0; i < 50; i++) sys.onEnemyKilled({ x: i, y: 0, z: 0 })
    const dropped = mocks.scene.add.mock.calls.length
    expect(dropped).toBeGreaterThan(0)
    sys.reset()
    // Todos se eliminan de la escena.
    expect(mocks.scene.remove.mock.calls.length).toBe(dropped)
  })

  it('dispose: no crashea', () => {
    sys.dispose()
    expect(true).toBe(true)
  })
})
