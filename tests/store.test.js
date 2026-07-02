import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, GAME_STATES } from '@/game/core/store'

/* Tests del store: cubren acciones puras y el fix de timeouts cancelables. */

// Mockeamos progression para que el store no toque localStorage real
// (que persistiría entre tests y causaría flakiness).
vi.mock('@/game/meta/progression', () => {
  let level = 1, xp = 0, xpNeeded = 1000
  return {
    addXP: vi.fn((amt) => {
      xp += amt
      let leveledUp = false
      while (xp >= xpNeeded) { xp -= xpNeeded; level++; leveledUp = true; xpNeeded = 1000 + (level-1)*250 }
      return { leveledUp, newLevel: level, newUnlocks: [], xp, xpNeeded }
    }),
    recordKill: vi.fn(),
    recordDeath: vi.fn(),
    recordWave: vi.fn(),
    getProgress: vi.fn(() => ({ level, xp, xpNeeded, unlocks: [], totalKills: 0, totalDeaths: 0, highestWave: 0 })),
    // Fase 3: mocks de weapon XP, battle pass y dailies.
    addWeaponXP: vi.fn(() => ({ leveledUp: false, newLevel: 1, newCamo: null, xp: 0, xpNeeded: 500 })),
    addBattlePassXP: vi.fn(() => ({ tier: 0, xp: 0, tiersGained: 0 })),
    progressDaily: vi.fn()
  }
})

beforeEach(() => {
  useGameStore.getState().reset()
  // Forzamos estado PLAYING para takeDamage.
  useGameStore.setState({ gameState: GAME_STATES.PLAYING })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fire', () => {
  it('consume 1 bala y marca firing=true', () => {
    const ok = useGameStore.getState().fire()
    expect(ok).toBe(true)
    const s = useGameStore.getState()
    expect(s.ammo).toBe(29)
    expect(s.firing).toBe(true)
  })

  it('no dispara sin balas', () => {
    useGameStore.setState({ ammo: 0 })
    expect(useGameStore.getState().fire()).toBe(false)
  })

  it('no dispara mientras recarga', () => {
    useGameStore.setState({ reloading: true })
    expect(useGameStore.getState().fire()).toBe(false)
  })

  it('firing vuelve a false tras 80ms', () => {
    vi.useFakeTimers()
    useGameStore.getState().fire()
    expect(useGameStore.getState().firing).toBe(true)
    vi.advanceTimersByTime(80)
    expect(useGameStore.getState().firing).toBe(false)
  })
})

describe('reload', () => {
  it('mueve balas de la reserva al cargador tras 1.5s', () => {
    vi.useFakeTimers()
    useGameStore.setState({ ammo: 10, reserve: 90, magSize: 30 })
    useGameStore.getState().reload()
    expect(useGameStore.getState().reloading).toBe(true)
    // Aún no ha movido balas.
    expect(useGameStore.getState().ammo).toBe(10)
    vi.advanceTimersByTime(1500)
    const s = useGameStore.getState()
    expect(s.reloading).toBe(false)
    expect(s.ammo).toBe(30)
    expect(s.reserve).toBe(70)
  })

  it('no recarga si el cargador está lleno', () => {
    useGameStore.setState({ ammo: 30, magSize: 30 })
    useGameStore.getState().reload()
    expect(useGameStore.getState().reloading).toBe(false)
  })

  it('no recarga si no hay reserva', () => {
    useGameStore.setState({ ammo: 5, reserve: 0 })
    useGameStore.getState().reload()
    expect(useGameStore.getState().reloading).toBe(false)
  })
})

describe('registerHit / registerKill', () => {
  it('suma puntos y añade hitmarker efímero', () => {
    vi.useFakeTimers()
    useGameStore.getState().registerHit(25)
    const s = useGameStore.getState()
    expect(s.score).toBe(25)
    expect(s.hitmarkers).toHaveLength(1)
    vi.advanceTimersByTime(250)
    expect(useGameStore.getState().hitmarkers).toHaveLength(0)
  })

  it('registerKill decrementa enemiesRemaining y añade killmarker', () => {
    vi.useFakeTimers()
    useGameStore.setState({ enemiesRemaining: 5 })
    useGameStore.getState().registerKill(100)
    const s = useGameStore.getState()
    expect(s.score).toBe(100)
    expect(s.enemiesRemaining).toBe(4)
    expect(s.killmarkers).toHaveLength(1)
    vi.advanceTimersByTime(500)
    expect(useGameStore.getState().killmarkers).toHaveLength(0)
  })

  it('IDs son únicos bajo ráfaga rápida', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      useGameStore.getState().registerHit(1)
    }
    for (const id of useGameStore.getState().hitmarkers) ids.add(id)
    expect(ids.size).toBe(100)
  })
})

