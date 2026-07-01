import { describe, it, expect } from 'vitest'
import {
  computeStatBars,
  computeStatDeltas,
  STAT_KEYS,
  RETICLE_SHAPES,
  DEFAULT_RETICLES,
  createCustomReticle,
  drawReticleOnCanvas
} from '../src/game/gunsmith.js'

describe('computeStatBars', () => {
  it('devuelve 5 stats para m4', () => {
    const stats = computeStatBars('m4')
    expect(stats).not.toBeNull()
    for (const k of STAT_KEYS) {
      expect(stats[k]).toBeGreaterThanOrEqual(5)
      expect(stats[k]).toBeLessThanOrEqual(100)
    }
  })

  it('devuelve null para arma inexistente', () => {
    expect(computeStatBars('nonexistent')).toBeNull()
  })

  it('devuelve stats distintas para armas distintas', () => {
    const m4 = computeStatBars('m4')
    const sniper = computeStatBars('sniper')
    expect(sniper.damage).toBeGreaterThan(m4.damage)
    expect(sniper.firerate).toBeLessThan(m4.firerate)
  })

  it('aplica loadout con attachments', () => {
    const withLoadout = computeStatBars('m4', {
      primary: 'm4',
      primaryAttachments: { sight: 'redDot' },
      perks: {}
    })
    expect(withLoadout).not.toBeNull()
    expect(STAT_KEYS.length).toBe(5)
  })
})

describe('computeStatDeltas', () => {
  it('devuelve deltas entre dos loadouts', () => {
    const base = { primary: 'm4', primaryAttachments: {}, perks: {} }
    const modified = { primary: 'm4', primaryAttachments: { mag: 'extendedMags' }, perks: {} }
    const deltas = computeStatDeltas('m4', base, modified)
    expect(deltas).not.toBeNull()
    for (const k of STAT_KEYS) {
      expect(typeof deltas[k]).toBe('number')
    }
  })

  it('deltas son cero si loadouts son iguales', () => {
    const l = { primary: 'm4', primaryAttachments: {}, perks: {} }
    const deltas = computeStatDeltas('m4', l, l)
    for (const k of STAT_KEYS) {
      expect(deltas[k]).toBe(0)
    }
  })
})

describe('Reticle editor', () => {
  it('RETICLE_SHAPES tiene 8 formas', () => {
    expect(RETICLE_SHAPES.length).toBe(8)
    expect(RETICLE_SHAPES).toContain('dot')
    expect(RETICLE_SHAPES).toContain('cross')
    expect(RETICLE_SHAPES).toContain('chevron')
  })

  it('DEFAULT_RETICLES tiene 8 reticles predefinidos', () => {
    expect(DEFAULT_RETICLES.length).toBe(8)
    for (const r of DEFAULT_RETICLES) {
      expect(r.id).toBeTruthy()
      expect(RETICLE_SHAPES).toContain(r.shape)
      expect(r.color).toMatch(/^#/)
      expect(r.size).toBeGreaterThan(0)
    }
  })

  it('createCustomReticle respeta shape válido', () => {
    const r = createCustomReticle({ shape: 'circle', color: '#ff0000', size: 8 })
    expect(r.shape).toBe('circle')
    expect(r.color).toBe('#ff0000')
    expect(r.size).toBe(8)
    expect(r.id).toBe('custom')
  })

  it('createCustomReticle corrige shape inválido', () => {
    const r = createCustomReticle({ shape: 'invalid', color: 'red', size: -5 })
    expect(r.shape).toBe('dot')
    expect(r.color).toBe('#00ff00')
    expect(r.size).toBe(4)
  })

  it('createCustomReticle limita size a 20', () => {
    const r = createCustomReticle({ shape: 'dot', color: '#00ff00', size: 50 })
    expect(r.size).toBe(20)
  })

  it('drawReticleOnCanvas no rompe con ctx nulo', () => {
    expect(() => drawReticleOnCanvas(null, { shape: 'dot', color: '#fff', size: 2 }, 0, 0)).not.toThrow()
  })

  it('drawReticleOnCanvas dibuja sin error para cada shape', () => {
    const ctx = {
      save: () => {}, restore: () => {},
      fillRect: () => {}, strokeRect: () => {},
      beginPath: () => {}, arc: () => {}, moveTo: () => {},
      lineTo: () => {}, closePath: () => {},
      fill: () => {}, stroke: () => {},
      fillStyle: '', strokeStyle: '', lineWidth: 0
    }
    for (const shape of RETICLE_SHAPES) {
      expect(() => drawReticleOnCanvas(ctx, { shape, color: '#fff', size: 4 }, 50, 50)).not.toThrow()
    }
  })
})
