import { describe, it, expect, vi } from 'vitest'
import {
  PERF_BUDGETS,
  LOD_LEVELS,
  createFrameProfiler,
  createLODSystem,
  createMemoryTracker,
  createQualityScaler
} from '@/game/performance/profiler'
import * as THREE from 'three'

describe('profiler.js — config', () => {
  it('PERF_BUDGETS tiene 3 plataformas', () => {
    expect(Object.keys(PERF_BUDGETS).length).toBe(3)
    expect(PERF_BUDGETS.mobile.frameTime).toBe(33)
    expect(PERF_BUDGETS.desktop.frameTime).toBe(8)
    expect(PERF_BUDGETS.console.frameTime).toBe(16)
  })

  it('LOD_LEVELS tiene 4 niveles', () => {
    expect(Object.keys(LOD_LEVELS).length).toBe(4)
    expect(LOD_LEVELS.HIGH.distance).toBe(0)
    expect(LOD_LEVELS.IMPOSTOR.distance).toBeGreaterThan(LOD_LEVELS.LOW.distance)
  })
})

describe('createFrameProfiler', () => {
  it('factory devuelve API completa', () => {
    const p = createFrameProfiler()
    expect(typeof p.beginFrame).toBe('function')
    expect(typeof p.endFrame).toBe('function')
    expect(typeof p.mark).toBe('function')
    expect(typeof p.measure).toBe('function')
    expect(typeof p.getStats).toBe('function')
    p.reset && p.reset()
  })

  it('getStats devuelve datos tras frames', () => {
    const p = createFrameProfiler({ sampleSize: 10 })
    for (let i = 0; i < 5; i++) {
      p.beginFrame()
      p.endFrame()
    }
    const stats = p.getStats()
    expect(stats.frameCount).toBe(5)
    expect(stats.fps).toBeGreaterThanOrEqual(0)
  })

  it('mark + measure miden tiempo', () => {
    const p = createFrameProfiler()
    p.mark('test')
    const elapsed = p.measure('test')
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('measure devuelve 0 si no hay mark', () => {
    const p = createFrameProfiler()
    expect(p.measure('nonexistent')).toBe(0)
  })

  it('reset limpia samples', () => {
    const p = createFrameProfiler({ sampleSize: 10 })
    for (let i = 0; i < 5; i++) {
      p.beginFrame()
      p.endFrame()
    }
    p.reset()
    expect(p.getStats().frameCount).toBe(0)
  })

  it('getFPS calcula desde avgFrameTime', () => {
    const p = createFrameProfiler({ sampleSize: 10 })
    for (let i = 0; i < 10; i++) {
      p.beginFrame()
      p.endFrame()
    }
    const fps = p.getFPS()
    expect(fps).toBeGreaterThan(0)
  })
})

describe('createLODSystem', () => {
  it('factory devuelve API completa', () => {
    const cam = { position: new THREE.Vector3() }
    const lod = createLODSystem(cam)
    expect(typeof lod.register).toBe('function')
    expect(typeof lod.unregister).toBe('function')
    expect(typeof lod.update).toBe('function')
    expect(typeof lod.getStats).toBe('function')
    lod.dispose()
  })

  it('register añade objeto tracked', () => {
    const cam = { position: new THREE.Vector3() }
    const lod = createLODSystem(cam)
    const obj = new THREE.Object3D()
    lod.register(obj)
    const stats = lod.getStats()
    expect(stats.total).toBe(1)
    lod.dispose()
  })

  it('unregister elimina objeto', () => {
    const cam = { position: new THREE.Vector3() }
    const lod = createLODSystem(cam)
    const obj = new THREE.Object3D()
    lod.register(obj)
    lod.unregister(obj)
    expect(lod.getStats().total).toBe(0)
    lod.dispose()
  })

  it('update no crashea con objetos sin parent', () => {
    const cam = { position: new THREE.Vector3(0, 0, 100) }
    const lod = createLODSystem(cam)
    const obj = new THREE.Object3D()
    obj.position.set(0, 0, 0)
    lod.register(obj)
    expect(() => lod.update(0.016)).not.toThrow()
    lod.dispose()
  })

  it('getStats devuelve total/visible/impostored', () => {
    const cam = { position: new THREE.Vector3() }
    const lod = createLODSystem(cam)
    const obj = new THREE.Object3D()
    obj.parent = new THREE.Object3D()
    lod.register(obj)
    const stats = lod.getStats()
    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('visible')
    expect(stats).toHaveProperty('impostored')
    lod.dispose()
  })
})

describe('createMemoryTracker', () => {
  it('factory devuelve API completa', () => {
    const mt = createMemoryTracker()
    expect(typeof mt.snapshot).toBe('function')
    expect(typeof mt.checkBudget).toBe('function')
    expect(typeof mt.getLeaks).toBe('function')
    expect(typeof mt.setWarnCallback).toBe('function')
    mt.reset()
  })

  it('snapshot sin renderer devuelve datos vacíos', () => {
    const mt = createMemoryTracker()
    const snap = mt.snapshot()
    expect(snap.geometries).toBe(0)
    expect(snap.textures).toBe(0)
    expect(snap.timestamp).toBeGreaterThan(0)
    mt.reset()
  })

  it('checkBudget devuelve ok si sin heap', () => {
    const mt = createMemoryTracker()
    const r = mt.checkBudget(PERF_BUDGETS.desktop)
    expect(r.ok).toBe(true)
    mt.reset()
  })

  it('getLeaks devuelve array', () => {
    const mt = createMemoryTracker()
    expect(Array.isArray(mt.getLeaks())).toBe(true)
    mt.reset()
  })

  it('setWarnCallback registra callback', () => {
    const mt = createMemoryTracker()
    const fn = vi.fn()
    mt.setWarnCallback(fn)
    expect(fn).not.toHaveBeenCalled()
    mt.reset()
  })
})

describe('createQualityScaler', () => {
  it('factory devuelve API completa', () => {
    const scaler = createQualityScaler()
    expect(typeof scaler.update).toBe('function')
    expect(typeof scaler.getScale).toBe('function')
    expect(typeof scaler.setScale).toBe('function')
    scaler.reset()
  })

  it('getScale devuelve 1.0 inicial', () => {
    const scaler = createQualityScaler()
    expect(scaler.getScale()).toBe(1.0)
    scaler.reset()
  })

  it('setScale clampa a [0.5, 1.5]', () => {
    const scaler = createQualityScaler()
    scaler.setScale(10)
    expect(scaler.getScale()).toBe(1.5)
    scaler.setScale(0)
    expect(scaler.getScale()).toBe(0.5)
    scaler.reset()
  })

  it('update no crashea sin renderer', () => {
    const scaler = createQualityScaler()
    expect(() => scaler.update(60)).not.toThrow()
    scaler.reset()
  })
})