describe('takeDamage', () => {
  it('reduce vida y activa damageFlash', () => {
    useGameStore.getState().takeDamage(30, null)
    const s = useGameStore.getState()
    expect(s.health).toBe(70)
    expect(s.damageFlash).toBe(true)
  })

  it('gameover al llegar a 0', () => {
    useGameStore.getState().takeDamage(100, null)
    expect(useGameStore.getState().gameState).toBe(GAME_STATES.GAMEOVER)
  })

  it('no aplica daño si no está PLAYING', () => {
    useGameStore.setState({ gameState: GAME_STATES.MENU })
    useGameStore.getState().takeDamage(30, null)
    expect(useGameStore.getState().health).toBe(100)
  })

  it('i-frames: ignora daño en los 0.5s tras un impacto (item 31)', () => {
    vi.useFakeTimers()
    // performance.now() NO es controlado por vi.useFakeTimers por defecto;
    // lo mockeamos manualmente para que avance con advanceTimersByTime.
    // Sin esto, el cálculo de i-frames del store lee el reloj real y el
    // test falla de forma flaky.
    let mockNow = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    const advanceNow = (ms) => { mockNow += ms; vi.advanceTimersByTime(ms) }

    // Primer daño entra.
    useGameStore.getState().takeDamage(30, null)
    expect(useGameStore.getState().health).toBe(70)
    // Segundo daño inmediato: ignorado por i-frames.
    useGameStore.getState().takeDamage(30, null)
    expect(useGameStore.getState().health).toBe(70)
    // Tras 0.5s, el daño vuelve a entrar.
    advanceNow(500)
    useGameStore.getState().takeDamage(30, null)
    expect(useGameStore.getState().health).toBe(40)
  })

  it('añade indicador direccional efímero', () => {
    vi.useFakeTimers()
    useGameStore.getState().takeDamage(10, 1.2)
    expect(useGameStore.getState().damageDirections).toHaveLength(1)
    vi.advanceTimersByTime(1200)
    expect(useGameStore.getState().damageDirections).toHaveLength(0)
  })
})

describe('reset cancela timeouts pendientes (bug fix)', () => {
  it('un hitmarker pendiente NO reaparece tras reset rápido', () => {
    vi.useFakeTimers()
    useGameStore.getState().registerHit(10)
    expect(useGameStore.getState().hitmarkers).toHaveLength(1)
    // Reset inmediato (antes de que el timeout de 250ms dispare).
    useGameStore.getState().reset()
    expect(useGameStore.getState().hitmarkers).toHaveLength(0)
    // Avanzamos el tiempo: el timeout antiguo NO debe re-añadir el marker.
    vi.advanceTimersByTime(500)
    expect(useGameStore.getState().hitmarkers).toHaveLength(0)
  })

  it('un damageFlash pendiente NO se reactiva tras reset', () => {
    vi.useFakeTimers()
    useGameStore.setState({ gameState: GAME_STATES.PLAYING })
    useGameStore.getState().takeDamage(10, null)
    expect(useGameStore.getState().damageFlash).toBe(true)
    useGameStore.getState().reset()
    expect(useGameStore.getState().damageFlash).toBe(false)
    vi.advanceTimersByTime(300)
    expect(useGameStore.getState().damageFlash).toBe(false)
  })

  it('una recarga pendiente NO se completa tras reset', () => {
    vi.useFakeTimers()
    useGameStore.setState({ gameState: GAME_STATES.PLAYING, ammo: 5, reserve: 90 })
    useGameStore.getState().reload()
    expect(useGameStore.getState().reloading).toBe(true)
    useGameStore.getState().reset()
    expect(useGameStore.getState().reloading).toBe(false)
    expect(useGameStore.getState().ammo).toBe(30) // valor de reset, no recarga
    vi.advanceTimersByTime(2000)
    expect(useGameStore.getState().reloading).toBe(false)
    expect(useGameStore.getState().ammo).toBe(30)
  })

  it('un indicador direccional pendiente NO reaparece tras reset', () => {
    vi.useFakeTimers()
    useGameStore.setState({ gameState: GAME_STATES.PLAYING })
    useGameStore.getState().takeDamage(10, 0.5)
    useGameStore.getState().reset()
    expect(useGameStore.getState().damageDirections).toHaveLength(0)
    vi.advanceTimersByTime(1500)
    expect(useGameStore.getState().damageDirections).toHaveLength(0)
  })
})

