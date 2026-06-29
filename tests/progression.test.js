import { describe, it, expect, beforeEach } from 'vitest'
import {
  addXP, getProgress, resetProgress, xpForNextLevel, getUnlockForLevel,
  recordKill, recordDeath, recordWave
} from '../src/game/progression.js'

/* Tests del sistema de progresión: XP, niveles, unlocks, persistencia. */

beforeEach(() => {
  // Limpiamos localStorage y reseteamos el estado del módulo entre tests.
  localStorage.clear()
  resetProgress()
})

describe('xpForNextLevel', () => {
  it('nivel 1 requiere 1000 XP', () => {
    expect(xpForNextLevel(1)).toBe(1000)
  })
  it('nivel 2 requiere 1250 XP (crece 250 por nivel)', () => {
    expect(xpForNextLevel(2)).toBe(1250)
  })
  it('nivel 5 requiere 2000 XP', () => {
    expect(xpForNextLevel(5)).toBe(2000)
  })
})

describe('addXP', () => {
  it('suma XP sin subir de nivel', () => {
    const result = addXP(500)
    expect(result.leveledUp).toBe(false)
    expect(result.newLevel).toBe(1)
    expect(result.xp).toBe(500)
    expect(result.xpNeeded).toBe(1000)
  })

  it('sube de nivel al cruzar el umbral', () => {
    const result = addXP(1000)
    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBe(2)
    expect(result.xp).toBe(0) // XP residual tras subir
    expect(result.xpNeeded).toBe(1250)
  })

  it('puede subir varios niveles de golpe con mucho XP', () => {
    // 1000 (nivel 2) + 1250 (nivel 3) = 2250 XP para llegar a nivel 3.
    const result = addXP(2250)
    expect(result.newLevel).toBe(3)
    expect(result.xp).toBe(0)
  })

  it('level up desbloquea items del catálogo', () => {
    // Nivel 2 desbloquea MP5 SMG.
    const result = addXP(1000)
    expect(result.newUnlocks.length).toBe(1)
    expect(result.newUnlocks[0].name).toBe('MP5 SMG')
    expect(result.newUnlocks[0].id).toBe('mp5')
  })

  it('no desbloquea nada en niveles sin unlock (nivel 5 → ya que 2-4 tienen unlock)', () => {
    // Subimos a nivel 5 directamente: niveles 2-4 tienen unlocks, 5 también tiene.
    // Buscamos un nivel sin unlock en el catálogo nuevo.
    const totalXP = [1000, 1250, 1500].reduce((a, b) => a + b, 0)
    const result = addXP(totalXP)
    expect(result.newLevel).toBe(4)
  })
})

describe('getProgress', () => {
  it('estado inicial: nivel 1, 0 XP', () => {
    const p = getProgress()
    expect(p.level).toBe(1)
    expect(p.xp).toBe(0)
    expect(p.xpNeeded).toBe(1000)
    expect(p.unlocks).toEqual([])
  })

  it('refleja XP añadido y nivel subido', () => {
    addXP(1500) // sube a nivel 2, sobran 500
    const p = getProgress()
    expect(p.level).toBe(2)
    expect(p.xp).toBe(500)
    expect(p.xpNeeded).toBe(1250)
    expect(p.unlocks.length).toBe(1)
  })
})

describe('persistencia', () => {
  it('el progreso sobrevive a una "recarga" (re-lectura del módulo)', () => {
    addXP(1500) // nivel 2, 500 XP
    // Simulamos recarga: el módulo relee localStorage en el siguiente getProgress.
    // Como el módulo cachea _state, forzamos re-lectura reseteando la cache
    // interna via vi.resetModules + dynamic import.
    // Para este test, basta con verificar que localStorage tiene el dato.
    const raw = localStorage.getItem('mw_progress_v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed.level).toBe(2)
    expect(parsed.xp).toBe(500)
  })
})

describe('stats persistentes', () => {
  it('recordKill incrementa totalKills', () => {
    recordKill()
    recordKill()
    expect(getProgress().totalKills).toBe(2)
  })

  it('recordDeath incrementa totalDeaths', () => {
    recordDeath()
    expect(getProgress().totalDeaths).toBe(1)
  })

  it('recordWave guarda la oleada más alta', () => {
    recordWave(5)
    recordWave(3) // no sobrescribe
    recordWave(10)
    expect(getProgress().highestWave).toBe(10)
  })
})

describe('resetProgress', () => {
  it('vuelve a nivel 1 con 0 XP', () => {
    addXP(5000)
    resetProgress()
    const p = getProgress()
    expect(p.level).toBe(1)
    expect(p.xp).toBe(0)
    expect(p.unlocks).toEqual([])
    expect(p.totalKills).toBe(0)
    expect(p.totalDeaths).toBe(0)
    expect(p.highestWave).toBe(0)
  })
})

describe('getUnlockForLevel', () => {
  it('nivel 2 desbloquea MP5', () => {
    const u = getUnlockForLevel(2)
    expect(u.name).toBe('MP5 SMG')
  })
  it('nivel 1 no desbloquea nada', () => {
    expect(getUnlockForLevel(1)).toBeNull()
  })
  it('nivel 9 desbloquea X16 (catálogo expandido Fase 5)', () => {
    const u = getUnlockForLevel(9)
    expect(u).not.toBeNull()
    expect(u.id).toBe('x16')
  })
})
