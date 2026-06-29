import * as THREE from 'three'

/* =========================================================================
   Animation graph — state machine + blend trees.
   --------------------------------------------------------------------------
   - Estados con animaciones de duración variable y transiciones por
     parámetros (speed, isAiming, isReloading, healthPct, stance).
   - Blend trees para mezclar idle/walk/run por velocidad.
   - Transiciones suaves (crossfade entre acciones N ms).
   - dispose() libera AnimationMixer y actions.
   ========================================================================= */

const STANCES = new Set(['stand', 'crouch', 'prone', 'slide', 'sprint'])

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function createAnimGraph(mesh, clips = []) {
  const mixer = new THREE.AnimationMixer(mesh)
  const actions = new Map()
  const states = new Map()
  let currentState = null
  let pendingState = null
  let transitionT = 0
  let transitionDur = 0.15
  let params = {
    speed: 0,
    isAiming: false,
    isReloading: false,
    isFiring: false,
    healthPct: 1,
    stance: 'stand',
    inAir: false
  }

  for (const clip of clips) {
    const action = mixer.clipAction(clip)
    actions.set(clip.name, action)
  }

  function addState(name, clipName, { loop = THREE.LoopRepeat, timeScale = 1, weight = 1 } = {}) {
    const action = actions.get(clipName)
    if (!action) {
      console.warn(`[anim] clip "${clipName}" no encontrado para estado "${name}"`)
      return
    }
    action.setLoop(loop)
    action.timeScale = timeScale
    action.weight = weight
    states.set(name, { name, action, transitions: [] })
    if (!currentState) {
      currentState = states.get(name)
      action.reset().play()
      action.weight = 1
    }
  }

  function addTransition(from, to, condition, duration = 0.15) {
    const state = states.get(from)
    if (!state) return
    state.transitions.push({ to, condition, duration })
  }

  function setParam(key, value) {
    params[key] = value
  }

  function getParam(key) {
    return params[key]
  }

  function trigger(name, duration = 0.15) {
    const target = states.get(name)
    if (!target) return
    if (currentState && currentState.name === name) {
      target.action.reset().play()
      target.action.weight = 1
      return
    }
    pendingState = target
    transitionDur = duration
    transitionT = 0
  }

  function evaluate() {
    if (!currentState) return
    for (const t of currentState.transitions) {
      if (t.condition(params)) {
        trigger(t.to, t.duration)
        return
      }
    }
  }

  function blendWalk() {
    const speed = params.speed
    const idle = actions.get('idle')
    const walk = actions.get('walk')
    const run = actions.get('run')
    if (!idle || !walk || !run) return
    const walkWeight = clamp01(speed / 2.5)
    const runWeight = clamp01((speed - 2.5) / 3.5)
    const idleWeight = clamp01(1 - walkWeight - runWeight)
    idle.weight = idleWeight
    walk.weight = walkWeight
    run.weight = runWeight
    if (idleWeight > 0 && !idle.isRunning()) idle.play()
    if (walkWeight > 0 && !walk.isRunning()) walk.play()
    if (runWeight > 0 && !run.isRunning()) run.play()
  }

  function update(dt) {
    if (!currentState) return
    evaluate()
    if (pendingState) {
      transitionT += dt
      const t = clamp01(transitionT / transitionDur)
      const fromWeight = 1 - t
      const toWeight = t
      currentState.action.weight = fromWeight
      pendingState.action.weight = toWeight
      if (!pendingState.action.isRunning()) {
        pendingState.action.reset().play()
      }
      if (t >= 1) {
        currentState.action.weight = 0
        currentState.action.stop()
        currentState = pendingState
        pendingState = null
        transitionT = 0
      }
    }
    if (currentState && currentState.name === 'locomotion') {
      blendWalk()
    }
    mixer.update(dt)
  }

  function dispose() {
    actions.forEach((a) => a.stop())
    states.clear()
    actions.clear()
    mixer.uncacheRoot(mesh)
  }

  return {
    addState,
    addTransition,
    setParam,
    getParam,
    trigger,
    update,
    evaluate,
    blendWalk,
    get currentState() { return currentState?.name },
    get params() { return params },
    get mixer() { return mixer },
    dispose
  }
}

export { STANCES }
