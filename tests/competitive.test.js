import { describe, it, expect, vi } from 'vitest'
import {
  SPECTATOR_MODES,
  createSpectator,
  createTheater
} from '../src/game/competitive/spectator.js'
import {
  TOUCH_ACTIONS,
  INPUT_TYPES,
  MATCHMAKING_POOLS,
  createTouchControls,
  isTouchDevice,
  isMobile,
  detectInputType,
  getMatchmakingPool
} from '../src/game/input/touch-controls.js'

describe('spectator.js', () => {
  it('SPECTATOR_MODES tiene 4 modos', () => {
    expect(Object.keys(SPECTATOR_MODES).length).toBe(4)
    expect(SPECTATOR_MODES.FREE).toBe('free')
    expect(SPECTATOR_MODES.FOLLOW_FIRST).toBe('follow_first')
    expect(SPECTATOR_MODES.FOLLOW_THIRD).toBe('follow_third')
    expect(SPECTATOR_MODES.DIRECTOR).toBe('director')
  })

  it('createSpectator devuelve API completa', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })), lookAt: vi.fn() }
    const scene = {}
    const spec = createSpectator(cam, scene)
    expect(typeof spec.setMode).toBe('function')
    expect(typeof spec.update).toBe('function')
    expect(typeof spec.setXray).toBe('function')
    expect(typeof spec.nextTarget).toBe('function')
    spec.dispose()
  })

  it('setMode / getMode', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })), lookAt: vi.fn() }
    const spec = createSpectator(cam, {})
    spec.setMode(SPECTATOR_MODES.FOLLOW_FIRST)
    expect(spec.getMode()).toBe(SPECTATOR_MODES.FOLLOW_FIRST)
    spec.dispose()
  })

  it('setXray / isXrayEnabled', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })), lookAt: vi.fn() }
    const spec = createSpectator(cam, {})
    expect(spec.isXrayEnabled()).toBe(false)
    spec.setXray(true)
    expect(spec.isXrayEnabled()).toBe(true)
    spec.dispose()
  })

  it('setTargets asigna lista de jugadores', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })), lookAt: vi.fn() }
    const spec = createSpectator(cam, {})
    spec.setTargets([{ id: 1, pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 }])
    expect(spec.getTargetId()).toBe(1)
    spec.dispose()
  })

  it('update no crashea en modo FREE sin keys', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn(), add: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn(), lengthSq: () => 0 })), lookAt: vi.fn() }
    const spec = createSpectator(cam, {})
    spec.setMode(SPECTATOR_MODES.FREE)
    expect(() => spec.update(0.016)).not.toThrow()
    spec.dispose()
  })

  it('setSpeed / getSpeed', () => {
    const cam = { position: { set: vi.fn(), copy: vi.fn(), lerp: vi.fn() }, rotation: { set: vi.fn() }, getWorldDirection: vi.fn(() => ({ normalize: vi.fn() })), lookAt: vi.fn() }
    const spec = createSpectator(cam, {})
    spec.setSpeed(50)
    expect(spec.getSpeed()).toBe(50)
    spec.dispose()
  })
})

describe('theater.js', () => {
  it('createTheater devuelve API completa', () => {
    const t = createTheater()
    expect(typeof t.startRecording).toBe('function')
    expect(typeof t.recordFrame).toBe('function')
    expect(typeof t.stopRecording).toBe('function')
    expect(typeof t.playDemo).toBe('function')
    expect(typeof t.updatePlayback).toBe('function')
    expect(typeof t.isRecording).toBe('function')
    expect(typeof t.isPlaying).toBe('function')
  })

  it('startRecording / isRecording', () => {
    const t = createTheater()
    expect(t.isRecording()).toBe(false)
    t.startRecording({ map: 'desert' })
    expect(t.isRecording()).toBe(true)
  })

  it('recordFrame guarda frames', () => {
    const t = createTheater()
    t.startRecording()
    t.recordFrame({ pos: { x: 1, y: 0, z: 0 } })
    t.recordFrame({ pos: { x: 2, y: 0, z: 0 } })
    const demo = t.stopRecording()
    expect(demo.frames.length).toBe(2)
    expect(demo.duration).toBeGreaterThanOrEqual(0)
  })

  it('stopRecording devuelve null si no hay recording', () => {
    const t = createTheater()
    expect(t.stopRecording()).toBeNull()
  })

  it('playDemo devuelve false para demo inexistente', () => {
    const t = createTheater()
    expect(t.playDemo(99999)).toBe(false)
  })

  it('playDemo reproduce demo grabado', () => {
    const t = createTheater()
    t.startRecording()
    t.recordFrame({ pos: { x: 1 } })
    const demo = t.stopRecording()
    expect(t.playDemo(demo.id)).toBe(true)
    expect(t.isPlaying()).toBe(true)
  })

  it('stopPlayback limpia el estado', () => {
    const t = createTheater()
    t.startRecording()
    t.recordFrame({ pos: { x: 1 } })
    const demo = t.stopRecording()
    t.playDemo(demo.id)
    t.stopPlayback()
    expect(t.isPlaying()).toBe(false)
  })

  it('setPlaySpeed / getPlaySpeed', () => {
    const t = createTheater()
    t.setPlaySpeed(2.0)
    expect(t.getPlaySpeed()).toBe(2.0)
  })

  it('deleteDemo elimina el demo', () => {
    const t = createTheater()
    t.startRecording()
    const demo = t.stopRecording()
    t.deleteDemo(demo.id)
    expect(t.getDemos().length).toBe(0)
  })

  it('clearDemos elimina todos', () => {
    const t = createTheater()
    t.startRecording()
    t.stopRecording()
    t.startRecording()
    t.stopRecording()
    t.clearDemos()
    expect(t.getDemos().length).toBe(0)
  })
})

