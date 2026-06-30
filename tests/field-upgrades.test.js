import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { createFieldUpgradeSystem } from '../src/game/field-upgrades.js'
import { FIELD_UPGRADES } from '../src/game/config.js'

vi.mock('../src/game/textures.js', () => ({
  makeConcreteTextures: () => ({ map: {}, normalMap: {}, roughnessMap: {} }),
  makeUniformTexture: () => ({ map: {}, normalMap: {} }),
  makeSkinTexture: () => ({ map: {}, normalMap: {} }),
  makeGunMetalTexture: () => ({ map: {}, normalMap: {}, roughnessMap: {} })
}))

function makeFakeScene() {
  return {
    add: vi.fn(),
    remove: vi.fn()
  }
}

function makeFakeEnemies() {
  return {
    forEachAlive: vi.fn(),
    suppressNear: vi.fn()
  }
}

function makeFakePlayer() {
  return {
    getPosition: vi.fn(() => new THREE.Vector3(0, 0, 0))
  }
}

function makeFakeStore() {
  return {
    addReserve: vi.fn()
  }
}

describe('createFieldUpgradeSystem', () => {
  let scene, enemies, particles, audio, player, store

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    scene = makeFakeScene()
    enemies = makeFakeEnemies()
    particles = {}
    audio = {}
    player = makeFakePlayer()
    store = makeFakeStore()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('factory devuelve API completa', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    expect(typeof sys.deploy).toBe('function')
    expect(typeof sys.update).toBe('function')
    expect(typeof sys.canDeploy).toBe('function')
    expect(typeof sys.getCooldownRemaining).toBe('function')
    expect(typeof sys.reset).toBe('function')
    expect(typeof sys.dispose).toBe('function')
    sys.dispose()
  })

  it('deploy devuelve true la primera vez', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    const pos = new THREE.Vector3(0, 0, 0)
    expect(sys.deploy('trophySystem', pos)).toBe(true)
    sys.dispose()
  })

  it('deploy devuelve false si está en cooldown', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    const pos = new THREE.Vector3(0, 0, 0)
    sys.deploy('trophySystem', pos)
    expect(sys.deploy('trophySystem', pos)).toBe(false)
    sys.dispose()
  })

  it('deploy devuelve false para FU inexistente', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    expect(sys.deploy('nonexistent', new THREE.Vector3())).toBe(false)
    sys.dispose()
  })

  it('canDeploy devuelve false tras deploy', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    expect(sys.canDeploy('emp')).toBe(true)
    sys.deploy('emp', new THREE.Vector3())
    expect(sys.canDeploy('emp')).toBe(false)
    sys.dispose()
  })

  it('getCooldownRemaining devuelve 0 si nunca se usó', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    expect(sys.getCooldownRemaining('emp')).toBe(0)
    sys.dispose()
  })

  it('getCooldownRemaining > 0 tras deploy', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('emp', new THREE.Vector3())
    const remaining = sys.getCooldownRemaining('emp')
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(FIELD_UPGRADES.emp.cooldown)
    sys.dispose()
  })

  it('update expira la entity tras duration', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('deadSilenceField', new THREE.Vector3())
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() + 31000)
    sys.update(0.1)
    sys.update(0.1)
    sys.dispose()
  })

  it('reset limpia entities y cooldowns', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('trophySystem', new THREE.Vector3())
    sys.reset()
    expect(sys.canDeploy('trophySystem')).toBe(true)
    sys.dispose()
  })

  it('dispose limpia sin crashear', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('trophySystem', new THREE.Vector3())
    expect(() => sys.dispose()).not.toThrow()
  })

  it('munitionsBox reabastece al player cercano', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('munitionsBox', new THREE.Vector3(0, 0, 0))
    for (let i = 0; i < 5; i++) sys.update(0.25)
    expect(store.addReserve).toHaveBeenCalled()
    sys.dispose()
  })

  it('reconTower marca enemigos cercanos', () => {
    const fakeEnemy = { group: { position: new THREE.Vector3(2, 0, 0) }, markedUntil: 0 }
    enemies.forEachAlive = vi.fn((cb) => cb(fakeEnemy))
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('reconTower', new THREE.Vector3(0, 0, 0))
    for (let i = 0; i < 5; i++) sys.update(0.25)
    expect(fakeEnemy.markedUntil).toBeGreaterThan(0)
    sys.dispose()
  })

  it('suppressingDrone llama a suppressNear', () => {
    const sys = createFieldUpgradeSystem(scene, enemies, particles, audio, player, store)
    sys.deploy('suppressingDrone', new THREE.Vector3(0, 0, 0))
    for (let i = 0; i < 5; i++) sys.update(0.2)
    expect(enemies.suppressNear).toHaveBeenCalled()
    sys.dispose()
  })
})
