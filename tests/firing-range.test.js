import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildFiringRange, FIRING_RANGE_META } from '@/game/maps/firing-range'
import { MAPS, MAP_IDS, getMapConfig } from '@/game/maps/index'

describe('buildFiringRange', () => {
  it('devuelve un THREE.Group con dummies y distance markers', () => {
    const group = buildFiringRange([])
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.children.length).toBeGreaterThan(10)
  })

  it('registra colliders si se pasa array', () => {
    const colliders = []
    buildFiringRange(colliders)
    expect(colliders.length).toBeGreaterThan(0)
    for (const c of colliders) {
      expect(c.box).toBeInstanceOf(THREE.Box3)
      expect(c.type).toMatch(/^(crate|wall)$/)
    }
  })

  it('FIRING_RANGE_META tiene metadata completa', () => {
    expect(FIRING_RANGE_META.id).toBe('firingRange')
    expect(FIRING_RANGE_META.name).toBeTruthy()
    expect(FIRING_RANGE_META.biome).toBe('training')
    expect(FIRING_RANGE_META.desc).toBeTruthy()
  })
})

describe('MAPS registry incluye firing range', () => {
  it('firingRange está registrado', () => {
    expect(MAPS.firingRange).toBeDefined()
    expect(MAPS.firingRange.id).toBe('firingRange')
    expect(typeof MAPS.firingRange.builder).toBe('function')
  })

  it('MAP_IDS incluye firingRange', () => {
    expect(MAP_IDS).toContain('firingRange')
  })

  it('getMapConfig devuelve firingRange', () => {
    const cfg = getMapConfig('firingRange')
    expect(cfg.id).toBe('firingRange')
  })

  it('getMapConfig fallback a pamplona para ID inexistente', () => {
    const cfg = getMapConfig('nonexistent')
    expect(cfg.id).toBe('pamplona')
  })
})
