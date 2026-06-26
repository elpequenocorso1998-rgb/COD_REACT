import { describe, it, expect } from 'vitest'
import { mulberry32, clamp, lerp, smoothstep, deg2rad, dist2d } from '../src/game/math.js'

/* Tests de las utilidades matemáticas compartidas. */

describe('mulberry32', () => {
  it('es determinista: misma semilla => misma secuencia', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produce valores en [0, 1)', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('semillas distintas => secuencias distintas', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    let diff = false
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) { diff = true; break }
    }
    expect(diff).toBe(true)
  })
})

describe('clamp', () => {
  it('limita al rango [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
  it('respeta min > max devolviendo min', () => {
    // comportamiento defensivo
    expect(clamp(5, 10, 0)).toBe(10)
  })
  it('no muta NaN (devuelve el input si está dentro)', () => {
    // NaN no es < min ni > max, así que devuelve NaN (caería por defecto).
    // Documentamos el comportamiento: clamp no sanitiza NaN.
    const r = clamp(NaN, 0, 10)
    expect(Number.isNaN(r)).toBe(true)
  })
})

describe('lerp', () => {
  it('interpola linealmente', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
  it('extrapola fuera de [0,1]', () => {
    expect(lerp(0, 10, 2)).toBe(20)
    expect(lerp(0, 10, -1)).toBe(-10)
  })
})

describe('smoothstep', () => {
  it('es 0 antes de edge0 y 1 despues de edge1', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(0, 1, 2)).toBe(1)
  })
  it('es 0.5 en el punto medio', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  })
  it('tiene derivadas nulas en los extremos (monotona)', () => {
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const v = smoothstep(0, 1, i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('NO divide por cero cuando edge0 === edge1 (bug fix M9)', () => {
    // Antes: (x - edge0) / (edge1 - edge0) = 0/0 = NaN → clamp(NaN)=NaN.
    // Ahora: guard devuelve 0 o 1 sin NaN.
    expect(smoothstep(5, 5, 3)).toBe(0)   // x < edge0
    expect(smoothstep(5, 5, 7)).toBe(1)   // x > edge0
    expect(smoothstep(5, 5, 5)).toBe(1)   // x === edge0 (border, devuelve 1)
  })
})

describe('deg2rad', () => {
  it('convierte grados a radianes', () => {
    expect(deg2rad(0)).toBe(0)
    expect(deg2rad(180)).toBeCloseTo(Math.PI)
    expect(deg2rad(90)).toBeCloseTo(Math.PI / 2)
  })
})

describe('dist2d', () => {
  it('calcula distancia 2D', () => {
    expect(dist2d(0, 0, 3, 4)).toBe(5)
    expect(dist2d(1, 1, 1, 1)).toBe(0)
  })
  it('es simétrica', () => {
    expect(dist2d(0, 0, 5, 12)).toBe(dist2d(5, 12, 0, 0))
  })
})
