import { describe, it, expect } from 'vitest'
import { classifyQuality, FpsSampler } from '@/game/effects/quality'
import { QUALITY } from '@/game/core/constants'

describe('classifyQuality', () => {
  it('LOW para FPS < 30', () => {
    expect(classifyQuality(15)).toBe(QUALITY.LOW)
    expect(classifyQuality(29)).toBe(QUALITY.LOW)
  })
  it('MEDIUM para 30 <= FPS < 50', () => {
    expect(classifyQuality(30)).toBe(QUALITY.MEDIUM)
    expect(classifyQuality(49)).toBe(QUALITY.MEDIUM)
  })
  it('HIGH para FPS >= 50', () => {
    expect(classifyQuality(50)).toBe(QUALITY.HIGH)
    expect(classifyQuality(120)).toBe(QUALITY.HIGH)
  })
})

describe('FpsSampler', () => {
  it('detecta calidad tras warmupFrames', () => {
    let detected = null
    const s = new FpsSampler(10, (q) => { detected = q })
    // Simulamos 10 frames a ~60 FPS (dt = 1/60).
    for (let i = 0; i < 10; i++) s.sample(1 / 60)
    expect(s.detected).toBe(true)
    expect(detected).toBe(QUALITY.HIGH)
    expect(s.fps).toBeGreaterThan(50)
  })

  it('no llama al callback antes del warmup', () => {
    let called = false
    const s = new FpsSampler(10, () => { called = true })
    for (let i = 0; i < 9; i++) s.sample(1 / 60)
    expect(called).toBe(false)
    expect(s.detected).toBe(false)
  })

  it('detecta LOW con FPS bajos', () => {
    let detected = null
    const s = new FpsSampler(10, (q) => { detected = q })
    // dt grande = FPS bajo (1/20 = 20 FPS).
    for (let i = 0; i < 10; i++) s.sample(1 / 20)
    expect(detected).toBe(QUALITY.LOW)
  })

  it('reset reinicia el sampler', () => {
    const s = new FpsSampler(5, () => {})
    for (let i = 0; i < 5; i++) s.sample(1 / 60)
    expect(s.detected).toBe(true)
    s.reset()
    expect(s.detected).toBe(false)
    expect(s.samples).toHaveLength(0)
  })

  it('ignora dt <= 0', () => {
    const s = new FpsSampler(3, () => {})
    s.sample(0)
    s.sample(-1)
    expect(s.samples).toHaveLength(0)
  })
})
