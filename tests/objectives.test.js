import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import { createObjectiveSystem } from '@/game/match/objectives'

vi.mock('@/game/world/textures', () => ({
  makeSkinTexture: () => ({}),
  makeUniformTexture: () => ({})
}))

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

function makeStore() {
  return {
    getState: () => ({
      mpTeam: 'allies',
      setObjectiveNotice: vi.fn(),
      awardObjectivePoint: vi.fn()
    })
  }
}

describe('createObjectiveSystem', () => {
  let scene, store, sys

  beforeEach(() => {
    scene = makeScene()
    store = makeStore()
    sys = createObjectiveSystem(scene, store)
  })

  it('factory expone API completa', () => {
    expect(typeof sys.setup).toBe('function')
    expect(typeof sys.update).toBe('function')
    expect(typeof sys.reset).toBe('function')
    expect(typeof sys.dispose).toBe('function')
    expect(typeof sys.onPlayerKill).toBe('function')
    expect(typeof sys.tryCollectDogTag).toBe('function')
    expect(typeof sys.tryPlantBomb).toBe('function')
    expect(typeof sys.tryDefuseBomb).toBe('function')
    expect(typeof sys.getZones).toBe('function')
    expect(typeof sys.getDogTags).toBe('function')
    expect(typeof sys.getMode).toBe('function')
  })

  it('setup con domination crea 3 flags A/B/C', () => {
    sys.setup('domination', {})
    const zones = sys.getZones()
    expect(zones.length).toBe(3)
    expect(zones.map((z) => z.id).sort()).toEqual(['A', 'B', 'C'])
    expect(zones[0].type).toBe('flag')
    expect(zones[0].owner).toBeNull()
  })

  it('setup con hardpoint crea 5 hills, solo 1 activa', () => {
    sys.setup('hardpoint', {})
    const zones = sys.getZones()
    expect(zones.length).toBe(5)
    expect(zones[0].type).toBe('hill')
    const activeCount = zones.filter((z) => z.active).length
    expect(activeCount).toBe(1)
  })

  it('setup con killConfirmed no crea zones (solo dog-tags)', () => {
    sys.setup('killConfirmed', {})
    expect(sys.getZones().length).toBe(0)
  })

  it('setup con searchDestroy crea 2 bomb sites', () => {
    sys.setup('searchDestroy', {})
    const zones = sys.getZones()
    expect(zones.length).toBe(2)
    expect(zones[0].type).toBe('bombsite')
    expect(zones[0].bombPlanted).toBe(false)
  })

  it('onPlayerKill en killConfirmed dropea dog-tag', () => {
    sys.setup('killConfirmed', {})
    sys.onPlayerKill(7, 'axis', { x: 10, y: 0, z: 10 }, 'axis')
    const tags = sys.getDogTags()
    expect(tags.length).toBe(1)
    expect(tags[0].victimId).toBe(7)
    expect(tags[0].team).toBe('axis')
  })

  it('onPlayerKill en TDM no dropea dog-tags', () => {
    sys.setup('tdm', {})
    sys.onPlayerKill(7, 'axis', { x: 10, y: 0, z: 10 }, 'axis')
    expect(sys.getDogTags().length).toBe(0)
  })

  it('tryCollectDogTag confirma tag enemigo', () => {
    sys.setup('killConfirmed', {})
    sys.onPlayerKill(7, 'axis', { x: 10, y: 0, z: 10 }, 'axis')
    const result = sys.tryCollectDogTag({ x: 10, y: 0, z: 10 }, 'allies')
    expect(result).not.toBeNull()
    expect(result.victimId).toBe(7)
  })

  it('tryCollectDogTag no confirma tag del propio equipo', () => {
    sys.setup('killConfirmed', {})
    sys.onPlayerKill(7, 'allies', { x: 10, y: 0, z: 10 }, 'allies')
    const result = sys.tryCollectDogTag({ x: 10, y: 0, z: 10 }, 'allies')
    expect(result).toBeNull()
  })

  it('update de dog-tag expira tras 30s', () => {
    sys.setup('killConfirmed', {})
    sys.onPlayerKill(7, 'axis', { x: 10, y: 0, z: 10 }, 'axis')
    expect(sys.getDogTags().length).toBe(1)
    sys.update(31, new THREE.Vector3(0, 0, 0), new Map())
    expect(sys.getDogTags().length).toBe(0)
  })

  it('hardpoint rota de hill cada 60s', () => {
    sys.setup('hardpoint', {})
    const zones = sys.getZones()
    const initialActive = zones.findIndex((z) => z.active)
    sys.update(61, new THREE.Vector3(0, 0, 0), new Map())
    const newActive = zones.findIndex((z) => z.active)
    expect(newActive).not.toBe(initialActive)
  })

  it('tryPlantBomb en searchDestroy planta tras 5s en zona', () => {
    sys.setup('searchDestroy', {})
    const zones = sys.getZones()
    let planted = false
    for (let i = 0; i < 60; i++) {
      const r = sys.tryPlantBomb({ x: zones[0].x, y: 0, z: zones[0].z }, 'axis', 0.1)
      if (r) { planted = true; break }
    }
    expect(planted).toBe(true)
    expect(zones[0].bombPlanted).toBe(true)
    expect(zones[0].bombTimer).toBeGreaterThan(0)
  })

  it('tryPlantBomb fuera de TDM no planta', () => {
    sys.setup('tdm', {})
    const r = sys.tryPlantBomb({ x: 0, y: 0, z: 0 }, 'axis', 0.1)
    expect(r).toBe(false)
  })

  it('reset limpia zones y dog-tags', () => {
    sys.setup('killConfirmed', {})
    sys.onPlayerKill(7, 'axis', { x: 0, y: 0, z: 0 }, 'axis')
    expect(sys.getDogTags().length).toBe(1)
    sys.reset()
    expect(sys.getZones().length).toBe(0)
    expect(sys.getDogTags().length).toBe(0)
  })

  it('dispose limpia la escena', () => {
    sys.setup('domination', {})
    expect(scene.children.length).toBeGreaterThan(0)
    sys.dispose()
    expect(scene.children.length).toBe(0)
  })

  it('getMode devuelve el modo activo', () => {
    sys.setup('domination', {})
    expect(sys.getMode()).toBe('domination')
  })
})