describe('touch-controls.js', () => {
  it('TOUCH_ACTIONS tiene 16 acciones', () => {
    expect(Object.keys(TOUCH_ACTIONS).length).toBe(16)
  })

  it('INPUT_TYPES tiene 3 tipos', () => {
    expect(Object.keys(INPUT_TYPES).length).toBe(3)
    expect(INPUT_TYPES.MNK).toBe('mnk')
    expect(INPUT_TYPES.CONTROLLER).toBe('controller')
    expect(INPUT_TYPES.TOUCH).toBe('touch')
  })

  it('MATCHMAKING_POOLS tiene 4 pools', () => {
    expect(Object.keys(MATCHMAKING_POOLS).length).toBe(4)
  })

  it('getMatchmakingPool sin crossplay = pool por input', () => {
    expect(getMatchmakingPool(false, INPUT_TYPES.MNK).name).toBe('MnK Only')
    expect(getMatchmakingPool(false, INPUT_TYPES.CONTROLLER).name).toBe('Controller Only')
    expect(getMatchmakingPool(false, INPUT_TYPES.TOUCH).name).toBe('Touch Only')
  })

  it('getMatchmakingPool con crossplay = mixed (excepto touch)', () => {
    expect(getMatchmakingPool(true, INPUT_TYPES.MNK).name).toBe('Mixed')
    expect(getMatchmakingPool(true, INPUT_TYPES.CONTROLLER).name).toBe('Mixed')
    expect(getMatchmakingPool(true, INPUT_TYPES.TOUCH).name).toBe('Touch Only')
  })

  it('createTouchControls devuelve API completa', () => {
    const fakeContainer = { appendChild: vi.fn() }
    const tc = createTouchControls(fakeContainer)
    expect(typeof tc.on).toBe('function')
    expect(typeof tc.enable).toBe('function')
    expect(typeof tc.disable).toBe('function')
    expect(typeof tc.setGyro).toBe('function')
    expect(typeof tc.setAimAssist).toBe('function')
    tc.dispose()
  })

  it('enable/disable togglean estado', () => {
    const fakeContainer = { appendChild: vi.fn() }
    const tc = createTouchControls(fakeContainer)
    expect(tc.isEnabled()).toBe(false)
    tc.enable()
    expect(tc.isEnabled()).toBe(true)
    tc.disable()
    expect(tc.isEnabled()).toBe(false)
    tc.dispose()
  })

  it('setAimAssist clampa a [0,1]', () => {
    const fakeContainer = { appendChild: vi.fn() }
    const tc = createTouchControls(fakeContainer)
    tc.setAimAssist(2)
    expect(tc.getState().aimAssistStrength).toBe(1)
    tc.setAimAssist(-1)
    expect(tc.getState().aimAssistStrength).toBe(0)
    tc.dispose()
  })

  it('isTouchDevice devuelve bool', () => {
    expect(typeof isTouchDevice()).toBe('boolean')
  })

  it('isMobile devuelve bool', () => {
    expect(typeof isMobile()).toBe('boolean')
  })

  it('detectInputType devuelve un tipo válido', () => {
    const t = detectInputType()
    expect([INPUT_TYPES.MNK, INPUT_TYPES.CONTROLLER, INPUT_TYPES.TOUCH]).toContain(t)
  })
})
