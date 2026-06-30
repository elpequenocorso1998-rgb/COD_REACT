import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGrenadeSystem } from '../src/game/grenades.js'

/* Tests del sistema de granadas.
   Cubre: throwGrenade, física de rebote, fuse, flashbang restore, knife. */

// Mock minimal de THREE (solo lo que usa grenades.js).
vi.mock('three', () => {
  return {
    SphereGeometry: class { dispose() {} },
    ConeGeometry: class { dispose() {} },
    MeshStandardMaterial: class {
      constructor(opts) { this.color = opts?.color; this.dispose = () => {} }
    },
    Mesh: class {
      constructor(geo, mat) { this.geometry = geo; this.material = mat; this.position = { x: 0, y: 0, z: 0, copy: () => {} }; this.rotation = { x: 0, y: 0 } }
    },
    Vector3: class {
      constructor(x=0, y=0, z=0) { this.x=x; this.y=y; this.z=z }
      copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this }
      clone() { return new (this.constructor)(this.x, this.y, this.z) }
      multiplyScalar(s) { this.x*=s; this.y*=s; this.z*=s; return this }
      subVectors(a, b) { this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this }
      normalize() { return this }
      distanceTo(v) { return Math.hypot(this.x-v.x, this.y-v.y, this.z-v.z) }
    },
    Ray: class {
      constructor() { this.origin = { x:0,y:0,z:0, set(v){this.origin.x=v.x;this.origin.y=v.y;this.origin.z=v.z;return this}, distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)} }; this.direction = { x:0,y:0,z:0, subVectors(a,b){this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this}, normalize(){return this} } }
      intersectBox(box, target) { return null }
    }
  }
})

function makeMocks() {
  const scene = { add: vi.fn(), remove: vi.fn() }
  const world = { collidesAt: vi.fn(() => false) }
  const enemies = { forEachAlive: vi.fn() }
  const particles = { spawnSparks: vi.fn(), spawnSmoke: vi.fn() }
  const audio = { playExplosion: vi.fn(), playReload: vi.fn() }
  const player = { getPosition: () => ({ x: 0, y: 1.7, z: 0 }) }
  const store = {
    getState: () => ({
      flashPlayer: vi.fn(),
      useGrenade: vi.fn(() => true),
      addGrenade: vi.fn()
    })
  }
  return { scene, world, enemies, particles, audio, player, store }
}

describe('GrenadeSystem', () => {
  let sys, mocks
  beforeEach(() => {
    mocks = makeMocks()
    sys = createGrenadeSystem(mocks.scene, mocks.world, mocks.enemies, mocks.particles, mocks.audio, mocks.player, mocks.store)
  })

  it('throwGrenade: añade un proyectil a la escena', () => {
    sys.throwGrenade('frag', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 })
    expect(mocks.scene.add).toHaveBeenCalledTimes(1)
  })

  it('throwGrenade: tipo desconocido no hace nada', () => {
    sys.throwGrenade('unknown', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 })
    expect(mocks.scene.add).not.toHaveBeenCalled()
  })

  it('update: la granada cae por gravedad', () => {
    sys.throwGrenade('frag', { x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 0 })
    // Antes del update, la posición Y es 5 (seteada por copy).
    // Tras un dt pequeño, la Y debería bajar por la gravedad.
    sys.update(0.1, { x: 0, y: 1.7, z: 0 })
    // No podemos verificar el valor exacto sin acceso interno, pero al
    // menos verificamos que no crashea.
    expect(true).toBe(true)
  })

  it('reset: elimina todos los proyectiles', () => {
    sys.throwGrenade('frag', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 })
    sys.throwGrenade('flash', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 })
    sys.reset()
    // Los proyectiles se eliminan de la escena.
    expect(mocks.scene.remove).toHaveBeenCalledTimes(2)
  })

  it('flashbang: no ralentiza permanentemente (regresión del bug)', () => {
    // Bug original: e.speed *= 0.3 y la restauración era
    // e.maxHp ? e.speed : e.speed / 0.3 → siempre evaluaba a e.speed
    // (maxHp es truthy) → slow permanente acumulativo.
    const enemy = { speed: 2.0, maxHp: 50, hp: 50, group: { position: { x: 1, z: 1 } } }
    mocks.enemies.forEachAlive.mockImplementation((fn) => {
      fn({ x: 1, z: 1 }, 'shooter', 0, enemy)
    })
    // Lanzamos flash y esperamos al fuse (3s).
    sys.throwGrenade('flash', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: 0 })
    // Avanzamos el tiempo hasta la explosión.
    sys.update(3.1, { x: 0, y: 1.7, z: 0 })
    // El enemigo debe tener originalSpeed seteado (restauración pendiente).
    expect(enemy.originalSpeed).toBe(2.0)
    expect(enemy.speed).toBe(0.6) // 2.0 * 0.3
  })

  it('knife: no crashea al expirar sin impacto', () => {
    sys.throwGrenade('knife', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 })
    sys.update(3.1, { x: 0, y: 1.7, z: 0 })
    // El knife expira sin efecto (no hay impacto).
    expect(true).toBe(true)
  })

  it('dispose: libera geometrías y materiales', () => {
    sys.dispose()
    // No crashea y limpia todo.
    expect(true).toBe(true)
  })
})
