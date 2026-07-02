import { getSettings, saveSettings } from '@/game/meta/settings'

/* =========================================================================
   Accesibilidad (WCAG 2.1 AA).
   --------------------------------------------------------------------------
   - Subtitles + captions para audio cues.
   - Colorblind modes (protan/deutan/tritan) con matrices de corrección.
   - Input remapping completo.
   - Aim assist slider.
   - FOV slider amplio (60-120).
   - Motion sickness options (bob, blur, FOV).
   - Screen reader hints en UI.
   - Keyboard navigation en UI.
   ========================================================================= */

export const COLORBLIND_TYPES = {
  off: { name: 'Off', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  protan: { name: 'Protanopia', matrix: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758] },
  deutan: { name: 'Deuteranopia', matrix: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7] },
  tritan: { name: 'Tritanopia', matrix: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525] }
}

export const SUBTITLE_SIZES = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24
}

export const MOTION_SICKNESS_PRESETS = {
  off: { fov: 78, bob: 1.0, blur: true, shake: 1.0 },
  mild: { fov: 90, bob: 0.5, blur: false, shake: 0.5 },
  moderate: { fov: 100, bob: 0.2, blur: false, shake: 0.2 },
  severe: { fov: 110, bob: 0, blur: false, shake: 0 }
}

export const DEFAULT_KEYBINDINGS = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'ControlLeft',
  prone: 'KeyZ',
  jump: 'Space',
  mantle: 'KeyF',
  leanLeft: 'KeyQ',
  leanRight: 'KeyE',
  fire: 'Mouse0',
  ads: 'Mouse2',
  reload: 'KeyR',
  switchWeapon: 'KeyY',
  tactical: 'KeyX',
  lethal: 'KeyG',
  smoke: 'KeyC',
  knife: 'KeyB',
  holdBreath: 'KeyV',
  uav: 'Digit4',
  airstrike: 'Digit5',
  heli: 'Digit6',
  gunship: 'Digit7',
  scoreboard: 'Tab',
  pause: 'Escape'
}

export function createAccessibilityManager() {
  let subtitles = []
  let subtitleCallback = null
  let screenReaderEnabled = false
  let keyboardNavCallback = null

  function setColorblind(type) {
    const settings = getSettings()
    settings.colorblind = type
    saveSettings(settings)
    applyColorblindMatrix(type)
  }

  function applyColorblindMatrix(type) {
    const cb = COLORBLIND_TYPES[type] || COLORBLIND_TYPES.off
    if (typeof document === 'undefined') return
    const filter = type === 'off'
      ? 'none'
      : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="cb"><feColorMatrix values="${cb.matrix.join(' ')}"/></filter></svg>#cb')`
    document.documentElement.style.filter = filter
  }

  function getColorblind() {
    return getSettings().colorblind || 'off'
  }

  function addSubtitle(text, { speaker = '', duration = 3000, sound = '' } = {}) {
    const sub = {
      id: Date.now() + Math.random(),
      text,
      speaker,
      sound,
      timestamp: Date.now(),
      duration,
      expiresAt: Date.now() + duration
    }
    subtitles.push(sub)
    if (subtitleCallback) subtitleCallback(sub)
    setTimeout(() => removeSubtitle(sub.id), duration)
    return sub
  }

  function removeSubtitle(id) {
    const idx = subtitles.findIndex((s) => s.id === id)
    if (idx !== -1) subtitles.splice(idx, 1)
  }

  function getSubtitles() {
    const now = Date.now()
    return subtitles.filter((s) => s.expiresAt > now)
  }

  function onSubtitle(fn) {
    subtitleCallback = fn
  }

  function setSubtitleSize(size) {
    if (typeof document === 'undefined') return
    const px = SUBTITLE_SIZES[size] || 16
    document.documentElement.style.setProperty('--subtitle-size', `${px}px`)
  }

  function setScreenReader(enabled) {
    screenReaderEnabled = enabled
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('aria-live', enabled ? 'assertive' : 'off')
  }

  function isScreenReaderEnabled() {
    return screenReaderEnabled
  }

  function announce(message) {
    if (!screenReaderEnabled) return
    if (typeof document === 'undefined') return
    const el = document.createElement('div')
    el.setAttribute('aria-live', 'assertive')
    el.style.position = 'absolute'
    el.style.width = '1px'
    el.style.height = '1px'
    el.style.overflow = 'hidden'
    el.style.clip = 'rect(0,0,0,0)'
    el.textContent = message
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1000)
  }

  function remapKey(action, key) {
    const settings = getSettings()
    if (!settings.keybindings) settings.keybindings = { ...DEFAULT_KEYBINDINGS }
    settings.keybindings[action] = key
    saveSettings(settings)
  }

  function getKeybinding(action) {
    const settings = getSettings()
    const bindings = settings.keybindings || DEFAULT_KEYBINDINGS
    return bindings[action] || DEFAULT_KEYBINDINGS[action]
  }

  function getKeybindings() {
    const settings = getSettings()
    return settings.keybindings || { ...DEFAULT_KEYBINDINGS }
  }

  function resetKeybindings() {
    const settings = getSettings()
    settings.keybindings = { ...DEFAULT_KEYBINDINGS }
    saveSettings(settings)
  }

  function setMotionSickness(preset) {
    const p = MOTION_SICKNESS_PRESETS[preset] || MOTION_SICKNESS_PRESETS.off
    const settings = getSettings()
    settings.fov = p.fov
    settings.motionBob = p.bob
    settings.motionBlur = p.blur
    settings.cameraShake = p.shake
    saveSettings(settings)
  }

  function setAimAssist(value) {
    const settings = getSettings()
    settings.aimAssist = Math.max(0, Math.min(1, value))
    saveSettings(settings)
  }

  function getAimAssist() {
    return getSettings().aimAssist || 0
  }

  function setFOV(fov) {
    const settings = getSettings()
    settings.fov = Math.max(60, Math.min(120, fov))
    saveSettings(settings)
  }

  function getFOV() {
    return getSettings().fov || 78
  }

  function setKeyboardNavCallback(fn) {
    keyboardNavCallback = fn
  }

  function navigate(direction) {
    if (keyboardNavCallback) keyboardNavCallback(direction)
  }

  function dispose() {
    subtitles = []
    subtitleCallback = null
    keyboardNavCallback = null
  }

  return {
    setColorblind,
    getColorblind,
    applyColorblindMatrix,
    addSubtitle,
    removeSubtitle,
    getSubtitles,
    onSubtitle,
    setSubtitleSize,
    setScreenReader,
    isScreenReaderEnabled,
    announce,
    remapKey,
    getKeybinding,
    getKeybindings,
    resetKeybindings,
    setMotionSickness,
    setAimAssist,
    getAimAssist,
    setFOV,
    getFOV,
    setKeyboardNavCallback,
    navigate,
    dispose
  }
}
