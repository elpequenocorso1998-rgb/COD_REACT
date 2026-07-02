import { describe, it, expect, beforeEach } from 'vitest'
import { createAIController, AI_STATES } from '@/game/enemies/ai'

function makeEnemy(x = 0, z = 0) {
  return {
    group: { position: { x, y: 0, z } },
    ai: null,
    dead: false
  }
}

describe('createAIController — squad blackboard (Fase 18.20)', () => {
  let ai

  beforeEach(() => {
    ai = createAIController(null)
  })

  it('factory expone API completa', () => {
    expect(typeof ai.init).toBe('function')
    expect(typeof ai.update).toBe('function')
    expect(typeof ai.suppress).toBe('function')
    expect(typeof ai.getState).toBe('function')
    expect(typeof ai.sharePlayerPosition).toBe('function')
    expect(typeof ai.getLastKnownPlayerPos).toBe('function')
    expect(typeof ai.getAlertLevel).toBe('function')
    expect(typeof ai.decayAlert).toBe('function')
    expect(typeof ai.updateSquadStats).toBe('function')
    expect(typeof ai.getSquadStats).toBe('function')
  })

  it('init setea estado IA del enemigo', () => {
    const e = makeEnemy()
    ai.init(e)
    expect(e.ai).not.toBeNull()
    expect(e.ai.state).toBe(AI_STATES.ADVANCE)
  })

  it('sharePlayerPosition actualiza lastKnownPlayerPos', () => {
    ai.sharePlayerPosition({ x: 10, y: 0, z: 20 })
    const pos = ai.getLastKnownPlayerPos()
    expect(pos).not.toBeNull()
    expect(pos.x).toBe(10)
    expect(pos.z).toBe(20)
  })

  it('getLastKnownPlayerPos devuelve null si no hay info', () => {
    expect(ai.getLastKnownPlayerPos()).toBeNull()
  })

  it('sharePlayerPosition sube alertLevel', () => {
    expect(ai.getAlertLevel()).toBe(0)
    ai.sharePlayerPosition({ x: 0, y: 0, z: 0 })
    expect(ai.getAlertLevel()).toBeGreaterThan(0)
  })

  it('alertLevel se satura a 1', () => {
    for (let i = 0; i < 10; i++) {
      ai.sharePlayerPosition({ x: 0, y: 0, z: 0 })
    }
    expect(ai.getAlertLevel()).toBeLessThanOrEqual(1)
  })

  it('decayAlert reduce alertLevel', () => {
    ai.sharePlayerPosition({ x: 0, y: 0, z: 0 })
    const before = ai.getAlertLevel()
    ai.decayAlert(2)
    expect(ai.getAlertLevel()).toBeLessThan(before)
  })

  it('decayAlert no baja de 0', () => {
    ai.decayAlert(100)
    expect(ai.getAlertLevel()).toBe(0)
  })

  it('updateSquadStats cuenta reloading y suppressed', () => {
    const enemies = [
      { ai: { state: AI_STATES.RELOAD, suppressTimer: 0 }, dead: false, group: { position: { x: 0, y: 0, z: 0 } } },
      { ai: { state: AI_STATES.ENGAGE, suppressTimer: 1 }, dead: false, group: { position: { x: 0, y: 0, z: 0 } } },
      { ai: { state: AI_STATES.RELOAD, suppressTimer: 2 }, dead: false, group: { position: { x: 0, y: 0, z: 0 } } },
      { ai: null, dead: true, group: { position: { x: 0, y: 0, z: 0 } } }
    ]
    ai.updateSquadStats(enemies)
    const stats = ai.getSquadStats()
    expect(stats.reloading).toBe(2)
    expect(stats.suppressed).toBe(2)
  })

  it('suppress marca al bot como TAKE_COVER', () => {
    const e = makeEnemy()
    ai.init(e)
    ai.suppress(e)
    expect(e.ai.suppressTimer).toBeGreaterThan(0)
  })

  it('getState devuelve ADVANCE si no hay ai inicializado', () => {
    const e = makeEnemy()
    expect(ai.getState(e)).toBe(AI_STATES.ADVANCE)
  })
})
