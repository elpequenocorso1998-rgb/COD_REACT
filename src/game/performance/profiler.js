/* =========================================================================
   Performance: profiling, LOD, streaming, memory budget.
   --------------------------------------------------------------------------
   - Frame profiler (FPS, frame time, draw calls, memory).
   - LOD system (geometry + material por distancia).
   - Memory tracker (budget mobile < 1GB, desktop < 4GB).
   - Frame budget target (mobile 33ms, desktop 8ms).
   ========================================================================= */

export const PERF_BUDGETS = {
  mobile: { frameTime: 33, memory: 1024, drawCalls: 200 },
  desktop: { frameTime: 8, memory: 4096, drawCalls: 2000 },
  console: { frameTime: 16, memory: 5120, drawCalls: 3000 }
}

export const LOD_LEVELS = {
  HIGH: { distance: 0, segments: 32, shadowCast: true, shadowReceive: true },
  MEDIUM: { distance: 30, segments: 16, shadowCast: true, shadowReceive: true },
  LOW: { distance: 60, segments: 8, shadowCast: false, shadowReceive: true },
  IMPOSTOR: { distance: 100, segments: 4, shadowCast: false, shadowReceive: false }
}

export function createFrameProfiler({ sampleSize = 60 } = {}) {
  const samples = new Float32Array(sampleSize)
  let idx = 0
  let filled = 0
  let lastTime = 0
  let frameCount = 0
  let drawCalls = 0
  let triangles = 0
  let geometries = 0
  let textures = 0
  let programs = 0
  const markers = new Map()

  function beginFrame() {
    lastTime = performance.now()
  }

  function endFrame(renderer) {
    const now = performance.now()
    const dt = now - lastTime
    samples[idx] = dt
    idx = (idx + 1) % sampleSize
    if (filled < sampleSize) filled++
    frameCount++
    if (renderer) {
      const info = renderer.info
      drawCalls = info.render.calls
      triangles = info.render.triangles
      geometries = info.memory.geometries
      textures = info.memory.textures
      programs = info.programs?.length || 0
    }
  }

  function mark(name) {
    markers.set(name, performance.now())
  }

  function measure(name) {
    const start = markers.get(name)
    if (!start) return 0
    return performance.now() - start
  }

  function getAvgFrameTime() {
    if (filled === 0) return 0
    let sum = 0
    for (let i = 0; i < filled; i++) sum += samples[i]
    return sum / filled
  }

  function getFPS() {
    const avg = getAvgFrameTime()
    return avg > 0 ? Math.round(1000 / avg) : 0
  }

  function getMinFrameTime() {
    if (filled === 0) return 0
    let min = Infinity
    for (let i = 0; i < filled; i++) if (samples[i] < min) min = samples[i]
    return min
  }

  function getMaxFrameTime() {
    if (filled === 0) return 0
    let max = 0
    for (let i = 0; i < filled; i++) if (samples[i] > max) max = samples[i]
    return max
  }

  function getStats() {
    return {
      fps: getFPS(),
      avgFrameTime: getAvgFrameTime(),
      minFrameTime: getMinFrameTime(),
      maxFrameTime: getMaxFrameTime(),
      frameCount,
      drawCalls,
      triangles,
      geometries,
      textures,
      programs
    }
  }

  function reset() {
    idx = 0
    filled = 0
    frameCount = 0
    markers.clear()
  }

  return { beginFrame, endFrame, mark, measure, getStats, getFPS, getAvgFrameTime, reset }
}