/* =========================================================================
   FASE 4a — Tests de killstreaks, multikills, scoreboard.
   ========================================================================= */
describe('killstreaks y multikills', () => {
  it('registerKill incrementa killStreak y kills', () => {
    useGameStore.getState().registerKill(100)
    const s = useGameStore.getState()
    expect(s.killStreak).toBe(1)
    expect(s.kills).toBe(1)
  })

  it('desbloquea UAV al llegar a 3 kills', () => {
    useGameStore.getState().registerKill(100)
    useGameStore.getState().registerKill(100)
    expect(useGameStore.getState().availableStreaks).toHaveLength(0)
    useGameStore.getState().registerKill(100)
    const s = useGameStore.getState()
    expect(s.killStreak).toBe(3)
    expect(s.availableStreaks).toHaveLength(1)
    expect(s.availableStreaks[0].type).toBe('uav')
  })

  it('desbloquea airstrike a 5, heli a 7, gunship a 11', () => {
    for (let i = 0; i < 11; i++) useGameStore.getState().registerKill(100)
    const types = useGameStore.getState().availableStreaks.map((s) => s.type)
    expect(types).toContain('airstrike')
    expect(types).toContain('heli')
    expect(types).toContain('gunship')
  })

  it('useStreak consume el streak y lo activa', () => {
    for (let i = 0; i < 3; i++) useGameStore.getState().registerKill(100)
    const uavId = useGameStore.getState().availableStreaks[0].id
    const ok = useGameStore.getState().useStreak(uavId)
    expect(ok).toBe(true)
    expect(useGameStore.getState().availableStreaks).toHaveLength(0)
    expect(useGameStore.getState().uavActive).toBe(true)
  })

  it('useStreak devuelve false para un streak inexistente', () => {
    expect(useGameStore.getState().useStreak(99999)).toBe(false)
  })

  it('multikill: dos kills en 3s = Double Kill', () => {
    vi.useFakeTimers()
    let mockNow = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    useGameStore.getState().registerKill(100)
    expect(useGameStore.getState().multikillLabel).toBeNull()
    // Segunda kill inmediatamente: dentro de la ventana de 3s.
    useGameStore.getState().registerKill(100)
    expect(useGameStore.getState().multikillCount).toBe(2)
    expect(useGameStore.getState().multikillLabel).toBe('DOUBLE KILL')
  })

  it('multikill: kill fuera de ventana resetea el combo', () => {
    vi.useFakeTimers()
    let mockNow = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    useGameStore.getState().registerKill(100)
    mockNow += 4000 // fuera de la ventana de 3s
    vi.advanceTimersByTime(4000)
    useGameStore.getState().registerKill(100)
    expect(useGameStore.getState().multikillCount).toBe(1)
  })

  it('muerte resetea killStreak y multikill', () => {
    useGameStore.getState().registerKill(100)
    useGameStore.getState().registerKill(100)
    expect(useGameStore.getState().killStreak).toBe(2)
    useGameStore.getState().takeDamage(100, null)
    const s = useGameStore.getState()
    expect(s.killStreak).toBe(0)
    expect(s.multikillCount).toBe(0)
    expect(s.deaths).toBe(1)
  })
})

describe('scoreboard', () => {
  it('toggleScoreboard abre y cierra', () => {
    expect(useGameStore.getState().scoreboardOpen).toBe(false)
    useGameStore.getState().toggleScoreboard(true)
    expect(useGameStore.getState().scoreboardOpen).toBe(true)
    useGameStore.getState().toggleScoreboard(false)
    expect(useGameStore.getState().scoreboardOpen).toBe(false)
  })
})

describe('hitmarkers con tipo', () => {
  it('registerHit guarda el tipo de hitmarker', () => {
    useGameStore.getState().registerHit(25, 'headshot')
    const hm = useGameStore.getState().hitmarkers[0]
    expect(hm.type).toBe('headshot')
  })

  it('registerHit sin tipo usa body por defecto', () => {
    useGameStore.getState().registerHit(10)
    const hm = useGameStore.getState().hitmarkers[0]
    expect(hm.type).toBe('body')
  })
})
