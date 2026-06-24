import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useGameStore, GAME_STATES } from '../src/game/store.js'

/* Tests del store: cubren acciones puras y el fix de timeouts cancelables. */

let store
beforeEach(() => {
  store = useGameStore.getState()
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