export function createLODSystem(camera, levels = LOD_LEVELS) {
  const tracked = []

  function register(object, { distances = null, impostor = null } = {}) {
    const entry = {
      object,
      currentLevel: -1,
      distances: distances || [levels.HIGH.distance, levels.MEDIUM.distance, levels.LOW.distance, levels.IMPOSTOR.distance],
      impostor,
      highGeo: null,
      mediumGeo: null,
      lowGeo: null
    }
    if (object.isMesh || object.isLine || object.isPoints) {
      entry.highGeo = object.geometry
    }
    tracked.push(entry)
    return entry
  }

  function unregister(object) {
    const idx = tracked.findIndex((e) => e.object === object)
    if (idx !== -1) tracked.splice(idx, 1)
  }

  function update() {
    const camPos = camera.position
    for (const entry of tracked) {
      const obj = entry.object
      if (!obj.parent) continue
      const dist = obj.position.distanceTo(camPos)
      let level = 0
      for (let i = entry.distances.length - 1; i >= 0; i--) {
        if (dist >= entry.distances[i]) {
          level = i
          break
        }
      }
      if (level === entry.currentLevel) continue
      entry.currentLevel = level
      applyLOD(entry, level)
    }
  }

  function applyLOD(entry, level) {
    const obj = entry.object
    if (level >= 3 && entry.impostor) {
      obj.visible = false
      if (entry.impostor.parent) entry.impostor.visible = true
    } else {
      obj.visible = true
      if (entry.impostor) entry.impostor.visible = false
      if (obj.isMesh) {
        if (level === 0) {
          obj.castShadow = true
          obj.receiveShadow = true
        } else if (level === 1) {
          obj.castShadow = true
          obj.receiveShadow = true
        } else if (level === 2) {
          obj.castShadow = false
          obj.receiveShadow = true
        } else {
          obj.castShadow = false
          obj.receiveShadow = false
        }
      }
    }
  }

  function getStats() {
    let visible = 0
    let impostored = 0
    for (const e of tracked) {
      if (e.object.visible) visible++
      else impostored++
    }
    return { total: tracked.length, visible, impostored }
  }

  function dispose() {
    tracked.length = 0
  }

  return { register, unregister, update, getStats, dispose }
}

export function createMemoryTracker() {
  const snapshots = []
  let warnCallback = null

  function setWarnCallback(fn) {
    warnCallback = fn
  }

  function snapshot(renderer) {
    const mem = renderer?.info?.memory || {}
    const snap = {
      timestamp: Date.now(),
      geometries: mem.geometries || 0,
      textures: mem.textures || 0,
      programs: renderer?.info?.programs?.length || 0,
      jsHeap: getJSHeap()
    }
    snapshots.push(snap)
    if (snapshots.length > 100) snapshots.shift()
    return snap
  }

  function getJSHeap() {
    if (typeof performance === 'undefined' || !performance.memory) return null
    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    }
  }

  function checkBudget(budget) {
    const heap = getJSHeap()
    if (!heap) return { ok: true }
    const usedMB = heap.used / (1024 * 1024)
    if (usedMB > budget.memory) {
      if (warnCallback) warnCallback('memory', usedMB, budget.memory)
      return { ok: false, type: 'memory', used: usedMB, limit: budget.memory }
    }
    return { ok: true, used: usedMB, limit: budget.memory }
  }

  function getLeaks() {
    if (snapshots.length < 2) return []
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    const leaks = []
    if (last.geometries > first.geometries) {
      leaks.push({ type: 'geometries', delta: last.geometries - first.geometries })
    }
    if (last.textures > first.textures) {
      leaks.push({ type: 'textures', delta: last.textures - first.textures })
    }
    return leaks
  }

  function getSnapshots() {
    return [...snapshots]
  }

  function reset() {
    snapshots.length = 0
  }

  return { snapshot, checkBudget, getLeaks, getSnapshots, setWarnCallback, reset }
}

export function createQualityScaler(renderer) {
  let currentScale = 1.0
  let targetScale = 1.0
  let lastAdjust = 0
  const ADJUST_INTERVAL = 1000
  const MIN_SCALE = 0.5
  const MAX_SCALE = 1.5
  const FPS_LOW = 30
  const FPS_HIGH = 55

  function setPixelRatio(scale) {
    if (!renderer) return
    const dpr = window.devicePixelRatio || 1
    renderer.setPixelRatio(Math.min(dpr * scale, 2))
  }

  function update(currentFPS) {
    const now = Date.now()
    if (now - lastAdjust < ADJUST_INTERVAL) return
    lastAdjust = now
    if (currentFPS < FPS_LOW && currentScale > MIN_SCALE) {
      targetScale = Math.max(MIN_SCALE, currentScale - 0.1)
    } else if (currentFPS > FPS_HIGH && currentScale < MAX_SCALE) {
      targetScale = Math.min(MAX_SCALE, currentScale + 0.05)
    }
    if (targetScale !== currentScale) {
      currentScale = targetScale
      setPixelRatio(currentScale)
    }
  }

  function getScale() {
    return currentScale
  }

  function setScale(scale) {
    currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
    setPixelRatio(currentScale)
  }

  function reset() {
    currentScale = 1.0
    targetScale = 1.0
    setPixelRatio(1.0)
  }

  return { update, getScale, setScale, reset }
}
