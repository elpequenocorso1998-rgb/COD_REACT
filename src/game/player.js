import * as THREE from 'three'
import { makeGunMetalTexture } from './textures.js'
import { MOVEMENT, WEAPON, PLAYER } from './config.js'
import { FOV, SPRINT_FOV } from './constants.js'

/* =========================================================================
   Jugador (FPS controller) con controles suaves y responsivos.
   --------------------------------------------------------------------------
   Mejoras:
   - dispose() elimina los event listeners del document (bug fixed).
   - Auto-fire con acumulador en update() en lugar de setInterval (sin drift).
   - Retroceso aplicado al viewmodel entero (no a piezas sueltas).
   - Crouch suave (lerp de altura, sin teleport).
   - Right Ctrl también funciona para crouch.
   - Constantes de movimiento/arma/jugador centralizadas en config.js
     (antes mágicas por todo el fichero).
   - makeMuzzleTexture movido a módulo (antes se recreaba como closure por
     cada player).
   ========================================================================= */
export function createPlayer(scene, camera, world, particles) {
  // --- Estado físico ---
  const velocity = new THREE.Vector3()
  const wishDir = new THREE.Vector3()
  let canJump = false
  let isCrouching = false

  // --- Input booleano ---
  let moveForward = false, moveBackward = false
  let moveLeft = false, moveRight = false
  let sprinting = false

  // --- Rotación de cámara (con smoothing) ---
  let targetYaw = 0, targetPitch = 0
  let yaw = 0, pitch = 0
  const SMOOTH = MOVEMENT.camSmooth
  const SENS = MOVEMENT.mouseSens

  // --- FOV dinámico ---
  const baseFov = FOV
  const sprintFov = SPRINT_FOV
  let currentFov = baseFov

  // --- Arma ---
  let recoil = 0
  let viewmodelSwayX = 0, viewmodelSwayY = 0
  let viewmodelRotX = 0, viewmodelRotY = 0
  // Auto-fire con acumulador (sin setInterval).
  let isFiring = false
  let fireAccumulator = 0
  const FIRE_INTERVAL = WEAPON.fireInterval // 100ms entre disparos.

  const startPos = new THREE.Vector3(0, PLAYER.standHeight, 0)
  const STAND_HEIGHT = PLAYER.standHeight
  const CROUCH_HEIGHT = PLAYER.crouchHeight
  let currentHeight = STAND_HEIGHT

  // ---------------------------------------------------------------------
  // VIEWMODEL: rifle M4 detallado.
  // ---------------------------------------------------------------------
  const viewmodel = new THREE.Group()
  camera.add(viewmodel)

  const gunTex = makeGunMetalTexture(256)
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex, color: 0x2a2e30, metalness: 0.95, roughness: 0.28,
    envMapIntensity: 1.5
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x141619, metalness: 0.95, roughness: 0.35, envMapIntensity: 1.2
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1f, metalness: 0.4, roughness: 0.6, envMapIntensity: 0.8
  })

  // Grupo "rifle" para moverlo entero con el retroceso.
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  // Track de geometrías del viewmodel para dispose (antes se leaks).
  const rifleGeos = []

  const rifleBody = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.1, 0.13, 0.7)), rifleGeos[rifleGeos.length - 1]), metalMat)
  rifleBody.position.set(0.2, -0.18, -0.45); rifleGroup.add(rifleBody)

  const barrel = new THREE.Mesh((rifleGeos.push(new THREE.CylinderGeometry(0.022, 0.025, 0.5, 12)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0.2, -0.16, -0.85); rifleGroup.add(barrel)

  const muzzleTip = new THREE.Mesh((rifleGeos.push(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2; muzzleTip.position.set(0.2, -0.16, -1.12); rifleGroup.add(muzzleTip)

  const mag = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.08, 0.22, 0.12)), rifleGeos[rifleGeos.length - 1]), polymerMat)
  mag.position.set(0.2, -0.32, -0.35); mag.rotation.x = 0.2; rifleGroup.add(mag)

  const grip = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.07, 0.18, 0.09)), rifleGeos[rifleGeos.length - 1]), polymerMat)
  grip.position.set(0.2, -0.3, -0.18); grip.rotation.x = -0.3; rifleGroup.add(grip)

  const trigger = new THREE.Mesh((rifleGeos.push(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  trigger.position.set(0.2, -0.22, -0.22); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  const stock = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.08, 0.11, 0.28)), rifleGeos[rifleGeos.length - 1]), polymerMat)
  stock.position.set(0.2, -0.18, -0.05); rifleGroup.add(stock)
  const stockTube = new THREE.Mesh((rifleGeos.push(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  stockTube.rotation.x = Math.PI / 2; stockTube.position.set(0.2, -0.16, 0.12); rifleGroup.add(stockTube)

  const rail = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.04, 0.02, 0.5)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  rail.position.set(0.2, -0.1, -0.45); rifleGroup.add(rail)

  const sightFrame = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.06, 0.06, 0.02)), rifleGeos[rifleGeos.length - 1]), darkMetalMat)
  sightFrame.position.set(0.2, -0.07, -0.45); rifleGroup.add(sightFrame)
  const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }))
  sightDot.position.set(0.2, -0.07, -0.46); rifleGroup.add(sightDot)

  const handguard = new THREE.Mesh((rifleGeos.push(new THREE.BoxGeometry(0.09, 0.07, 0.3)), rifleGeos[rifleGeos.length - 1]), polymerMat)
  handguard.position.set(0.2, -0.16, -0.6); rifleGroup.add(handguard)

  // Muzzle flash.
  const muzzleLight = new THREE.PointLight(0xffaa44, 0, 10, 2)
  muzzleLight.position.set(0.2, -0.16, -1.2); rifleGroup.add(muzzleLight)
  const muzzleTex = makeMuzzleTexture()
  const muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: muzzleTex, transparent: true, opacity: 0,
    depthTest: false, blending: THREE.AdditiveBlending
  }))
  muzzleSprite.scale.set(0.5, 0.5, 0.5)
  muzzleSprite.position.set(0.2, -0.16, -1.25); rifleGroup.add(muzzleSprite)

  if (!scene.children.includes(camera)) scene.add(camera)

  const raycaster = new THREE.Raycaster()
  raycaster.far = WEAPON.raycastFar
  let onShootCallback = null

  // --- Timeout del muzzle flash (para poder cancelarlo en dispose) ---
  let muzzleTimeout = null

  // ---------------------------------------------------------------------
  // INPUT.
  // ---------------------------------------------------------------------
  const onKeyDown = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    moveForward = true; break
      case 'KeyS': case 'ArrowDown':  moveBackward = true; break
      case 'KeyA': case 'ArrowLeft':  moveLeft = true; break
      case 'KeyD': case 'ArrowRight': moveRight = true; break
      case 'ShiftLeft': case 'ShiftRight': sprinting = true; break
      case 'ControlLeft': case 'ControlRight': isCrouching = true; break
      case 'Space':
        if (canJump) {
          velocity.y = MOVEMENT.jump
          canJump = false
        }
        break
    }
  }
  const onKeyUp = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    moveForward = false; break
      case 'KeyS': case 'ArrowDown':  moveBackward = false; break
      case 'KeyA': case 'ArrowLeft':  moveLeft = false; break
      case 'KeyD': case 'ArrowRight': moveRight = false; break
      case 'ShiftLeft': case 'ShiftRight': sprinting = false; break
      case 'ControlLeft': case 'ControlRight': isCrouching = false; break
    }
  }

  let mouseDeltaX = 0, mouseDeltaY = 0
  const onMouseMove = (e) => {
    if (!isPointerLocked()) return
    const sens = sprinting ? SENS * MOVEMENT.mouseSensSprintMul : SENS
    mouseDeltaX += e.movementX * sens
    mouseDeltaY += e.movementY * sens
    viewmodelSwayX += e.movementX * 0.00015
    viewmodelSwayY += e.movementY * 0.00015
  }

  const onMouseDown = (e) => {
    if (!isPointerLocked() || e.button !== 0) return
    isFiring = true
    fireAccumulator = FIRE_INTERVAL // dispara inmediatamente al primer click
  }
  const onMouseUp = (e) => {
    if (e.button === 0) isFiring = false
  }

  function isPointerLocked() {
    const el = document.querySelector('canvas.game-canvas')
    return el !== null && document.pointerLockElement === el
  }

  // ---------------------------------------------------------------------
  // DISPARO.
  // ---------------------------------------------------------------------
  function shoot() {
    if (!isPointerLocked()) return
    const origin = new THREE.Vector3()
    camera.getWorldPosition(origin)
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

    const moving = Math.abs(velocity.x) + Math.abs(velocity.z)
    const spread = recoil * 0.4 + Math.min(moving * 0.005, 0.04)
    dir.x += (Math.random() - 0.5) * spread
    dir.y += (Math.random() - 0.5) * spread
    dir.normalize()

    raycaster.set(origin, dir)

    // Retroceso visual + subida de la cámara.
    recoil = Math.min(recoil + WEAPON.recoilPerShot, WEAPON.recoilMax)
    targetPitch += WEAPON.pitchKick
    targetYaw += (Math.random() - 0.5) * WEAPON.yawKick

    muzzleLight.intensity = 6
    muzzleSprite.material.opacity = 1
    muzzleSprite.material.rotation = Math.random() * Math.PI
    muzzleSprite.scale.setScalar(0.4 + Math.random() * 0.2)
    if (muzzleTimeout) clearTimeout(muzzleTimeout)
    muzzleTimeout = setTimeout(() => {
      muzzleLight.intensity = 0; muzzleSprite.material.opacity = 0
    }, 50)

    const muzzleWorld = new THREE.Vector3()
    muzzleSprite.getWorldPosition(muzzleWorld)
    particles.spawnMuzzleBurst(muzzleWorld, dir)
    particles.spawnSmoke(muzzleWorld, 1)
    ejectShell(origin)

    if (onShootCallback) {
      const hitEnemy = onShootCallback(origin, dir)
      if (!hitEnemy) spawnWallImpact(origin, dir)
    }
  }

  function ejectShell(origin) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0)
    const pos = origin.clone().add(right.clone().multiplyScalar(0.2)).add(up.clone().multiplyScalar(-0.1))
    particles.spawnSparks(pos, right.clone().multiplyScalar(2).add(up.clone().multiplyScalar(1)))
  }

  function spawnWallImpact(origin, dir) {
    const ray = new THREE.Ray(origin, dir)
    let closest = null, closestDist = Infinity
    for (const c of world.colliders) {
      const hit = ray.intersectBox(c.box, new THREE.Vector3())
      if (hit) {
        const d = origin.distanceTo(hit)
        if (d < closestDist) { closestDist = d; closest = hit }
      }
    }
    if (closest) {
      const normal = dir.clone().negate()
      particles.spawnSparks(closest, normal)
    }
  }

  function requestPointerLock() {
    const el = document.querySelector('canvas.game-canvas')
    el?.requestPointerLock?.()
  }
  function exitPointerLock() { document.exitPointerLock?.() }

  // ---------------------------------------------------------------------
  // UPDATE: física y cámara.
  // ---------------------------------------------------------------------
  function update(dt) {
    // --- 1. Suavizado de cámara ---
    targetYaw -= mouseDeltaX
    targetPitch -= mouseDeltaY
    targetPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, targetPitch))
    mouseDeltaX = 0; mouseDeltaY = 0

    yaw += (targetYaw - yaw) * SMOOTH
    pitch += (targetPitch - pitch) * SMOOTH

    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw
    camera.rotation.x = pitch

    // --- 2. Dirección deseada ---
    wishDir.set(0, 0, 0)
    if (moveForward)  wishDir.z -= 1
    if (moveBackward) wishDir.z += 1
    if (moveLeft)     wishDir.x -= 1
    if (moveRight)    wishDir.x += 1
    wishDir.normalize()

    const sinY = Math.sin(yaw), cosY = Math.cos(yaw)
    const worldWishX =  cosY * wishDir.x + sinY * wishDir.z
    const worldWishZ = -sinY * wishDir.x + cosY * wishDir.z

    // --- 3. Velocidades objetivo según estado ---
    const moving = wishDir.lengthSq() > 0
    let maxSpeed
    if (isCrouching) maxSpeed = MOVEMENT.crouch
    else if (sprinting && moveForward) maxSpeed = MOVEMENT.sprint
    else maxSpeed = MOVEMENT.walk

    const groundAccel = MOVEMENT.groundAccel
    const airAccel = MOVEMENT.airAccel
    const accelMag = canJump ? groundAccel : airAccel

    const desiredVx = worldWishX * maxSpeed
    const desiredVz = worldWishZ * maxSpeed
    velocity.x += (desiredVx - velocity.x) * Math.min(1, accelMag * dt / maxSpeed)
    velocity.z += (desiredVz - velocity.z) * Math.min(1, accelMag * dt / maxSpeed)

    if (!moving && canJump) {
      const friction = MOVEMENT.friction
      const drop = friction * dt
      const speed = Math.hypot(velocity.x, velocity.z)
      if (speed > 0) {
        const newSpeed = Math.max(0, speed - drop)
        const scale = newSpeed / speed
        velocity.x *= scale
        velocity.z *= scale
      }
    }

    // --- 4. Gravedad ---
    velocity.y -= MOVEMENT.gravity * dt

    // --- 5. Colisiones por ejes separados ---
    const pos = camera.position
    const bodyRadius = PLAYER.bodyRadius

    const nx = pos.x + velocity.x * dt
    if (!world.collidesAt(nx, pos.z, bodyRadius)) pos.x = nx
    else velocity.x = 0

    const nz = pos.z + velocity.z * dt
    if (!world.collidesAt(pos.x, nz, bodyRadius)) pos.z = nz
    else velocity.z = 0

    pos.y += velocity.y * dt

    // --- 6. Crouch suave: interpolamos la altura en lugar de teleport ---
    const targetHeight = isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT
    currentHeight += (targetHeight - currentHeight) * Math.min(1, dt * 10)
    if (pos.y < currentHeight) {
      pos.y = currentHeight
      velocity.y = 0
      canJump = true
    }

    // --- 7. FOV dinámico (sprint) ---
    const targetFov = (sprinting && moving && moveForward) ? sprintFov : baseFov
    currentFov += (targetFov - currentFov) * Math.min(1, dt * 6)
    if (Math.abs(camera.fov - currentFov) > 0.1) {
      camera.fov = currentFov
      camera.updateProjectionMatrix()
    }

    // --- 8. Auto-fire con acumulador (sin setInterval) ---
    if (isFiring && isPointerLocked()) {
      fireAccumulator += dt
      while (fireAccumulator >= FIRE_INTERVAL) {
        fireAccumulator -= FIRE_INTERVAL
        shoot()
      }
    }

    // --- 9. Viewmodel: bobbing + sway + retroceso ---
    const t = performance.now() / 1000
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z)
    const isMoving = horizontalSpeed > 0.5 && canJump
    const bobFreq = sprinting ? 14 : 9
    const bobAmp = Math.min(horizontalSpeed / 8, 1) * (sprinting ? 0.025 : 0.015)
    const bob = isMoving ? Math.sin(t * bobFreq) * bobAmp : Math.sin(t * 2) * 0.003
    const bobSide = isMoving ? Math.cos(t * bobFreq * 0.5) * bobAmp * 0.6 : 0

    viewmodelSwayX *= 0.85
    viewmodelSwayY *= 0.85
    viewmodelRotX = -viewmodelSwayY * 8
    viewmodelRotY = -viewmodelSwayX * 8

    // Retroceso aplicado al grupo entero del rifle (no a piezas sueltas).
    recoil *= WEAPON.recoilRecover
    rifleGroup.position.z = recoil
    rifleGroup.rotation.x = -recoil * 1.2

    const crouchOffset = (STAND_HEIGHT - currentHeight) * 0.15
    viewmodel.position.set(bobSide + viewmodelSwayX, bob + viewmodelSwayY - crouchOffset, 0)
    viewmodel.rotation.set(viewmodelRotX, viewmodelRotY, 0)
  }

  function reset() {
    camera.position.copy(startPos)
    velocity.set(0, 0, 0)
    yaw = 0; pitch = 0; targetYaw = 0; targetPitch = 0
    moveForward = moveBackward = moveLeft = moveRight = false
    sprinting = false; isCrouching = false
    isFiring = false; fireAccumulator = 0
    recoil = 0
    currentHeight = STAND_HEIGHT
    camera.fov = baseFov
    camera.updateProjectionMatrix()
  }

  function getPosition() { return camera.position }
  function getYaw() { return yaw }

  // Registramos listeners para poder eliminarlos en dispose.
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)

  function dispose() {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mouseup', onMouseUp)
    if (muzzleTimeout) clearTimeout(muzzleTimeout)
    isFiring = false
    // Dispose de materiales y geometrías del viewmodel.
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    muzzleSprite.material.map?.dispose()
    muzzleSprite.material.dispose()
    gunTex.dispose()
    sightDot.material.dispose()
    // Geometrías del rifle (antes no se liberaban: leak al recrear player).
    for (const g of rifleGeos) g.dispose()
    rifleGeos.length = 0
    // Quitamos el viewmodel de la cámara (antes quedaba colgando).
    if (viewmodel.parent === camera) camera.remove(viewmodel)
  }

  return {
    update, reset, dispose, getPosition, getYaw,
    requestPointerLock, exitPointerLock,
    set onShoot(fn) { onShootCallback = fn }
  }
}

// ---------------------------------------------------------------------------
// Textura del muzzle flash (a nivel módulo, antes era un closure recreated
// por cada player). Dibuja un destello radial con rayos.
// ---------------------------------------------------------------------------
function makeMuzzleTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60)
  grad.addColorStop(0, 'rgba(255,255,220,1)')
  grad.addColorStop(0.25, 'rgba(255,200,80,0.95)')
  grad.addColorStop(0.6, 'rgba(255,120,30,0.5)')
  grad.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(255,220,150,0.9)'; ctx.lineWidth = 3
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3
    const len = 30 + Math.random() * 30
    ctx.beginPath(); ctx.moveTo(64, 64)
    ctx.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len); ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}
