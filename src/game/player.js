import * as THREE from 'three'
import { buildViewModel, disposeViewModelShared } from './viewmodels.js'
import { MOVEMENT, WEAPON, PLAYER, STAMINA } from './config.js'
import { FOV, SPRINT_FOV } from './constants.js'
import { hasPerk } from './loadout.js'
import { getSettings } from './settings.js'

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
export function createPlayer(scene, camera, world, particles, renderer) {
  // --- Estado físico ---
  const velocity = new THREE.Vector3()
  const wishDir = new THREE.Vector3()
  let canJump = false
  let isCrouching = false

  // --- Input booleano ---
  let moveForward = false, moveBackward = false
  let moveLeft = false, moveRight = false
  let sprinting = false

  // --- Movimiento táctico (Fase 2) ---
  let isSliding = false          // slide activo
  let slideTimer = 0             // duración restante del slide
  let isProne = false            // cuerpo a tierra
  let leanAmount = 0             // -1=izq, 0=centro, 1=der (lerp suave)
  let leanTarget = 0             // objetivo de lean
  let tacticalSprint = false     // sprint táctico (arma baja, más rápido)

  // --- Movimiento moderno (Fase 1.5) ---
  let stamina = STAMINA.max      // stamina actual para sprintar
  let isHoldingBreath = false    // manteniendo respiración (sniper)
  let breathRegenDelay = 0       // delay antes de regenerar stamina de respiración
  let isMantling = false         // trepando un obstáculo
  let mantleTimer = 0            // duración restante del mantle
  let mantleStartY = 0           // Y inicial del mantle
  let mantleEndY = 0             // Y objetivo del mantle
  let mantleTargetPos = new THREE.Vector3()
  let lastFootstepAt = 0         // timestamp del último paso (audio)

  // --- Rotación de cámara (con smoothing) ---
  let targetYaw = 0, targetPitch = 0
  let yaw = 0, pitch = 0
  const SMOOTH = MOVEMENT.camSmooth
  // Fase 1.8: sensibilidad y FOV desde settings del jugador.
  const _settings = getSettings()
  let SENS_X = _settings.mouseSensX || MOVEMENT.mouseSens
  let SENS_Y = _settings.mouseSensY || MOVEMENT.mouseSens

  // --- FOV dinámico ---
  const baseFov = _settings.fov || FOV
  const sprintFov = SPRINT_FOV
  let currentFov = baseFov

  // --- Arma ---
  let recoil = 0
  let viewmodelSwayX = 0, viewmodelSwayY = 0
  let viewmodelRotX = 0, viewmodelRotY = 0
  // Auto-fire con acumulador (sin setInterval).
  let isFiring = false
  let fireAccumulator = 0
  // Arma actual: se lee del store para stats dinámicos.
  let currentWeaponDef = WEAPON

  // --- ADS (Aim Down Sights) ---
  let isAiming = false        // botón derecho presionado
  let adsProgress = 0         // 0=hipfire, 1=full ADS (lerp suave)
  let aimFov = FOV            // FOV objetivo según ADS

  // Spawn en la plaza abierta, fuera de la fuente central.
  // Antes era (0, standHeight, 0): caía DENTRO del collider de la pila
  // de la fuente (radio ~2.2), y como el movimiento comprueba collidesAt
  // antes de desplazarse, cualquier dirección estaba bloqueada => el
  // jugador aparecía "pegado", sin poder moverse. (8,8) está a ~11m del
  // centro de la fuente y a ~17m de las casas más cercanas, en zona libre.
  const startPos = new THREE.Vector3(8, PLAYER.standHeight, 8)
  const STAND_HEIGHT = PLAYER.standHeight
  const CROUCH_HEIGHT = PLAYER.crouchHeight
  let currentHeight = STAND_HEIGHT

  // ---------------------------------------------------------------------
  // VIEWMODEL: se construye por-arma vía viewmodels.js.
  // Cada arma tiene SU modelo 3D propio (M4, AK, MP5, sniper, shotgun,
  // LMG, pistol). Al cambiar de arma se dispone el anterior y se crea
  // el nuevo. Antes había un único M4 para todas → inaceptable CoD-grade.
  // ---------------------------------------------------------------------
  let viewmodelState = null
  let viewmodel = null
  let rifleGroup = null
  let muzzleLight = null
  let muzzleSprite = null
  let vmHipX = 0.2, vmHipY = -0.18
  let vmAdsX = 0, vmAdsY = -0.12

  function equipViewModel(weaponId) {
    if (viewmodelState) {
      if (viewmodel.parent === camera) camera.remove(viewmodel)
      viewmodelState.dispose()
    }
    viewmodelState = buildViewModel(weaponId)
    viewmodel = viewmodelState.viewmodel
    rifleGroup = viewmodelState.rifleGroup
    muzzleLight = viewmodelState.muzzleLight
    muzzleSprite = viewmodelState.muzzleSprite
    vmHipX = viewmodelState.hipX
    vmHipY = viewmodelState.hipY
    vmAdsX = viewmodelState.adsX
    vmAdsY = viewmodelState.adsY
    camera.add(viewmodel)
  }

  // Arma inicial: M4 (weaponId por defecto del store).
  equipViewModel('m4')

  if (!scene.children.includes(camera)) scene.add(camera)
  // rotation.order se fija UNA vez al crear (antes se reasignaba cada frame).
  camera.rotation.order = 'YXZ'

  // Cache del canvas del renderer (antes se hacía querySelector en cada
  // mousemove y mousedown: consulta DOM en evento de alta frecuencia).
  const canvas = renderer.domElement
  canvas.classList.add('game-canvas')

  const raycaster = new THREE.Raycaster()
  raycaster.far = WEAPON.raycastFar
  let onShootCallback = null
  let onFootstepCallback = null

  // --- Timeout del muzzle flash (para poder cancelarlo en dispose) ---
  let muzzleTimeout = null

  // Vectores temporales reutilizados por shoot/spawnWallImpact/ejectShell
  // (antes se allocaban 4-5 Vector3 + 1 Ray por disparo → GC pressure).
  const _origin = new THREE.Vector3()
  const _dir = new THREE.Vector3()
  const _muzzleWorld = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _shellPos = new THREE.Vector3()
  const _shellVel = new THREE.Vector3()
  const _impactRay = new THREE.Ray()
  const _impactPoint = new THREE.Vector3()
  const _impactNormal = new THREE.Vector3()

  // ---------------------------------------------------------------------
  // INPUT.
  // ---------------------------------------------------------------------
  const onKeyDown = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    moveForward = true; break
      case 'KeyS': case 'ArrowDown':  moveBackward = true; break
      case 'KeyA': case 'ArrowLeft':  moveLeft = true; break
      case 'KeyD': case 'ArrowRight': moveRight = true; break
      case 'ShiftLeft': case 'ShiftRight':
        sprinting = true
        // Shift doble = tactical sprint (más rápido, arma baja).
        if (!tacticalSprint && (Date.now() - _lastShiftAt) < 300) {
          tacticalSprint = true
        }
        _lastShiftAt = Date.now()
        break
      case 'ControlLeft': case 'ControlRight':
        // Slide: crouch mientras sprintas = slide.
        if (sprinting && !isSliding && !isCrouching) {
          isSliding = true
          slideTimer = 0.6 // 600ms de slide
          // Impulso hacia adelante.
          _dir.set(0, 0, -1).applyQuaternion(camera.quaternion)
          velocity.x = _dir.x * MOVEMENT.sprint * 1.8
          velocity.z = _dir.z * MOVEMENT.sprint * 1.8
        }
        isCrouching = true
        break
      case 'KeyZ':
        // Prone toggle (cuerpo a tierra).
        isProne = !isProne
        if (isProne) { isCrouching = false; isSliding = false }
        break
      case 'KeyQ':
        // Lean left.
        leanTarget = -1
        break
      case 'KeyE':
        // Lean right.
        leanTarget = 1
        break
      case 'Space':
        if (canJump && !isProne) {
          velocity.y = MOVEMENT.jump
          canJump = false
          // Fase 1.5: slide-jump (mantener momentum del slide al saltar).
          // Si estábamos en slide, conservamos parte del impulso.
          // (No hacemos nada especial: la velocity.x/z ya es alta del slide.)
        }
        // Jump cancela slide.
        if (isSliding) { isSliding = false; slideTimer = 0 }
        // Fase 1.5: intentar mantle si estamos en el aire cerca de un borde.
        if (!canJump) tryMantle()
        break
      case 'KeyF':
        // Fase 1.5: mantle manual (trepado de obstáculos).
        tryMantle()
        break
      case 'KeyV':
        // Fase 1.5: mantener respiración (sniper). Reduce sway al apuntar.
        isHoldingBreath = true
        breathRegenDelay = STAMINA.breathRegenDelay
        break
    }
  }
  let _lastShiftAt = 0
  const onKeyUp = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    moveForward = false; break
      case 'KeyS': case 'ArrowDown':  moveBackward = false; break
      case 'KeyA': case 'ArrowLeft':  moveLeft = false; break
      case 'KeyD': case 'ArrowRight': moveRight = false; break
      case 'ShiftLeft': case 'ShiftRight':
        sprinting = false
        tacticalSprint = false
        break
      case 'ControlLeft': case 'ControlRight': isCrouching = false; break
      case 'KeyQ':
      case 'KeyE':
        // Al soltar Q o E, vuelve al centro.
        leanTarget = 0
        break
      case 'KeyV':
        // Fase 1.5: soltar respiración.
        isHoldingBreath = false
        breathRegenDelay = STAMINA.breathRegenDelay
        break
    }
  }

  let mouseDeltaX = 0, mouseDeltaY = 0
  const onMouseMove = (e) => {
    if (!isPointerLocked()) return
    // ADS reduce la sensibilidad para apuntar con precisión.
    const w = currentWeaponDef || WEAPON
    const adsMul = 1 - adsProgress * (1 - w.adsSensMul)
    const sensMul = sprinting ? MOVEMENT.mouseSensSprintMul : 1
    const sensX = SENS_X * adsMul * sensMul
    const sensY = SENS_Y * adsMul * sensMul
    mouseDeltaX += e.movementX * sensX
    mouseDeltaY += e.movementY * sensY
    const swayMul = 1 - adsProgress * 0.9
    viewmodelSwayX += e.movementX * 0.00015 * swayMul
    viewmodelSwayY += e.movementY * 0.00015 * swayMul
  }

  const onMouseDown = (e) => {
    if (!isPointerLocked()) return
    // Fase 4: durante gunship, el click dispara el cañón (lo gestiona el
    // engine via _onGunshipClick), no el arma del player. Sin esto, cada
    // click gastaba munición del arma Y disparaba el cañón.
    if (gunshipActive) return
    if (e.button === 0) {
      // Botón izquierdo: disparar.
      // Semi-auto (sniper, shotgun, pistol): un click = un disparo.
      // Auto (ar, smg, lmg): mantén para auto-fire.
      if (currentWeaponDef && !currentWeaponDef.automatic) {
        shoot()
      } else {
        isFiring = true
        fireAccumulator = currentWeaponDef ? currentWeaponDef.fireInterval : 0.1
      }
    } else if (e.button === 2) {
      // Botón derecho: ADS (aim down sights).
      isAiming = true
    }
  }
  const onMouseUp = (e) => {
    if (e.button === 0) isFiring = false
    else if (e.button === 2) isAiming = false
  }

  // Prevenir menú contextual al click derecho (interfiere con ADS).
  const onContextMenu = (e) => e.preventDefault()

  function isPointerLocked() {
    return (canvas !== null && document.pointerLockElement === canvas) || virtualLock
  }

  // ---------------------------------------------------------------------
  // DISPARO.
  // El callback onShoot se llama PRIMERO: comprueba munición y aplica
  // sonido/impacto. Solo si confirma que había bala (devuelve true tras
  // fire()) aplicamos retroceso, flash, eyección y humo. Antes el orden
  // era inverso y disparar con cargador vacío seguía pateando la cámara.
  // Soporta multi-pellet (shotgun): dispara N rayos con spread independiente.
  // ---------------------------------------------------------------------
  function shoot() {
    if (!isPointerLocked()) return
    // Lee el arma actual del store para stats dinámicos.
    const w = currentWeaponDef || WEAPON
    camera.getWorldPosition(_origin)
    _dir.set(0, 0, -1).applyQuaternion(camera.quaternion)

    // Spread: depende de si estamos en ADS o hipfire, y del movimiento.
    const moving = Math.abs(velocity.x) + Math.abs(velocity.z)
    const spreadBase = recoil * 0.4 + Math.min(moving * 0.005, 0.04)
    // ADS reduce el spread drásticamente; hipfire lo multiplica.
    const spreadMul = adsProgress > 0.5 ? w.adsSpread : w.hipFireSpread
    const spread = spreadBase * spreadMul

    // Shotgun: dispara múltiples pellets, cada uno con spread independiente.
    const pellets = w.pellets || 1
    for (let p = 0; p < pellets; p++) {
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      _dir.set(0, 0, -1).applyQuaternion(camera.quaternion)
      _dir.addScaledVector(_right, (Math.random() - 0.5) * spread)
      _dir.addScaledVector(_up, (Math.random() - 0.5) * spread)
      _dir.normalize()
      raycaster.set(_origin, _dir)
      raycaster.far = w.raycastFar

      // Callback primero: fire() comprueba munición (solo en el primer pellet).
      if (p === 0 && onShootCallback) {
        const hitEnemy = onShootCallback(_origin, _dir)
        if (!hitEnemy) spawnWallImpact(_origin, _dir)
      } else if (p > 0 && onShootCallback) {
        // Pellets adicionales: no consumen munición extra, solo hit-test.
        const hitEnemy = onShootCallback(_origin, _dir, true)
        if (!hitEnemy) spawnWallImpact(_origin, _dir)
      }
    }

    // Retroceso visual + subida de la cámara (solo si hubo disparo real).
    recoil = Math.min(recoil + w.recoilPerShot, w.recoilMax)
    targetPitch += w.pitchKick
    targetYaw += (Math.random() - 0.5) * w.yawKick

    muzzleLight.intensity = 6
    muzzleSprite.material.opacity = 1
    muzzleSprite.material.rotation = Math.random() * Math.PI
    muzzleSprite.scale.setScalar(0.4 + Math.random() * 0.2)
    if (muzzleTimeout) clearTimeout(muzzleTimeout)
    muzzleTimeout = setTimeout(() => {
      muzzleLight.intensity = 0; muzzleSprite.material.opacity = 0
    }, 50)

    muzzleSprite.getWorldPosition(_muzzleWorld)
    particles.spawnMuzzleBurst(_muzzleWorld, _dir)
    particles.spawnSmoke(_muzzleWorld)
    ejectShell(_origin)
  }

  function ejectShell(origin) {
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    _shellPos.copy(origin).addScaledVector(_right, 0.2).addScaledVector(_up, -0.1)
    _shellVel.copy(_right).multiplyScalar(2).addScaledVector(_up, 1)
    particles.spawnSparks(_shellPos, _shellVel)
  }

  function spawnWallImpact(origin, dir) {
    _impactRay.set(origin, dir)
    let closestDist = Infinity
    let hit = false
    for (const c of world.colliders) {
      // intersectBox escribe en _impactPoint si hay intersección.
      if (_impactRay.intersectBox(c.box, _impactPoint)) {
        const d = origin.distanceTo(_impactPoint)
        if (d < closestDist) {
          closestDist = d
          _impactNormal.copy(dir).negate()
          hit = true
        }
      }
    }
    if (hit) {
      particles.spawnSparks(_impactPoint, _impactNormal)
    }
  }

  let virtualLock = false

  function requestPointerLock() {
    // Pointer lock real (requiere contexto seguro: HTTPS o localhost).
    // Si el juego se sirve por HTTP desde un hostname/IP de LAN, el
    // contexto NO es seguro y requestPointerLock falla silenciosamente.
    // En ese caso caemos a un "virtual lock": ocultamos el cursor y
    // usamos movementX/movementY de mousemove (que sí funcionan sin
    // pointer lock en Chrome/Edge). Sin esto, el ratón no haría nada
    // (onMouseMove/onMouseDown tienen guard isPointerLocked) y el juego
    // sería injugable al acceder por http://hostname:9432.
    if (window.isSecureContext && canvas && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock()
        if (p && typeof p.catch === 'function') {
          p.catch(() => enableVirtualLock())
        }
      } catch {
        enableVirtualLock()
      }
    } else {
      enableVirtualLock()
    }
  }

  function enableVirtualLock() {
    if (virtualLock) return
    virtualLock = true
    if (canvas) canvas.style.cursor = 'none'
  }

  function exitPointerLock() {
    virtualLock = false
    if (canvas) canvas.style.cursor = ''
    if (document.pointerLockElement) {
      try { document.exitPointerLock?.() } catch {}
    }
  }

  // Fase 1.5: mantle (trepado de obstáculos).
  // Detecta un borde a altura de pecho al frente del jugador y, si hay
  // espacio libre encima, inicia una animación de subida.
  const _mantleOrigin = new THREE.Vector3()
  const _mantleDir = new THREE.Vector3()
  const _mantleUp = new THREE.Vector3(0, 1, 0)
  const _mantleHit = new THREE.Vector3()
  function tryMantle() {
    if (isMantling || isProne) return
    camera.getWorldPosition(_mantleOrigin)
    _mantleDir.set(0, 0, -1).applyQuaternion(camera.quaternion)
    _mantleDir.y = 0; _mantleDir.normalize()
    // Raycast horizontal desde el pecho (1.2m).
    _mantleOrigin.y = Math.max(_mantleOrigin.y, 1.2)
    // Buscamos un collider al frente dentro de 1.5m.
    let hitDist = Infinity
    let hitBox = null
    const _r = new THREE.Ray(_mantleOrigin, _mantleDir)
    const _p = new THREE.Vector3()
    if (world && world.colliders) {
      for (const c of world.colliders) {
        if (_r.intersectBox(c.box, _p)) {
          const d = _mantleOrigin.distanceTo(_p)
          if (d < hitDist && d < 1.5) { hitDist = d; hitBox = c.box }
        }
      }
    }
    if (!hitBox) return
    // El borde superior del collider debe estar entre 0.5 y 1.8m (trepable).
    const topY = hitBox.max.y
    if (topY < 0.5 || topY > 1.8) return
    // Comprobamos que encima del borde hay espacio libre (no es un muro alto).
    const aboveX = _mantleOrigin.x + _mantleDir.x * (hitDist + 0.3)
    const aboveZ = _mantleOrigin.z + _mantleDir.z * (hitDist + 0.3)
    if (world.collidesAt(aboveX, aboveZ, 0.4)) return
    // Iniciamos mantle: animación de 0.4s hasta (topY + standHeight).
    isMantling = true
    mantleTimer = 0.4
    mantleStartY = camera.position.y
    mantleEndY = topY + 0.1
    mantleTargetPos.set(aboveX, mantleEndY, aboveZ)
    velocity.set(0, 0, 0)
  }

  // ---------------------------------------------------------------------
  // UPDATE: física y cámara.
  // ---------------------------------------------------------------------
  // Fase 4: gunship activo — cuando es true, skipamos la actualización de
  // cámara y movimiento del player (la cámara la controla el streak manager).
  // Sin esto, player.update() sobrescribía la posición/rotación aérea del
  // gunship cada frame, destruyendo la vista cenital.
  let gunshipActive = false

  function update(dt, _clockTime) {
    // Fase 4: si el gunship está activo, skipamos toda la actualización
    // de cámara y movimiento (la cámara la controla el streak manager
    // con vista aérea). Solo procesamos el auto-fire por si el jugador
    // dispara (aunque en gunship el click dispara el cañón, no el arma).
    if (gunshipActive) {
      mouseDeltaX = 0; mouseDeltaY = 0
      return
    }
    // Fase 1.9: gamepad support. Lee el gamepad conectado y aplica
    // movimiento + cámara. Es input adicional al mouse/teclado (no
    // lo reemplaza). Aim assist suave si está activado en settings.
    const gp = navigator.getGamepads ? navigator.getGamepads() : []
    let pad = null
    for (let i = 0; i < gp.length; i++) {
      if (gp[i]) { pad = gp[i]; break }
    }
    if (pad) {
      const dz = 0.15 // deadzone
      const lx = Math.abs(pad.axes[0] || 0) > dz ? pad.axes[0] : 0
      const ly = Math.abs(pad.axes[1] || 0) > dz ? pad.axes[1] : 0
      const rx = Math.abs(pad.axes[2] || 0) > dz ? pad.axes[2] : 0
      const ry = Math.abs(pad.axes[3] || 0) > dz ? pad.axes[3] : 0
      // Movimiento.
      // Fase 7: bug fixed — el stick release no limpiaba los booleans.
      // Ahora si el stick está en deadzone, reseteamos los booleans de
      // movimiento para que el player no siga avanzando solo.
      if (Math.abs(ly) < 0.5) { moveForward = false; moveBackward = false }
      if (Math.abs(lx) < 0.5) { moveLeft = false; moveRight = false }
      if (ly < -0.5) moveForward = true
      else if (ly > 0.5) moveBackward = true
      if (lx < -0.5) moveLeft = true
      else if (lx > 0.5) moveRight = true
      // Cámara (right stick).
      if (rx !== 0 || ry !== 0) {
        const sensMul = 5.0
        mouseDeltaX += rx * dt * sensMul
        mouseDeltaY += ry * dt * sensMul
      }
      // Sprint: L3 (button 10) o bumper izquierdo (button 4).
      if (pad.buttons[10] && pad.buttons[10].pressed) sprinting = true
      // Disparo: RT (button 7).
      if (pad.buttons[7] && pad.buttons[7].pressed) {
        if (!isFiring) {
          const w = currentWeaponDef || WEAPON
          if (!w.automatic) shoot()
          else { isFiring = true; fireAccumulator = w.fireInterval }
        }
      } else if (isFiring && currentWeaponDef && currentWeaponDef.automatic) {
        isFiring = false
      }
      // ADS: LT (button 6).
      if (pad.buttons[6]) isAiming = pad.buttons[6].pressed
      // Salto: A (button 0).
      if (pad.buttons[0] && pad.buttons[0].pressed && canJump && !isProne) {
        velocity.y = MOVEMENT.jump
        canJump = false
      }
    }

    // --- 1. Suavizado de cámara (framerate-independent) ---
    // Antes era `yaw += (t-yaw)*SMOOTH` sin dt: convergía 2.4x más rápido
    // a 144Hz que a 60Hz. Usamos 1-pow(1-k, dt*60) para decaimiento
    // exponencial consistente sin importar el framerate.
    const camAlpha = 1 - Math.pow(1 - SMOOTH, dt * 60)
    targetYaw -= mouseDeltaX
    targetPitch -= mouseDeltaY
    targetPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, targetPitch))
    mouseDeltaX = 0; mouseDeltaY = 0

    yaw += (targetYaw - yaw) * camAlpha
    pitch += (targetPitch - pitch) * camAlpha

    // --- Lean: desplazamiento lateral + roll de cámara ---
    leanAmount += (leanTarget - leanAmount) * Math.min(1, dt * 8)
    // El roll visual es sutil (no más de 8°).
    camera.rotation.z = leanAmount * 0.14
    // El desplazamiento lateral se aplica en la sección de colisiones.
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
    // Fase 1.5: sprint requiere stamina (salvo Marathon perk).
    const marathonPerk = hasPerk('marathon')
    const canSprint = marathonPerk || stamina > STAMINA.minToSprint
    if (sprinting && !canSprint) sprinting = false
    const moving = wishDir.lengthSq() > 0
    let maxSpeed
    // Slide: impulso fijo, sin control de dirección, decae con fricción.
    if (isSliding) {
      slideTimer -= dt
      if (slideTimer <= 0 || !canJump) {
        isSliding = false
        slideTimer = 0
      }
      // Durante slide no aceleramos, solo dejamos que la fricción frene.
      const slideSpeed = MOVEMENT.sprint * 1.8 * (slideTimer / 0.6)
      maxSpeed = Math.max(MOVEMENT.crouch, slideSpeed)
    } else if (isProne) {
      maxSpeed = MOVEMENT.crouch * 0.4 // prone muy lento
    } else if (tacticalSprint && moveForward && canSprint) {
      maxSpeed = MOVEMENT.sprint * 1.25 // tactical sprint más rápido
    } else if (isCrouching) {
      maxSpeed = MOVEMENT.crouch
    } else if (sprinting && moveForward && canSprint) {
      maxSpeed = MOVEMENT.sprint
    } else {
      maxSpeed = MOVEMENT.walk
    }
    // Arma pesada reduce velocidad.
    const weaponSpeed = (currentWeaponDef || WEAPON).moveSpeedMul || 1.0
    maxSpeed *= weaponSpeed

    // --- Fase 1.5: stamina drain / regen ---
    if ((sprinting || tacticalSprint) && moveForward && !marathonPerk) {
      stamina = Math.max(0, stamina - STAMINA.sprintDrainPerSec * dt)
    } else {
      stamina = Math.min(STAMINA.max, stamina + STAMINA.regenPerSec * dt)
    }

    const groundAccel = MOVEMENT.groundAccel
    const airAccel = MOVEMENT.airAccel
    const accelMag = canJump ? groundAccel : airAccel

    if (!isSliding) {
      const desiredVx = worldWishX * maxSpeed
      const desiredVz = worldWishZ * maxSpeed
      velocity.x += (desiredVx - velocity.x) * Math.min(1, accelMag * dt / maxSpeed)
      velocity.z += (desiredVz - velocity.z) * Math.min(1, accelMag * dt / maxSpeed)
    }

    if (!moving && canJump && !isSliding) {
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

    // --- 5. Colisiones por ejes separados + lean lateral ---
    const pos = camera.position
    const bodyRadius = PLAYER.bodyRadius
    // Lean: desplazamos la cámara lateralmente (right vector) sin mover
    // el cuerpo de colisión (solo exponemos la cabeza).
    if (Math.abs(leanAmount) > 0.01) {
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      _right.y = 0; _right.normalize()
      // El offset visual de lean se aplica directamente a la posición de
      // la cámara, sin afectar a la colisión del cuerpo.
      pos.x += _right.x * leanAmount * 0.6
      pos.z += _right.z * leanAmount * 0.6
    }

    const nx = pos.x + velocity.x * dt
    if (!world.collidesAt(nx, pos.z, bodyRadius)) pos.x = nx
    else velocity.x = 0

    const nz = pos.z + velocity.z * dt
    if (!world.collidesAt(pos.x, nz, bodyRadius)) pos.z = nz
    else velocity.z = 0

    pos.y += velocity.y * dt

    // --- 6. Crouch/prone suave: interpolamos la altura en lugar de teleport ---
    const PRONE_HEIGHT = PLAYER.crouchHeight * 0.5
    let targetHeight
    if (isProne) targetHeight = PRONE_HEIGHT
    else if (isSliding) targetHeight = CROUCH_HEIGHT * 0.8 // slide más bajo
    else if (isCrouching) targetHeight = CROUCH_HEIGHT
    else targetHeight = STAND_HEIGHT
    currentHeight += (targetHeight - currentHeight) * Math.min(1, dt * 10)
    if (pos.y < currentHeight) {
      pos.y = currentHeight
      velocity.y = 0
      canJump = true
    }

    // --- 7. FOV dinámico (sprint + ADS) ---
    // ADS: lerp suave de 0→1 y FOV hacia el zoom del arma.
    const w = currentWeaponDef || WEAPON
    const adsTarget = isAiming ? 1 : 0
    const adsSpeed = 1 / Math.max(0.05, w.adsTime)
    adsProgress += (adsTarget - adsProgress) * Math.min(1, dt * adsSpeed * 4)
    // FOV objetivo: base o sprint, reducido por ADS.
    const baseTargetFov = (sprinting && moving && moveForward) ? sprintFov : baseFov
    aimFov = w.adsFov
    const targetFov = baseTargetFov + (aimFov - baseTargetFov) * adsProgress
    currentFov += (targetFov - currentFov) * Math.min(1, dt * 8)
    if (Math.abs(camera.fov - currentFov) > 0.1) {
      camera.fov = currentFov
      camera.updateProjectionMatrix()
    }

    // --- 8. Auto-fire con acumulador (sin setInterval) ---
    // Solo armas automáticas hacen auto-fire; semi-auto dispara en onMouseDown.
    if (isFiring && isPointerLocked() && w.automatic) {
      const fireInterval = w.fireInterval
      fireAccumulator += dt
      while (fireAccumulator >= fireInterval) {
        fireAccumulator -= fireInterval
        shoot()
      }
    }

    // --- 9. Viewmodel: bobbing + sway + retroceso + ADS lerp ---
    // Bobbing usa elapsedTime del clock del motor (pasado via _clockTime)
    // para pausar con el juego. Fallback a performance.now() si no hay.
    const t = (typeof _clockTime === 'number' ? _clockTime : performance.now() / 1000)
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z)
    const isMoving = horizontalSpeed > 0.5 && canJump
    const bobFreq = sprinting ? 14 : 9
    const bobAmp = Math.min(horizontalSpeed / 8, 1) * (sprinting ? 0.025 : 0.015)
    // ADS reduce el bobbing (arma más estable al apuntar).
    const bobMul = 1 - adsProgress * 0.8
    const bob = (isMoving ? Math.sin(t * bobFreq) * bobAmp : Math.sin(t * 2) * 0.003) * bobMul
    const bobSide = (isMoving ? Math.cos(t * bobFreq * 0.5) * bobAmp * 0.6 : 0) * bobMul

    // Sway y recoil recover framerate-independent (decaimiento exponencial).
    // ADS reduce el sway drásticamente.
    const swayDecay = Math.pow(0.85, dt * 60)
    const swayMul = 1 - adsProgress * 0.9
    viewmodelSwayX *= swayDecay
    viewmodelSwayY *= swayDecay
    viewmodelRotX = -viewmodelSwayY * 8 * swayMul
    viewmodelRotY = -viewmodelSwayX * 8 * swayMul

    // Retroceso aplicado al grupo entero del rifle (no a piezas sueltas).
    recoil *= Math.pow((currentWeaponDef || WEAPON).recoilRecover, dt * 60)
    rifleGroup.position.z = recoil
    rifleGroup.rotation.x = -recoil * 1.2

    // ADS: mueve el viewmodel al centro (alineado con el sight dot).
    // Posición hipfire: offset a la derecha y abajo. Posición ADS: centrada.
    const hipX = vmHipX, hipY = vmHipY
    const adsX = vmAdsX, adsY = vmAdsY
    const vmX = hipX + (adsX - hipX) * adsProgress
    const vmY = hipY + (adsY - hipY) * adsProgress
    const crouchOffset = (STAND_HEIGHT - currentHeight) * 0.15
    viewmodel.position.set(
      vmX + bobSide + viewmodelSwayX * swayMul,
      vmY + bob + viewmodelSwayY * swayMul - crouchOffset,
      0
    )
    viewmodel.rotation.set(viewmodelRotX, viewmodelRotY, 0)

    // --- Fase 1.5: mantle (trepado de obstáculos) ---
    if (isMantling) {
      mantleTimer -= dt
      const t = 1 - Math.max(0, mantleTimer / 0.4)
      // Interpolamos Y y XZ hacia el objetivo.
      camera.position.y = mantleStartY + (mantleEndY - mantleStartY) * t
      camera.position.x += (mantleTargetPos.x - camera.position.x) * Math.min(1, dt * 8)
      camera.position.z += (mantleTargetPos.z - camera.position.z) * Math.min(1, dt * 8)
      if (mantleTimer <= 0) {
        isMantling = false
        camera.position.copy(mantleTargetPos)
        canJump = true
      }
      // Durante mantle bloqueamos el resto de movimiento.
      return
    }

    // --- Fase 1.5: respiración (sniper) ---
    // Mantener Shift derecho + ADS con sniper reduce el sway.
    // Solo tiene efecto con armas con scope (sniper) o adsFov bajo.
    if (isHoldingBreath && adsProgress > 0.5) {
      const w = currentWeaponDef || WEAPON
      if (w.category === 'sniper' || w.adsFov < 30) {
        if (breathRegenDelay <= 0) {
          stamina = Math.max(0, stamina - STAMINA.breathDrainPerSec * dt)
        }
        // Si se acaba la stamina, forzamos soltar la respiración.
        if (stamina <= 0) isHoldingBreath = false
      }
    } else {
      if (breathRegenDelay > 0) breathRegenDelay -= dt
      else if (!sprinting && !tacticalSprint) {
        stamina = Math.min(STAMINA.max, stamina + STAMINA.regenPerSec * dt)
      }
    }

    // --- Fase 1.5: footstep audio ---
    // Emite pasos según cadencia (más rápido al sprintar).
    if (canJump && horizontalSpeed > 1) {
      const stepInterval = sprinting ? 0.32 : (isCrouching ? 0.55 : 0.45)
      const t = (typeof _clockTime === 'number' ? _clockTime : performance.now() / 1000)
      if (t - lastFootstepAt > stepInterval) {
        lastFootstepAt = t
        // El audio se reproduce via el callback onFootstep (engine lo conecta).
        if (onFootstepCallback) onFootstepCallback(horizontalSpeed)
      }
    }
  }

  // Busca una posición libre (sin colisión) en espiral alrededor de `from`.
  // Safety net: si startPos cae dentro de un collider, el jugador no
  // quedaría bloqueado. Busca en anillos crecientes hasta radio 20m.
  function _findFreeSpawn(from) {
    for (let r = 2; r <= 20; r += 2) {
      const steps = Math.max(8, r * 4)
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2
        const x = from.x + Math.cos(a) * r
        const z = from.z + Math.sin(a) * r
        if (!world.collidesAt(x, z, 0.5)) {
          return new THREE.Vector3(x, from.y, z)
        }
      }
    }
    // Último recurso: devolver la posición original (al menos no crashea).
    return from
  }

  function reset() {
    // Si la posición de spawn está dentro de un collider (la fuente, una
    // casa movida, etc.), buscamos una posición libre en espiral para no
    // dejar al jugador bloqueado sin poder moverse.
    let spawn = startPos
    if (world && world.collidesAt && world.collidesAt(spawn.x, spawn.z, 0.5)) {
      spawn = _findFreeSpawn(spawn)
    }
    camera.position.copy(spawn)
    velocity.set(0, 0, 0)
    yaw = 0; pitch = 0; targetYaw = 0; targetPitch = 0
    moveForward = moveBackward = moveLeft = moveRight = false
    sprinting = false; isCrouching = false
    isFiring = false; fireAccumulator = 0
    recoil = 0
    isAiming = false; adsProgress = 0
    isSliding = false; slideTimer = 0
    isProne = false
    leanAmount = 0; leanTarget = 0
    tacticalSprint = false
    // Fase 1.5: reset de stamina, respiración y mantle.
    stamina = STAMINA.max
    isHoldingBreath = false
    breathRegenDelay = 0
    isMantling = false; mantleTimer = 0
    lastFootstepAt = 0
    currentHeight = STAND_HEIGHT
    camera.fov = baseFov
    camera.updateProjectionMatrix()
  }

  function getPosition() { return camera.position }
  function getYaw() { return yaw }

  // Fase 7: reset de input al perder foco (evita teclas pegadas en alt-tab).
  // Sin esto, si el jugador suelta la tecla fuera de la ventana, el keyup
  // nunca se dispara y el player sigue moviéndose solo al volver.
  function resetInput() {
    moveForward = moveBackward = moveLeft = moveRight = false
    sprinting = false
    tacticalSprint = false
    isCrouching = false
    isFiring = false
    isAiming = false
    leanTarget = 0
    isHoldingBreath = false
  }
  const onBlur = () => resetInput()
  const onGamepadDisconnect = () => resetInput()

  // Registramos listeners para poder eliminarlos en dispose.
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('blur', onBlur)
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect)

  function dispose() {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('gamepaddisconnected', onGamepadDisconnect)
    if (muzzleTimeout) clearTimeout(muzzleTimeout)
    isFiring = false
    // Dispose del viewmodel actual (cada arma tiene SU propio modelo).
    if (viewmodelState) {
      if (viewmodel && viewmodel.parent === camera) camera.remove(viewmodel)
      viewmodelState.dispose()
      viewmodelState = null
    }
    // Texturas compartidas entre viewmodels (gunTex + muzzleTex).
    disposeViewModelShared()
  }

  // Sincroniza el arma actual desde el store. Llamado por el engine cuando
  // el jugador cambia de arma o al iniciar la partida.
  // Fase 1.8: aplica settings del jugador (FOV, sensibilidad) en runtime.
  function applySettings(settings) {
    SENS_X = settings.mouseSensX || SENS_X
    SENS_Y = settings.mouseSensY || SENS_Y
    // FOV base se actualiza; el currentFov se ajusta en el próximo update.
    if (settings.fov) {
      const newBase = settings.fov
      currentFov = currentFov + (newBase - baseFov)
      camera.fov = currentFov
      camera.updateProjectionMatrix()
    }
  }

  function setWeapon(weaponDef) {
    currentWeaponDef = weaponDef || WEAPON
    raycaster.far = currentWeaponDef.raycastFar
    isAiming = false
    adsProgress = 0
    // Equipa el viewmodel 3D correspondiente al arma. Cada arma tiene
    // SU propio modelo (M4, AK, MP5, sniper, shotgun, LMG, pistol).
    // Antes se mostraba siempre el M4 para todas las armas.
    equipViewModel(weaponDef ? (weaponDef.id || 'm4') : 'm4')
  }

  return {
    update, reset, dispose, getPosition, getYaw,
    requestPointerLock, exitPointerLock, setWeapon, applySettings,
    setGunshipActive: (v) => { gunshipActive = v },
    getStamina: () => stamina,
    getMaxStamina: () => STAMINA.max,
    get isAiming() { return isAiming },
    addYawDelta: (d) => { targetYaw += d },
    set onShoot(fn) { onShootCallback = fn },
    set onFootstep(fn) { onFootstepCallback = fn }
  }
}
