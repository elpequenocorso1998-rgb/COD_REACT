/* =========================================================================
   Touch controls para móvil.
   --------------------------------------------------------------------------
   - Virtual sticks (move + look).
   - Fire buttons (primary, ADS, lethal, tactical).
   - Gestures (swipe knife, drag grenade arc).
   - Gyro aim (con toggle).
   - Aim assist agresivo (rotation + slowdown).
   ========================================================================= */

export const TOUCH_ACTIONS = {
  MOVE: 'move',
  LOOK: 'look',
  FIRE: 'fire',
  ADS: 'ads',
  RELOAD: 'reload',
  JUMP: 'jump',
  CROUCH: 'crouch',
  SPRINT: 'sprint',
  PRONE: 'prone',
  LEAN_LEFT: 'lean_left',
  LEAN_RIGHT: 'lean_right',
  TACTICAL: 'tactical',
  LETHAL: 'lethal',
  MELEE: 'melee',
  INTERACT: 'interact',
  SWITCH_WEAPON: 'switch_weapon'
}

export function createTouchControls(container) {
  const state = {
    enabled: false,
    moveVector: { x: 0, y: 0 },
    lookVector: { x: 0, y: 0 },
    firing: false,
    aiming: false,
    gyroEnabled: false,
    gyroSensitivity: 0.5,
    aimAssistStrength: 0.7
  }

  const callbacks = {}
  const elements = []
  let moveStart = null
  let lookStart = null
  let moveId = null
  let lookId = null

  function on(action, fn) {
    callbacks[action] = fn
  }

  function emit(action, data) {
    if (callbacks[action]) callbacks[action](data)
  }

  function createButton(id, label, x, y, w, h, action, isToggle = false) {
    const btn = document.createElement('div')
    btn.id = `tc-${id}`
    btn.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: ${y}%;
      width: ${w}%;
      height: ${h}%;
      background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-family: sans-serif;
      user-select: none;
      touch-action: none;
      z-index: 1000;
    `
    btn.textContent = label
    let active = false
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault()
      active = true
      btn.style.background = 'rgba(255,255,255,0.4)'
      if (isToggle) {
        emit(action, !state[action.toLowerCase()])
      } else {
        emit(action, true)
      }
    })
    btn.addEventListener('touchend', (e) => {
      e.preventDefault()
      active = false
      btn.style.background = 'rgba(255,255,255,0.15)'
      if (!isToggle) emit(action, false)
    })
    container.appendChild(btn)
    elements.push(btn)
    return btn
  }

  function createStick(id, x, y, size, action) {
    const stick = document.createElement('div')
    stick.id = `tc-${id}`
    stick.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: ${y}%;
      width: ${size}%;
      height: ${size}%;
      background: rgba(255,255,255,0.08);
      border: 2px solid rgba(255,255,255,0.25);
      border-radius: 50%;
      touch-action: none;
      z-index: 999;
    `
    const knob = document.createElement('div')
    knob.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      width: 40%;
      height: 40%;
      background: rgba(255,255,255,0.4);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `
    stick.appendChild(knob)
    container.appendChild(stick)
    elements.push(stick)

    const rect = () => stick.getBoundingClientRect()

    stick.addEventListener('touchstart', (e) => {
      e.preventDefault()
      const t = e.changedTouches[0]
      const r = rect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      if (action === TOUCH_ACTIONS.MOVE) {
        moveStart = { x: cx, y: cy }
        moveId = t.identifier
      } else {
        lookStart = { x: cx, y: cy }
        lookId = t.identifier
      }
    })

    stick.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (action === TOUCH_ACTIONS.MOVE && t.identifier === moveId && moveStart) {
          const dx = t.clientX - moveStart.x
          const dy = t.clientY - moveStart.y
          const r = rect()
          const maxDist = r.width / 2
          const mag = Math.sqrt(dx * dx + dy * dy)
          const clamped = Math.min(mag, maxDist)
          const angle = Math.atan2(dy, dx)
          state.moveVector = {
            x: Math.cos(angle) * (clamped / maxDist),
            y: Math.sin(angle) * (clamped / maxDist)
          }
          knob.style.left = `${50 + (state.moveVector.x * 30)}%`
          knob.style.top = `${50 + (state.moveVector.y * 30)}%`
          emit(TOUCH_ACTIONS.MOVE, state.moveVector)
        } else if (action === TOUCH_ACTIONS.LOOK && t.identifier === lookId && lookStart) {
          const dx = t.clientX - lookStart.x
          const dy = t.clientY - lookStart.y
          state.lookVector = { x: dx, y: dy }
          emit(TOUCH_ACTIONS.LOOK, state.lookVector)
          lookStart = { x: t.clientX, y: t.clientY }
        }
      }
    })

    stick.addEventListener('touchend', (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (action === TOUCH_ACTIONS.MOVE && t.identifier === moveId) {
          state.moveVector = { x: 0, y: 0 }
          knob.style.left = '50%'
          knob.style.top = '50%'
          emit(TOUCH_ACTIONS.MOVE, state.moveVector)
          moveId = null
          moveStart = null
        } else if (action === TOUCH_ACTIONS.LOOK && t.identifier === lookId) {
          state.lookVector = { x: 0, y: 0 }
          lookId = null
          lookStart = null
        }
      }
    })

    return stick
  }

  function enable() {
    if (state.enabled) return
    state.enabled = true
    createStick('move', 2, 60, 25, TOUCH_ACTIONS.MOVE)
    createStick('look', 73, 60, 25, TOUCH_ACTIONS.LOOK)
    createButton('fire', 'FIRE', 80, 75, 15, 15, TOUCH_ACTIONS.FIRE)
    createButton('ads', 'ADS', 70, 78, 12, 12, TOUCH_ACTIONS.ADS)
    createButton('reload', 'R', 88, 65, 8, 8, TOUCH_ACTIONS.RELOAD)
    createButton('jump', 'J', 80, 60, 8, 8, TOUCH_ACTIONS.JUMP)
    createButton('crouch', 'C', 70, 88, 8, 8, TOUCH_ACTIONS.CROUCH, true)
    createButton('sprint', 'S', 60, 88, 8, 8, TOUCH_ACTIONS.SPRINT)
    createButton('tactical', 'T', 5, 50, 8, 8, TOUCH_ACTIONS.TACTICAL)
    createButton('lethal', 'L', 12, 55, 8, 8, TOUCH_ACTIONS.LETHAL)
    createButton('melee', 'M', 88, 88, 8, 8, TOUCH_ACTIONS.MELEE)
  }

  function disable() {
    state.enabled = false
    elements.forEach((el) => el.remove())
    elements.length = 0
  }

  function isEnabled() {
    return state.enabled
  }

  function getState() {
    return { ...state }
  }

  function setGyro(enabled) {
    state.gyroEnabled = enabled
    if (enabled && typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleGyro)
    } else if (!enabled && typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', handleGyro)
    }
  }

  function handleGyro(e) {
    if (!state.gyroEnabled) return
    if (e.beta !== null && e.gamma !== null) {
      const yaw = (e.gamma || 0) * state.gyroSensitivity * 0.01
      const pitch = (e.beta || 0) * state.gyroSensitivity * 0.01
      emit(TOUCH_ACTIONS.LOOK, { x: yaw, y: pitch })
    }
  }

  function setGyroSensitivity(s) {
    state.gyroSensitivity = s
  }

  function setAimAssist(s) {
    state.aimAssistStrength = Math.max(0, Math.min(1, s))
  }

  function dispose() {
    disable()
    if (state.gyroEnabled) setGyro(false)
  }

  return {
    on,
    enable,
    disable,
    isEnabled,
    getState,
    setGyro,
    setGyroSensitivity,
    setAimAssist,
    dispose
  }
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0)
}

export function isMobile() {
  if (typeof window === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export const INPUT_TYPES = {
  MNK: 'mnk',
  CONTROLLER: 'controller',
  TOUCH: 'touch'
}

export function detectInputType() {
  if (isTouchDevice()) return INPUT_TYPES.TOUCH
  if (typeof navigator !== 'undefined' && navigator.getGamepads) {
    const pads = navigator.getGamepads()
    for (const p of pads) {
      if (p) return INPUT_TYPES.CONTROLLER
    }
  }
  return INPUT_TYPES.MNK
}

export const MATCHMAKING_POOLS = {
  mnk_only: { name: 'MnK Only', inputs: [INPUT_TYPES.MNK] },
  controller_only: { name: 'Controller Only', inputs: [INPUT_TYPES.CONTROLLER] },
  mixed: { name: 'Mixed', inputs: [INPUT_TYPES.MNK, INPUT_TYPES.CONTROLLER, INPUT_TYPES.TOUCH] },
  touch_only: { name: 'Touch Only', inputs: [INPUT_TYPES.TOUCH] }
}

export function getMatchmakingPool(crossplayEnabled, inputType) {
  if (!crossplayEnabled) {
    if (inputType === INPUT_TYPES.TOUCH) return MATCHMAKING_POOLS.touch_only
    if (inputType === INPUT_TYPES.CONTROLLER) return MATCHMAKING_POOLS.controller_only
    return MATCHMAKING_POOLS.mnk_only
  }
  if (inputType === INPUT_TYPES.TOUCH) return MATCHMAKING_POOLS.touch_only
  return MATCHMAKING_POOLS.mixed
}
