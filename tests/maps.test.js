import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { MAPS, MAP_IDS, getMapConfig, getDefaultMapId } from '../src/game/maps/index.js'
import { buildDesert } from '../src/game/maps/desert.js'
import { buildUrban } from '../src/game/maps/urban.js'
import { buildSnow } from '../src/game/maps/snow.js'
import { buildIndustrial } from '../src/game/maps/industrial.js'

vi.mock('../src/game/textures.js', () => ({
  makeConcreteTextures: () => ({
    map: { repeat: { set: vi.fn() }, colorSpace: 0 },
    normalMap: { repeat: { set: vi.fn() } },
    roughnessMap: { repeat: { set: vi.fn() } }
  }),
  makeCrateTextures: () => ({ map: {}, normalMap: {} }),
  makeBarrelTexture: () => ({})
}))

describe('MAPS registry', () => {
  it('tiene 6 mapas', () => {
    expect(MAP_IDS.length).toBe(6)
  })

  it('incluye pamplona, desert, urban, snow, industrial, firingRange', () => {
    expect(MAPS.pamplona).toBeDefined()
    expect(MAPS.desert).toBeDefined()
    expect(MAPS.urban).toBeDefined()
    expect(MAPS.snow).toBeDefined()
    expect(MAPS.industrial).toBeDefined()
    expect(MAPS.firingRange).toBeDefined()
  })

  it('cada mapa tiene metadata completa', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id]
      expect(m.id).toBe(id)
      expect(m.name).toBeTruthy()
      expect(m.biome).toBeTruthy()
      expect(m.desc).toBeTruthy()
      expect(m.fogColor).toBeDefined()
      expect(m.fogDensity).toBeGreaterThan(0)
      expect(m.sunColor).toBeDefined()
      expect(m.sunIntensity).toBeGreaterThan(0)
      expect(m.ambientColor).toBeDefined()
      expect(m.hemiSky).toBeDefined()
      expect(m.hemiGround).toBeDefined()
    }
  })

  it('pamplona tiene builder null (legacy en world.js)', () => {
    expect(MAPS.pamplona.builder).toBeNull()
  })

  it('otros mapas tienen builder function', () => {
    expect(typeof MAPS.desert.builder).toBe('function')
    expect(typeof MAPS.urban.builder).toBe('function')
    expect(typeof MAPS.snow.builder).toBe('function')
    expect(typeof MAPS.industrial.builder).toBe('function')
  })

  it('getMapConfig devuelve config válida', () => {
    expect(getMapConfig('desert').id).toBe('desert')
    expect(getMapConfig('nonexistent').id).toBe('pamplona')
  })

  it('getDefaultMapId devuelve pamplona', () => {
    expect(getDefaultMapId()).toBe('pamplona')
  })
})

describe('Map builders', () => {
  it('buildDesert devuelve group + waterMaterials + spawnEdges', () => {
    const colliders = []
    const result = buildDesert(colliders)
    expect(result.group).toBeInstanceOf(THREE.Group)
    expect(Array.isArray(result.waterMaterials)).toBe(true)
    expect(result.spawnEdges).toContain('N')
    expect(colliders.length).toBeGreaterThan(0)
  })

  it('buildUrban devuelve group + waterMaterials + spawnEdges', () => {
    const colliders = []
    const result = buildUrban(colliders)
    expect(result.group).toBeInstanceOf(THREE.Group)
    expect(Array.isArray(result.waterMaterials)).toBe(true)
    expect(result.spawnEdges).toContain('S')
    expect(colliders.length).toBeGreaterThan(0)
  })

  it('buildSnow devuelve group + waterMaterials + spawnEdges', () => {
    const colliders = []
    const result = buildSnow(colliders)
    expect(result.group).toBeInstanceOf(THREE.Group)
    expect(Array.isArray(result.waterMaterials)).toBe(true)
    expect(result.spawnEdges).toContain('E')
    expect(colliders.length).toBeGreaterThan(0)
  })

  it('buildIndustrial devuelve group + waterMaterials + spawnEdges', () => {
    const colliders = []
    const result = buildIndustrial(colliders)
    expect(result.group).toBeInstanceOf(THREE.Group)
    expect(Array.isArray(result.waterMaterials)).toBe(true)
    expect(result.spawnEdges).toContain('W')
    expect(colliders.length).toBeGreaterThan(0)
  })

  it('cada builder produce colliders con box y type', () => {
    const colliders = []
    buildDesert(colliders)
    for (const c of colliders) {
      expect(c.box).toBeDefined()
      expect(c.type).toBeTruthy()
    }
  })
})
