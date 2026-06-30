import { FOV } from './constants.js'
import { DEFAULT_KEYBINDINGS } from './accessibility/index.js'

/* =========================================================================
   Settings — preferencias del jugador persistidas en localStorage.
   --------------------------------------------------------------------------
   FOV, sensibilidad de ratón X/Y, volúmenes master/música/SFX, calidad
   gráfica manual (auto por defecto).
   ========================================================================= */

const SETTINGS_KEY = 'mw_settings_v1'

const DEFAULT_SETTINGS = {
  fov: FOV,
  mouseSensX: 0.0022,
  mouseSensY: 0.0022,
  masterVolume: 0.5,
  musicVolume: 0.4,
  sfxVolume: 0.7,
  quality: 'auto', // 'auto' | 'low' | 'medium' | 'high'
  colorblind: 'off', // 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  aimAssist: 0.0, // 0..1
  showFps: false,
  keybindings: { ...DEFAULT_KEYBINDINGS }
}

let _settings = null

export function getSettings() {
  if (_settings) return _settings
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { _settings = null }
  if (!_settings) _settings = { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } }
  return _settings
}

export function saveSettings(settings) {
  _settings = { ...getSettings(), ...settings }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings))
  } catch (e) { /* localStorage puede no estar disponible */ }
  return _settings
}

export function resetSettings() {
  _settings = { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings))
  } catch (e) {}
  return _settings
}
