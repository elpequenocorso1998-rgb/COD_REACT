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
