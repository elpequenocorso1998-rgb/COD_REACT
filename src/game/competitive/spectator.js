import * as THREE from 'three'

/* =========================================================================
   Spectator mode + theater (replay).
   --------------------------------------------------------------------------
   - Cámara libre (fly), follow player (1st/3rd person), director mode.
   - X-ray (ver enemigos a través de walls).
   - Picture-in-picture.
   - Theater: grabar demos + reproducir con timeline.
   ========================================================================= */

export const SPECTATOR_MODES = {
  FREE: 'free',
  FOLLOW_FIRST: 'follow_first',
  FOLLOW_THIRD: 'follow_third',
  DIRECTOR: 'director'
}

export function createSpectator(camera, scene) {
  let mode = SPECTATOR_MODES.FREE
  let targetId = null
  let targets = []
  let xrayEnabled = false
  let pipEnabled = false
  let pipCamera = null
  let pipRenderer = null
  let speed = 30
  const keys = { forward: false, backward: false, left: false, right: false, up: false, down: false }
  const _dir = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _move = new THREE.Vector3()
  const _targetPos = new THREE.Vector3()

  function setTargets(playerList) {
    targets = playerList
    if (targetId && !playerList.find((p) => p.id === targetId)) {
      targetId = playerList[0]?.id || null
    }
    if (!targetId && playerList.length > 0) {
      targetId = playerList[0].id
    }
  }

  function setMode(newMode) {
    mode = newMode
  }

  function getMode() {
    return mode
  }

  function nextTarget() {
    if (targets.length === 0) return
    const idx = targets.findIndex((p) => p.id === targetId)
    targetId = targets[(idx + 1) % targets.length].id
  }

  function prevTarget() {
    if (targets.length === 0) return
    const idx = targets.findIndex((p) => p.id === targetId)
    targetId = targets[(idx - 1 + targets.length) % targets.length].id
  }

  function getTargetId() {
    return targetId
  }

  function setXray(enabled) {
    xrayEnabled = enabled
  }

  function isXrayEnabled() {
    return xrayEnabled
  }

  function setPip(enabled) {
    pipEnabled = enabled
  }

  function isPipEnabled() {
    return pipEnabled
  }

  function setKey(key, value) {
    keys[key] = value
  }

  function updateFree(dt) {
    camera.getWorldDirection(_dir)
    _right.crossVectors(_dir, _up).normalize()
    _move.set(0, 0, 0)
    if (keys.forward) _move.add(_dir)
    if (keys.backward) _move.sub(_dir)
    if (keys.right) _move.add(_right)
    if (keys.left) _move.sub(_right)
    if (keys.up) _move.add(_up)
    if (keys.down) _move.sub(_up)
    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(speed * dt)
      camera.position.add(_move)
    }
  }

  function updateFollowFirst() {
    const target = targets.find((p) => p.id === targetId)
    if (!target) return
    _targetPos.set(target.pos.x, target.pos.y, target.pos.z)
    camera.position.copy(_targetPos)
    if (target.yaw !== undefined) {
      camera.rotation.set(target.pitch || 0, target.yaw, 0, 'YXZ')
    }
  }

  function updateFollowThird(dt) {
    const target = targets.find((p) => p.id === targetId)
    if (!target) return
    _targetPos.set(target.pos.x, target.pos.y, target.pos.z)
    const distance = 5
    const height = 2
    camera.position.lerp(
      new THREE.Vector3(
        _targetPos.x,
        _targetPos.y + height,
        _targetPos.z + distance
      ),
      1 - Math.pow(0.001, dt)
    )
    camera.lookAt(_targetPos)
  }

  function updateDirector(dt) {
    if (targets.length === 0) {
      updateFree(dt)
      return
    }
    if (Math.random() < 0.005) {
      nextTarget()
      setMode(Math.random() > 0.5 ? SPECTATOR_MODES.FOLLOW_THIRD : SPECTATOR_MODES.FOLLOW_FIRST)
    }
    if (mode === SPECTATOR_MODES.FOLLOW_FIRST) updateFollowFirst()
    else if (mode === SPECTATOR_MODES.FOLLOW_THIRD) updateFollowThird(dt)
  }

  function update(dt) {
    switch (mode) {
      case SPECTATOR_MODES.FREE: updateFree(dt); break
      case SPECTATOR_MODES.FOLLOW_FIRST: updateFollowFirst(); break
      case SPECTATOR_MODES.FOLLOW_THIRD: updateFollowThird(dt); break
      case SPECTATOR_MODES.DIRECTOR: updateDirector(dt); break
    }
  }

  function setSpeed(s) {
    speed = s
  }

  function getSpeed() {
    return speed
  }

  function dispose() {
    if (pipCamera) { pipCamera = null }
    if (pipRenderer) { pipRenderer.dispose(); pipRenderer = null }
  }

  return {
    setTargets,
    setMode,
    getMode,
    nextTarget,
    prevTarget,
    getTargetId,
    setXray,
    isXrayEnabled,
    setPip,
    isPipEnabled,
    setKey,
    update,
    setSpeed,
    getSpeed,
    dispose
  }
}

export function createTheater() {
  const demos = []
  let recording = null
  let playing = null
  let playTime = 0
  let playSpeed = 1

  function startRecording(metadata = {}) {
    recording = {
      id: Date.now(),
      metadata,
      frames: [],
      startedAt: Date.now()
    }
  }

  function recordFrame(frame) {
    if (!recording) return
    recording.frames.push({ t: Date.now() - recording.startedAt, ...frame })
    if (recording.frames.length > 18000) {
      recording.frames.shift()
    }
  }

  function stopRecording() {
    if (!recording) return null
    recording.duration = Date.now() - recording.startedAt
    demos.push(recording)
    if (demos.length > 20) demos.shift()
    const finished = recording
    recording = null
    return finished
  }

  function getDemos() {
    return [...demos]
  }

  function playDemo(demoId) {
    const demo = demos.find((d) => d.id === demoId)
    if (!demo) return false
    playing = demo
    playTime = 0
    return true
  }

  function stopPlayback() {
    playing = null
    playTime = 0
  }

  function updatePlayback(dt) {
    if (!playing) return null
    playTime += dt * playSpeed * 1000
    if (playTime >= playing.duration) {
      stopPlayback()
      return null
    }
    const frame = playing.frames.find((f) => f.t >= playTime)
    return frame || null
  }

  function setPlaySpeed(s) {
    playSpeed = s
  }

  function getPlaySpeed() {
    return playSpeed
  }

  function getPlayTime() {
    return playTime
  }

  function getPlayDuration() {
    return playing?.duration || 0
  }

  function isRecording() {
    return recording !== null
  }

  function isPlaying() {
    return playing !== null
  }

  function deleteDemo(demoId) {
    const idx = demos.findIndex((d) => d.id === demoId)
    if (idx !== -1) demos.splice(idx, 1)
  }

  function clearDemos() {
    demos.length = 0
  }

  return {
    startRecording,
    recordFrame,
    stopRecording,
    getDemos,
    playDemo,
    stopPlayback,
    updatePlayback,
    setPlaySpeed,
    getPlaySpeed,
    getPlayTime,
    getPlayDuration,
    isRecording,
    isPlaying,
    deleteDemo,
    clearDemos
  }
}
