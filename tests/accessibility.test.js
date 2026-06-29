import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const _localStorage = (() => {
  let store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} }
  }
})()

globalThis.localStorage = _localStorage

import { resetSettings } from '../src/game/settings.js'
import {
  COLORBLIND_TYPES,
  SUBTITLE_SIZES,
  MOTION_SICKNESS_PRESETS,
  DEFAULT_KEYBINDINGS,
  createAccessibilityManager
} from '../src/game/accessibility/index.js'

describe('accessibility — config', () => {
  it('COLORBLIND_TYPES tiene 4 tipos', () => {
    expect(Object.keys(COLORBLIND_TYPES).length).toBe(4)
    expect(COLORBLIND_TYPES.off.matrix.length).toBe(9)
    expect(COLORBLIND_TYPES.protan.matrix.length).toBe(9)
    expect(COLORBLIND_TYPES.deutan.matrix.length).toBe(9)
    expect(COLORBLIND_TYPES.tritan.matrix.length).toBe(9)
  })

  it('SUBTITLE_SIZES tiene 4 tamaños', () => {
    expect(Object.keys(SUBTITLE_SIZES).length).toBe(4)
    expect(SUBTITLE_SIZES.small).toBeLessThan(SUBTITLE_SIZES.large)
  })

  it('MOTION_SICKNESS_PRESETS tiene 4 niveles', () => {
    expect(Object.keys(MOTION_SICKNESS_PRESETS).length).toBe(4)
    expect(MOTION_SICKNESS_PRESETS.severe.bob).toBe(0)
    expect(MOTION_SICKNESS_PRESETS.off.bob).toBe(1.0)
  })

  it('DEFAULT_KEYBINDINGS tiene 25+ bindings', () => {
    expect(Object.keys(DEFAULT_KEYBINDINGS).length).toBeGreaterThanOrEqual(25)
    expect(DEFAULT_KEYBINDINGS.forward).toBe('KeyW')
    expect(DEFAULT_KEYBINDINGS.fire).toBe('Mouse0')
  })
})

describe('createAccessibilityManager', () => {
  let am

  beforeEach(() => {
    _localStorage.clear()
    resetSettings()
    am = createAccessibilityManager()
  })

  afterEach(() => {
    am.dispose()
    _localStorage.clear()
    resetSettings()
  })

  it('factory devuelve API completa', () => {
    expect(typeof am.setColorblind).toBe('function')
    expect(typeof am.getColorblind).toBe('function')
    expect(typeof am.addSubtitle).toBe('function')
    expect(typeof am.getSubtitles).toBe('function')
    expect(typeof am.remapKey).toBe('function')
    expect(typeof am.setMotionSickness).toBe('function')
    expect(typeof am.setAimAssist).toBe('function')
    expect(typeof am.setFOV).toBe('function')
  })

  it('setColorblind / getColorblind', () => {
    am.setColorblind('protan')
    expect(am.getColorblind()).toBe('protan')
  })

  it('addSubtitle añade subtítulo', () => {
    am.addSubtitle('Hello world', { duration: 1000 })
    const subs = am.getSubtitles()
    expect(subs.length).toBe(1)
    expect(subs[0].text).toBe('Hello world')
  })

  it('removeSubtitle elimina por id', () => {
    const sub = am.addSubtitle('Test', { duration: 5000 })
    am.removeSubtitle(sub.id)
    expect(am.getSubtitles().length).toBe(0)
  })

  it('onSubtitle callback se llama al añadir', () => {
    const cb = vi.fn()
    am.onSubtitle(cb)
    am.addSubtitle('Test')
    expect(cb).toHaveBeenCalled()
  })

  it('remapKey cambia binding', () => {
    am.remapKey('forward', 'ArrowUp')
    expect(am.getKeybinding('forward')).toBe('ArrowUp')
  })

  it('getKeybindings devuelve todos', () => {
    const bindings = am.getKeybindings()
    expect(bindings.forward).toBe('KeyW')
  })

  it('resetKeybindings restaura defaults', () => {
    am.remapKey('forward', 'ArrowUp')
    am.resetKeybindings()
    expect(am.getKeybinding('forward')).toBe('KeyW')
  })

  it('setAimAssist clampa a [0,1]', () => {
    am.setAimAssist(2)
    expect(am.getAimAssist()).toBe(1)
    am.setAimAssist(-1)
    expect(am.getAimAssist()).toBe(0)
  })

  it('setFOV clampa a [60,120]', () => {
    am.setFOV(200)
    expect(am.getFOV()).toBe(120)
    am.setFOV(30)
    expect(am.getFOV()).toBe(60)
  })

  it('setScreenReader / isScreenReaderEnabled', () => {
    expect(am.isScreenReaderEnabled()).toBe(false)
    am.setScreenReader(true)
    expect(am.isScreenReaderEnabled()).toBe(true)
  })

  it('announce no crashea sin screen reader', () => {
    expect(() => am.announce('test')).not.toThrow()
  })

  it('setMotionSickness aplica preset', () => {
    am.setMotionSickness('severe')
    expect(am.getFOV()).toBe(110)
  })

  it('navigate llama keyboardNavCallback', () => {
    const cb = vi.fn()
    am.setKeyboardNavCallback(cb)
    am.navigate('down')
    expect(cb).toHaveBeenCalledWith('down')
  })

  it('dispose limpia estado', () => {
    am.addSubtitle('Test', { duration: 5000 })
    am.dispose()
    expect(am.getSubtitles().length).toBe(0)
  })
})
