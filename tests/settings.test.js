import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSettings, saveSettings, resetSettings } from '../src/game/settings.js'

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettings()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('devuelve settings por defecto', () => {
    const s = getSettings()
    expect(s.fov).toBe(78)
    expect(s.mouseSensX).toBe(0.0022)
    expect(s.quality).toBe('auto')
    expect(s.colorblind).toBe('off')
  })

  it('incluye keybindings por defecto (Fase 18.2)', () => {
    const s = getSettings()
    expect(s.keybindings).toBeDefined()
    expect(s.keybindings.forward).toBe('KeyW')
    expect(s.keybindings.fire).toBe('Mouse0')
    expect(Object.keys(s.keybindings).length).toBeGreaterThanOrEqual(25)
  })

  it('saveSettings persiste keybindings', () => {
    saveSettings({ keybindings: { ...getSettings().keybindings, forward: 'ArrowUp' } })
    const s = getSettings()
    expect(s.keybindings.forward).toBe('ArrowUp')
  })

  it('saveSettings persiste cambios', () => {
    saveSettings({ fov: 95, masterVolume: 0.3 })
    const s = getSettings()
    expect(s.fov).toBe(95)
    expect(s.masterVolume).toBe(0.3)
  })

  it('saveSettings mergea con existentes', () => {
    saveSettings({ fov: 90 })
    saveSettings({ masterVolume: 0.5 })
    const s = getSettings()
    expect(s.fov).toBe(90)
    expect(s.masterVolume).toBe(0.5)
  })

  it('resetSettings vuelve a defaults', () => {
    saveSettings({ fov: 110, quality: 'low' })
    resetSettings()
    const s = getSettings()
    expect(s.fov).toBe(78)
    expect(s.quality).toBe('auto')
  })

  it('persiste en localStorage', () => {
    saveSettings({ fov: 100 })
    const raw = localStorage.getItem('mw_settings_v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed.fov).toBe(100)
  })
})
