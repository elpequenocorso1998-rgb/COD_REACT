import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { createWorld } from './world.js'
import { createPlayer } from './player.js'
import { createEnemyManager, ENEMY_TYPES, WAVE_SCALING } from './enemies.js'
import { createParticleSystem } from './particles.js'
import { createEnvironment } from './environment.js'
import { createAudioSystem } from './audio.js'
import { createMinimap } from './minimap.js'
import { createStreakManager } from './streaks.js'
import { createGrenadeSystem } from './grenades.js'
import { createDecalSystem } from './decals.js'
import { createPickupSystem } from './pickups.js'
import { NavMesh } from './navmesh.js'
import { createRemotePlayerManager } from './remote-players.js'
import { useGameStore, GAME_STATES } from './store.js'
import {
  FOV, CAMERA_NEAR, CAMERA_FAR, MAX_PARTICLES, WAVE_BASE, WAVE_PER_WAVE,
  FLOOR_SIZE
} from './constants.js'
import { GRENADES, PLAYER } from './config.js'
import { getLoadout } from './loadout.js'
import { getSettings } from './settings.js'
import { FpsSampler, applyQuality } from './quality.js'

/* =========================================================================
   Motor del juego.
   --------------------------------------------------------------------------
   Orquesta Three.js con post-procesado cinematográfico:
   - RenderPass: renderiza la escena a un buffer.
   - UnrealBloomPass: halo luminoso en luces, muzzle flash y emisivos.
   - ShaderPass (vignette + chromatic aberration + grano + god rays).
   - SMAAPass: anti-aliasing de alta calidad.
   - OutputPass: conversión a sRGB final.

   Mejoras:
   - God rays: 16 samples (no 32) + check si el sol está detrás de cámara.
   - Resolution uniform del shader se actualiza en resize.
   - No hay doble vignette: la quitamos del CSS, solo queda la del shader.
   - Game loop: NO renderiza durante PAUSED (ahorra GPU).
   - Wave check: en cada frame (no cada 1s).
   - Pointer lock se libera en game over y al salir al menú.
   - Audio se mutea en game over y al salir al menú.
   - Auto-pausa en visibilitychange y pointerlockchange (alt-tab seguro).
   - applyQuality se difiere al inicio del siguiente frame (no mid-frame).
   - Dispose completo: world, player, enemies, particles, audio, passes, envMap.
   ========================================================================= */

// --- Constantes de motor (antes mágicas) ---
const MAX_DT = 0.05              // clamp de dt para evitar tunneling de física
const QUALITY_WARMUP_FRAMES = 60 // frames de sampleo antes de aplicar calidad
const WAVE_BASE_POINTS = 90      // puntos base por kill en oleada n

export function createEngine() {
  let scene, camera, renderer, clock, composer
  let world, player, enemies, particles, audio, minimap, streaks, grenades, decals, pickups
  let navmesh = null
  let sunMesh = null
  let remotePlayers = null
  let netClientRef = null
  let netInputTimer = 0
  // Fase 1.8: buffer circular para killcam (posiciones de cámara).
  const KILLCAM_BUFFER_SIZE = 150 // ~5s a 30fps de sampleo
  const KILLCAM_SAMPLE_INTERVAL = 1 / 30
  const killcamBuffer = []
  let killcamSampleTimer = 0
  let killcamActive = false
  let killcamPlaybackIndex = 0
  let killcamPlaybackTimer = 0
  let cinematicPass = null
  let ssaoPass = null
  let rafId = null
  let mounted = false
  let container = null
  let prevState = null
  let envMap = null
  // Fase 6: settings del jugador (showFps, etc.) + contador de FPS.
  const _settings = getSettings()
  let _fpsAccum = 0
  let _fpsFrames = 0
  // Flag de pérdida de contexto WebGL: sesiones largas o cambio de pestaña
  // pueden hacer que el driver pierda el contexto. Lo manejamos para no
  // crashes; el renderer de Three.js re-sube recursos al reanudar.
  let contextLost = false
  let onContextLost = null
  let onContextRestored = null
  // Auto-pausa por alt-tab / pérdida de pointer lock (definidas más abajo).
  // Medidor de FPS para escalado de calidad dinámico.
  let fpsSampler = null
  let bloomPassRef = null
  // Calidad pendiente de aplicar al inicio del siguiente frame (evita
  // mutar renderer/passes mid-frame: glitch de 1 frame y RTs inválidos).
  let pendingQuality = null
  // Callback que App.jsx registra para recibir el canvas del minimap.
  let onMinimapReady = null
  // Gunship: raycaster + plano del suelo para click-to-shoot.
  let _onGunshipClick = null
  const _gunshipRay = new THREE.Raycaster()
  const _gunshipGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const _gunshipPoint = new THREE.Vector3()
  // Cooldown de granadas (evita spam).
  let lastGrenadeAt = 0
  const GRENADE_COOLDOWN = GRENADES.cooldown * 1000 // ms (config en segundos)
  // Vectores scratch para lanzar granadas.
  const _grenadeOrigin = new THREE.Vector3()
  const _grenadeDir = new THREE.Vector3()
  // Vectores scratch para decals de impacto en pared.
  const _decalRay = new THREE.Raycaster()
  const _decalPoint = new THREE.Vector3()
  const _decalNormal = new THREE.Vector3()
  const _decalRayObj = new THREE.Ray()

  // Encuentra el punto de impacto en una pared y coloca un decal de bala.
  function spawnBulletDecal(origin, dir, far) {
    if (!world || !decals) return
    _decalRayObj.set(origin, dir)
    let closestDist = Infinity
    let hit = false
    for (const c of world.colliders) {
      if (_decalRayObj.intersectBox(c.box, _decalPoint)) {
        const d = origin.distanceTo(_decalPoint)
        if (d < closestDist && d <= far) {
          closestDist = d
          _decalNormal.copy(dir).negate()
          hit = true
        }
      }
    }
    if (hit) {
      decals.spawnBulletHole(_decalPoint, _decalNormal)
    }
  }

  const store = useGameStore

  /* ----------------------------------------------------------------------
     MONTAR: construye escena, renderer, post-procesado y sistemas.
     ---------------------------------------------------------------------- */
  function mount(containerEl) {
    if (mounted) {
      // Idempotente: StrictMode monta dos veces en dev; ignoramos el
      // segundo mount para no crear dos renderers (antes crasheaba).
      return
    }
    container = containerEl
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07090e)

    camera = new THREE.PerspectiveCamera(
      FOV, container.clientWidth / container.clientHeight, CAMERA_NEAR, CAMERA_FAR
    )

    // --- RENDERER ---
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.VSMShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    renderer.domElement.classList.add('game-canvas')

    // --- POST-PROCESADO ---
    composer = new EffectComposer(renderer)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    composer.setSize(container.clientWidth, container.clientHeight)

    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const ssaoPassLocal = new SSAOPass(
      scene, camera, container.clientWidth, container.clientHeight
    )
    ssaoPassLocal.kernelRadius = 0.5
    ssaoPassLocal.minDistance = 0.001
    ssaoPassLocal.maxDistance = 0.1
    composer.addPass(ssaoPassLocal)
    ssaoPass = ssaoPassLocal

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.7, 0.4, 0.85
    )
    composer.addPass(bloomPass)
    bloomPassRef = bloomPass

    cinematicPass = new ShaderPass(CinematicShader)
    // Inicializamos el uniform de resolución correctamente.
    cinematicPass.uniforms.resolution.value.set(
      container.clientWidth, container.clientHeight
    )
    composer.addPass(cinematicPass)

    const smaaPass = new SMAAPass(
      container.clientWidth, container.clientHeight
    )
    composer.addPass(smaaPass)

    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    clock = new THREE.Clock()

    // --- SISTEMAS DEL JUEGO ---
    world = createWorld(scene)
    // NavMesh (Fase 1.2): grid walkable generado desde world.colliders.
    // Se usa para pathfinding A* de la IA táctica.
    navmesh = new NavMesh(world, FLOOR_SIZE, 2)
    envMap = createEnvironment(scene, renderer)
    particles = createParticleSystem(scene, { max: MAX_PARTICLES })
    player = createPlayer(scene, camera, world, particles, renderer)
    audio = createAudioSystem()
    enemies = createEnemyManager(scene, world, particles, audio, navmesh)
    minimap = createMinimap()
    // El canvas del minimap lo adjuntamos al HUD via un callback que App.jsx
    // registra. Así React no re-renderiza el canvas (es imperativo).
    if (onMinimapReady) onMinimapReady(minimap.canvas)
    streaks = createStreakManager(scene, enemies, particles, audio, player, camera, store)
    grenades = createGrenadeSystem(scene, world, enemies, particles, audio, player, store)
    decals = createDecalSystem(scene, { maxDecals: 80 })
    // Fase 5: pickups (drops de enemigos al morir).
    pickups = createPickupSystem(scene, store, particles, audio)

    sunMesh = world.sunMesh

    // Conexión enemigos -> jugador/store/partículas/audio.
    enemies.onReachPlayer = (enemy) => {
      const playerPos = player.getPosition()
      const dx = enemy.group.position.x - playerPos.x
      const dz = enemy.group.position.z - playerPos.z
      const worldAngle = Math.atan2(dx, dz)
      const playerYaw = player.getYaw ? player.getYaw() : 0
      const relAngle = worldAngle - playerYaw
      store.getState().takeDamage(enemy.damage, relAngle)
      audio.playDamage()
      // Marca muzzle report para el minimap (punto parpadeante).
      enemies.markShot(enemy)
    }
    enemies.onKilled = (enemy, points) => {
      const st = store.getState()
      // Fase 4: pasamos si fue headshot para el daily de headshots.
      // enemies.js llama a onKilled cuando hp <= 0 tras handleShot;
      // no tenemos el flag de headshot directo aquí, pero el killmarker
      // ya se registró en registerHit. Para el daily usamos un heuristic:
      // si el último hitmarker fue headshot, contamos como headshot kill.
      st.registerKill(points)
      audio.playKill()
      audio.playHitMarker('kill')
      // Multikill callout si hay label nuevo.
      const label = store.getState().multikillLabel
      if (label) audio.playCallout(label)
      // Level up sound si subió de nivel.
      if (store.getState().levelUpFlash) audio.playLevelUp()
      // Fase 5: suelta pickups en la posición del enemigo muerto.
      if (pickups && enemy.group) {
        pickups.onEnemyKilled(enemy.group.position)
      }
    }

    // Enemigo disparador: aplica daño al jugador con dirección.
    enemies.onShootPlayer = (enemy, damage) => {
      const playerPos = player.getPosition()
      const dx = enemy.group.position.x - playerPos.x
      const dz = enemy.group.position.z - playerPos.z
      const worldAngle = Math.atan2(dx, dz)
      const playerYaw = player.getYaw ? player.getYaw() : 0
      const relAngle = worldAngle - playerYaw
      store.getState().takeDamage(damage, relAngle)
      audio.playDamage()
      // Marca muzzle report para el minimap.
      enemies.markShot(enemy)
    }

    player.onFootstep = (speed) => {
      // Fase 1.5: pasos del jugador con audio procedural.
      // Material: por defecto 'stone' (suelo de adoquines de Pamplona).
      if (audio && audio.playFootstep) audio.playFootstep(speed, 'stone')
    }

    player.onShoot = (originVec, dirVec, freeShot = false) => {
      // freeShot=true: pellets adicionales de shotgun, no consumen munición
      // ni reproducen sonido de disparo (solo hit-test).
      if (!freeShot) {
        // Comprobamos munición ANTES de cualquier efecto visual/sonoro:
        // si no hay bala, no hay flash ni sonido de impacto en pared.
        if (!store.getState().fire()) return false
        audio.playShoot()
      }
      const weaponDef = store.getState().getCurrentWeapon()
      const hitEnemy = enemies.handleShot(originVec, dirVec, (enemy, isHead, hitPoint, hitNormal, hitType) => {
        const wasKill = enemy.hp <= 0
        // Fase 1.3: hitType distingue head/body/wallbang/limb/stomach.
        const markerType = wasKill ? 'kill' : (hitType || (isHead ? 'headshot' : 'body'))
        const points = isHead ? 25 : (hitType === 'wallbang' ? 30 : 10)
        if (!wasKill) {
          store.getState().registerHit(points, markerType)
          audio.playHitMarker(markerType)
          audio.playHitFlesh()
        } else {
          // En kill registramos el hit como 'kill' pero el sonido de kill
          // marker lo reproduce el callback onKilled (junto con playKill).
          store.getState().registerHit(points, 'kill')
        }
        particles.spawnBlood(hitPoint, hitNormal)
        // Splat de sangre en el suelo si el impacto fue bajo.
        if (hitPoint.y < 1.5 && decals) decals.spawnBloodSplat(hitPoint)
      }, weaponDef)
      if (!hitEnemy && !freeShot) {
        audio.playHitWall()
        // Decal de agujero de bala en la pared.
        if (decals) {
          // Raycast para encontrar el punto exacto y la normal de la pared.
          spawnBulletDecal(originVec, dirVec, weaponDef.raycastFar)
        }
        // Fase 1.2: fuego de supresión. Si el disparo pasó cerca de un
        // enemigo sin impactar, lo mandamos a TakeCover. Esto simula el
        // "fuego de supresión" de CoD: el enemigo se agacha al sentir balas.
        if (enemies.suppressNear) {
          // Sampleamos varios puntos a lo largo del rayo y suprimimos
          // cualquier enemigo dentro de 2m del trayecto.
          const samples = 8
          for (let s = 1; s <= samples; s++) {
            const t = s / samples
            const px = originVec.x + dirVec.x * weaponDef.raycastFar * t
            const py = originVec.y + dirVec.y * weaponDef.raycastFar * t
            const pz = originVec.z + dirVec.z * weaponDef.raycastFar * t
            enemies.suppressNear({ x: px, y: py, z: pz }, 2.5)
          }
        }
      }
      return hitEnemy
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibilityChangeFn)
    document.addEventListener('pointerlockchange', onPointerLockChangeFn)

    // --- Gunship: click dispara cañón al suelo durante gunship active ---
    _onGunshipClick = (e) => {
      if (!streaks || !streaks.isGunshipActive()) return
      // Raycast desde cámara al suelo (plano y=0).
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1
      _gunshipRay.setFromCamera({ x: ndcX, y: ndcY }, camera)
      const intersect = _gunshipRay.intersectPlane(_gunshipGround, _gunshipPoint)
      if (intersect) streaks.gunshipShootAt(_gunshipPoint)
    }
    window.addEventListener('mousedown', _onGunshipClick)

    // --- Pérdida de contexto WebGL ---
    // El driver puede perder el contexto en sesiones largas o al cambiar
    // de pestaña. preventDefault() permite la restauración; Three.js
    // re-sube geometrías/texturas/programas al siguiente render.
    onContextLost = (e) => {
      e.preventDefault()
      contextLost = true
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      if (audio) audio.setMuted(true)
    }
    onContextRestored = () => {
      contextLost = false
      // El delta del clock será grande tras la pérdida; el clamp a MAX_DT
      // en loop() evita explosiones de física.
      if (clock) clock.getDelta()
      if (audio && store.getState().gameState === GAME_STATES.PLAYING) {
        audio.setMuted(false)
      }
      // Guard contra doble rAF: si ya hay un loop corriendo, no rearma.
      if (!rafId && mounted) rafId = requestAnimationFrame(loop)
    }
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false)

    mounted = true
    prevState = store.getState().gameState
    store.getState().setLoading(false)

    // Escalado de calidad dinámico: medimos FPS durante QUALITY_WARMUP_FRAMES
    // y ajustamos SSAO/bloom/god rays/shadow map al perfil detectado.
    // En GPUs modestas esto evita <30 FPS persistentes.
    fpsSampler = new FpsSampler(QUALITY_WARMUP_FRAMES, (quality) => {
      // No aplicamos aquí (mid-frame): lo diferimos al inicio del siguiente
      // loop para no disposing shadow maps entre update y render.
      pendingQuality = quality
    })

    loop()
  }

  /* ----------------------------------------------------------------------
     Auto-pausa: si la pestaña pasa a hidden o se pierde el pointer lock
     durante PLAYING, pausamos. Evita la muerte por alt-tab.
     ---------------------------------------------------------------------- */
  function onVisibilityChangeFn() {
    const st = store.getState()
    if (document.hidden && st.gameState === GAME_STATES.PLAYING) {
      st.setState(GAME_STATES.PAUSED)
      if (audio) audio.setMuted(true)
      if (player) player.exitPointerLock()
    }
  }

  function onPointerLockChangeFn() {
    const st = store.getState()
    // Si el usuario sale del pointer lock por cualquier medio que no sea
    // Esc (alt-tab, click en devtools, etc.) durante PLAYING, pausamos.
    if (st.gameState === GAME_STATES.PLAYING && document.pointerLockElement == null) {
      st.setState(GAME_STATES.PAUSED)
      if (audio) audio.setMuted(true)
    }
  }

  /* ----------------------------------------------------------------------
     BUCLE PRINCIPAL.
     ---------------------------------------------------------------------- */
  const _sunWorld = new THREE.Vector3()
  const _sunScreen = new THREE.Vector3()

  function loop() {
    if (!mounted || contextLost) return
    rafId = requestAnimationFrame(loop)

    // Calidad diferida: aplicamos al inicio del frame (antes de update y
    // render) para no disposear shadow maps mid-frame.
    if (pendingQuality) {
      applyQuality(pendingQuality, renderer, {
        ssaoPass, bloomPass: bloomPassRef, cinematicPass,
        sun: world.sun
      })
      // Tras cambiar pixelRatio, reajustamos composer para que sus RTs
      // queden consistentes.
      composer.setSize(container.clientWidth, container.clientHeight)
      pendingQuality = null
    }

    const dt = Math.min(clock.getDelta(), MAX_DT)
    const state = store.getState().gameState

    // Fase 6: FPS counter para el HUD (si showFps está activo en settings).
    if (_settings.showFps) {
      _fpsAccum += dt
      _fpsFrames++
      if (_fpsAccum >= 0.5) {
        store.getState().setFps(Math.round(_fpsFrames / _fpsAccum))
        _fpsAccum = 0
        _fpsFrames = 0
      }
    }

    // Escalado de calidad: samplea FPS hasta detectar el perfil.
    if (fpsSampler) fpsSampler.sample(dt)

    // Detectar transiciones de estado para mutear audio y liberar pointer.
    if (state !== prevState) {
      if (state === GAME_STATES.GAMEOVER || state === GAME_STATES.MENU || state === GAME_STATES.PAUSED) {
        audio.setMuted(true)
        player.exitPointerLock()
      }
      prevState = state
    }

    if (state === GAME_STATES.PLAYING) {
      // Actualizamos enemigos ANTES que player: así las posiciones que
      // player usa para raycast (handleShot) son del frame actual, no
      // del anterior (reduce latencia de hit-detection 1 frame).
      const st = store.getState()
      enemies.update(dt, player.getPosition())
      player.update(dt, clock.elapsedTime)
      // Fase 1.8: graba posiciones de cámara para killcam (buffer circular).
      killcamSampleTimer += dt
      if (killcamSampleTimer >= KILLCAM_SAMPLE_INTERVAL) {
        killcamSampleTimer = 0
        const pos = player.getPosition()
        killcamBuffer.push({
          x: pos.x, y: pos.y, z: pos.z,
          yaw: player.getYaw(),
          time: clock.elapsedTime
        })
        if (killcamBuffer.length > KILLCAM_BUFFER_SIZE) killcamBuffer.shift()
      }
      // Fase 1.5: sincroniza stamina del player con el store (para HUD).
      if (player.getStamina) {
        st.setStamina(player.getStamina(), player.getMaxStamina())
      }
      world.update(dt)
      // Fase 4: regeneración de vida (estilo CoD). Si ha pasado el
      // regenDelay sin recibir daño, la vida sube gradualmente. Sin esto
      // el chip damage se acumula y el juego es injugable.
      if (st.health < st.maxHealth && st.lastDamageAt > 0) {
        const now = performance.now()
        if (now - st.lastDamageAt >= PLAYER.regenDelay * 1000) {
          st.regenHealth(PLAYER.regenPerSec * dt)
        }
      }
      // Farolas dinámicas: activa las cercanas al jugador.
      if (world.updateLamps) world.updateLamps(player.getPosition())
      // Fase 1.7: sombras siguen al jugador (aproximación CSM).
      if (world.updateShadows) world.updateShadows(player.getPosition())
      particles.update(dt)
      // Fase 2: actualiza jugadores remotos (interpolación entre snapshots).
      if (remotePlayers) remotePlayers.update(dt)
      // Fase 2: envía input del player local al servidor MP (60Hz).
      if (netClientRef && netClientRef.connected) {
        netInputTimer += dt
        if (netInputTimer >= 1 / 60) {
          netInputTimer = 0
          const pos = player.getPosition()
          netClientRef.sendInput({
            pos: { x: pos.x, y: pos.y, z: pos.z },
            yaw: player.getYaw(),
            pitch: 0,
            weapon: st.currentWeapon,
            firing: st.firing,
            alive: st.health > 0,
            health: st.health
          })
        }
      }
      // Minimap: rotate-with-player, enemigos como puntos rojos.
      if (minimap) {
        minimap.update(dt, player.getPosition(), player.getYaw(), enemies, st.uavActive)
      }
      // Killstreaks activos (heli orbitando, etc).
      if (streaks) streaks.update(dt, player.getPosition())
      // Granadas en vuelo.
      if (grenades) grenades.update(dt, player.getPosition())
      // Fase 5: pickups (detección de proximidad).
      if (pickups) pickups.update(dt, player.getPosition())
      // Fase 6: aim assist suave (si está activo en settings y en ADS).
      // Snap suave hacia el enemigo más cercano al centro de la pantalla.
      if (_settings.aimAssist > 0 && player.isAiming && enemies) {
        const pos = player.getPosition()
        const yaw = player.getYaw()
        let best = null, bestScore = Infinity
        enemies.forEachAlive((epos, _t, _ls, _e) => {
          const dx = epos.x - pos.x
          const dz = epos.z - pos.z
          const dist = Math.hypot(dx, dz)
          if (dist > 60 || dist < 2) return
          // Ángulo entre la dirección de mira y el enemigo.
          const enemyAngle = Math.atan2(dx, dz)
          let diff = enemyAngle - yaw
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          if (Math.abs(diff) > 0.15) return // fuera del cono de aim assist
          const score = Math.abs(diff) + dist * 0.01
          if (score < bestScore) { bestScore = score; best = { diff, dist } }
        })
        if (best) {
          // Snap suave: mueve la cámara hacia el enemigo proporcional al
          // setting de aimAssist y al dt.
          const strength = _settings.aimAssist * 0.5 * dt
          player.addYawDelta(best.diff * strength)
        }
      }
      // Decals: fade out gradual de los más antiguos.
      if (decals) decals.update(dt)
      // Música dinámica: intensidad según enemigos vivos y vida del jugador.
      if (audio && audio.setMusicIntensity) {
        const enemyCount = enemies.count
        const health = st.health
        let intensity = 0 // calma
        if (enemyCount >= 5 || health <= 50) intensity = 1 // combate
        if (enemyCount >= 10 || health <= 25) intensity = 2 // clímax
        audio.setMusicIntensity(intensity)
      }
      // Wave check en cada frame (sin delay de 1s).
      checkWaveProgress()
    }

    // Actualizamos uniforms del shader cinematográfico.
    if (cinematicPass && sunMesh) {
      cinematicPass.uniforms.time.value = clock.elapsedTime
      _sunWorld.copy(sunMesh.position)
      _sunScreen.copy(_sunWorld).project(camera)
      const behindCamera = _sunScreen.z > 1
      cinematicPass.uniforms.sunScreenPos.value.set(
        _sunScreen.x * 0.5 + 0.5,
        _sunScreen.y * 0.5 + 0.5
      )
      // Desactiva god rays si el sol está detrás de la cámara.
      cinematicPass.uniforms.godRaysIntensity.value = behindCamera ? 0 : 0.5
    }

    // Fase 1.8: killcam playback. Cuando el jugador muere, reproducimos
    // los últimos 5s de su cámara en bucle hasta que reinicia.
    if (state === GAME_STATES.GAMEOVER && killcamBuffer.length > 0) {
      if (!killcamActive) {
        killcamActive = true
        killcamPlaybackIndex = 0
        killcamPlaybackTimer = 0
      }
      killcamPlaybackTimer += dt
      if (killcamPlaybackTimer >= KILLCAM_SAMPLE_INTERVAL) {
        killcamPlaybackTimer = 0
        killcamPlaybackIndex = (killcamPlaybackIndex + 1) % killcamBuffer.length
        const frame = killcamBuffer[killcamPlaybackIndex]
        if (frame && camera) {
          camera.position.set(frame.x, frame.y, frame.z)
          // Reconstruimos rotación desde yaw (pitch=0 para killcam simple).
          camera.rotation.order = 'YXZ'
          camera.rotation.y = frame.yaw
          camera.rotation.x = 0
          camera.rotation.z = 0
        }
      }
    } else if (killcamActive && state !== GAME_STATES.GAMEOVER) {
      killcamActive = false
    }

    // Render: en PAUSA no renderizamos (ahorra GPU, la imagen queda congelada).
    if (state !== GAME_STATES.PAUSED) {
      composer.render(dt)
    }
  }

  /* ----------------------------------------------------------------------
     Input global (R recarga, ESC pausa).
     ---------------------------------------------------------------------- */
  function onKeyDown(e) {
    const st = store.getState()
    if (e.code === 'KeyR' && st.gameState === GAME_STATES.PLAYING) {
      if (!st.reloading && st.ammo < st.magSize && st.reserve > 0) {
        st.reload()
        audio.playReload()
      }
    }
    if (e.code === 'Escape' && st.gameState === GAME_STATES.PLAYING) {
      st.setState(GAME_STATES.PAUSED)
      audio.setMuted(true)
      player.exitPointerLock()
    }
    // --- Cambio de arma: teclas 1-7 ---
    if (st.gameState === GAME_STATES.PLAYING) {
      const weaponMap = {
        Digit1: 'm4', Digit2: 'ak47', Digit3: 'mp5',
        Digit4: 'sniper', Digit5: 'shotgun', Digit6: 'lmg', Digit7: 'pistol'
      }
      // Nota: Digit4-7 también se usan para killstreaks. Damos prioridad al
      // cambio de arma si hay un killstreak disponible del tipo correspondiente.
      // Para evitar conflicto: usamos Shift+1-7 para armas, 1-7 solas para
      // killstreaks cuando hay streaks disponibles.
      const weaponId = weaponMap[e.code]
      if (weaponId && e.shiftKey) {
        st.switchWeapon(weaponId)
        player.setWeapon(st.getCurrentWeapon())
        audio.playReload() // sonido de cambio de arma
      }
    }
    // --- Fase 6: swap primary↔secondary con tecla Y ---
    // Antes el loadout.secondary era config muerta: el jugador solo podía
    // cambiar con Shift+1-7. Ahora Y intercambia entre primary y secondary.
    if (e.code === 'KeyY' && st.gameState === GAME_STATES.PLAYING) {
      const loadout = getLoadout()
      const target = (st.currentWeapon === loadout.primary) ? loadout.secondary : loadout.primary
      if (target && target !== st.currentWeapon) {
        st.switchWeapon(target)
        player.setWeapon(st.getCurrentWeapon())
        audio.playReload()
      }
    }
    // --- Killstreaks: teclas 4-7 (sin Shift) ---
    if (st.gameState === GAME_STATES.PLAYING && st.availableStreaks.length > 0 && !e.shiftKey) {
      const streakMap = { Digit4: 'uav', Digit5: 'airstrike', Digit6: 'heli', Digit7: 'gunship' }
      const type = streakMap[e.code]
      if (type) {
        const streak = st.availableStreaks.find((s) => s.type === type)
        if (streak && st.useStreak(streak.id)) {
          streaks.activate(type, player.getPosition())
        }
      }
    }
    // --- Scoreboard: Tab hold ---
    if (e.code === 'Tab') {
      e.preventDefault()
      st.toggleScoreboard(true)
    }
    // --- Granadas: G=frag, X=flash, C=smoke (Q/E son lean) ---
    // Fase 4: las granadas ahora tienen count finito en el store.
    // Fase 6: el tipo de G y X viene del loadout (lethal/tactical),
    // no hardcodeado. Antes loadout.tactical/lethal eran config muerta.
    if (st.gameState === GAME_STATES.PLAYING && grenades) {
      const now = performance.now()
      if (now - lastGrenadeAt >= GRENADE_COOLDOWN) {
        const loadout = getLoadout()
        let grenadeType = null
        if (e.code === 'KeyG') grenadeType = loadout.lethal || 'frag'
        else if (e.code === 'KeyX') grenadeType = loadout.tactical || 'flash'
        else if (e.code === 'KeyC') grenadeType = 'smoke'
        else if (e.code === 'KeyB') grenadeType = 'knife'
        if (grenadeType) {
          if (st.useGrenade(grenadeType)) {
            lastGrenadeAt = now
            _grenadeOrigin.copy(player.getPosition())
            _grenadeDir.set(0, 0, -1).applyQuaternion(camera.quaternion)
            grenades.throwGrenade(grenadeType, _grenadeOrigin, _grenadeDir)
          }
        }
      }
    }
  }

  function onKeyUp(e) {
    const st = store.getState()
    // Scoreboard se cierra al soltar Tab.
    if (e.code === 'Tab') st.toggleScoreboard(false)
  }

  function onResize() {
    if (!container) return
    const w = container.clientWidth, h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    // SSAO necesita su propio setSize (antes no se llamaba: sampling a
    // resolución incorrecta tras resize → artifact visual).
    if (ssaoPass) ssaoPass.setSize(w, h)
    // Actualizamos el uniform de resolución para el grano de filme.
    if (cinematicPass) cinematicPass.uniforms.resolution.value.set(w, h)
  }

  /* ----------------------------------------------------------------------
     API pública.
     ---------------------------------------------------------------------- */
  function startGame() {
    audio.init()
    audio.setMuted(false)
    audio.startMusic()
    store.getState().reset()
    enemies.reset()
    particles.reset()
    if (grenades) grenades.reset()
    if (decals) decals.reset()
    if (pickups) pickups.reset()
    player.reset()
    // Sincroniza el arma inicial del store con el player.
    player.setWeapon(store.getState().getCurrentWeapon())
    spawnWave(1)
    player.requestPointerLock()
  }

  // Fase 2: arranca una partida multijugador (TDM).
  // Conecta el cliente de red al game loop: envía inputs del player local,
  // recibe snapshots y los pasa al remote player manager.
  function startMPGame(netClient) {
    audio.init()
    audio.setMuted(false)
    audio.startMusic()
    store.getState().reset()
    netClientRef = netClient
    // En MP no spawneamos bots: solo jugadores remotos.
    enemies.reset()
    particles.reset()
    if (grenades) grenades.reset()
    if (decals) decals.reset()
    if (pickups) pickups.reset()
    player.reset()
    player.setWeapon(store.getState().getCurrentWeapon())
    // Crea el manager de jugadores remotos si no existe.
    if (!remotePlayers) {
      remotePlayers = createRemotePlayerManager(scene)
    }
    // Registra callbacks del netClient.
    netClient.on('onSnapshot', ({ players }) => {
      if (remotePlayers) remotePlayers.updateSnapshot(players)
    })
    netClient.on('onRespawn', (msg) => {
      if (msg.id === netClient.clientId) {
        // Respawn del player local.
        player.reset()
        // Posición de spawn del servidor.
        if (msg.pos) {
          const pos = player.getPosition()
          pos.set(msg.pos.x, msg.pos.y, msg.pos.z)
        }
      }
    })
    player.requestPointerLock()
  }

  function resumeGame() {
    store.getState().setState(GAME_STATES.PLAYING)
    audio.setMuted(false)
    player.requestPointerLock()
  }

  function quitToMenu() {
    audio.setMuted(true)
    player.exitPointerLock()
    enemies.reset()
    particles.reset()
    if (grenades) grenades.reset()
    if (decals) decals.reset()
    if (pickups) pickups.reset()
    store.getState().setState(GAME_STATES.MENU)
  }

  // Spawnea una oleada mezclando tipos de enemigo según el progreso.
  // Fase 1.2: composición realista (mayoría shooters armados, no zombies).
  // Antes era 80% walkers melee — no parecía CoD.
  function spawnWave(n) {
    const count = WAVE_BASE + n * WAVE_PER_WAVE
    store.getState().startWave(n, count)
    // Tipos disponibles en esta oleada.
    const available = Object.values(ENEMY_TYPES).filter((t) => n >= t.minWave)
    const shootersAvailable = available.filter((t) => t.ranged && t.name !== 'boss')
    for (let i = 0; i < count; i++) {
      let typeDef = ENEMY_TYPES.walker
      // Composición por oleada (estilo CoD PvE):
      //   - Oleada 1-2: 80% walkers melee (introducción suave).
      //   - Oleada 3-5: 60% shooters, 30% walkers, 10% runners.
      //   - Oleada 6+:  70% shooters, 15% walkers, 10% runners, 5% tanks.
      //   - Boss cada 5 oleadas (1 unidad).
      const r = Math.random()
      if (n <= 2) {
        if (available.length > 1 && r < 0.2) {
          const pool = available.filter((t) => t.name !== 'walker' && t.name !== 'boss')
          if (pool.length > 0) typeDef = pool[Math.floor(Math.random() * pool.length)]
        }
      } else if (n % 5 === 0 && i === 0) {
        typeDef = ENEMY_TYPES.boss
      } else {
        if (shootersAvailable.length > 0 && r < 0.65) {
          typeDef = shootersAvailable[Math.floor(Math.random() * shootersAvailable.length)]
        } else if (r < 0.80) {
          typeDef = ENEMY_TYPES.walker
        } else if (n >= 4 && r < 0.95) {
          typeDef = ENEMY_TYPES.tank
        } else {
          typeDef = ENEMY_TYPES.runner
        }
      }
      const hp = typeDef.baseHp + n * WAVE_SCALING.hpPerWave
      const speed = typeDef.baseSpeed + n * WAVE_SCALING.speedPerWave
      const dmg = typeDef.baseDamage + n * WAVE_SCALING.damagePerWave
      const points = typeDef.points + n * WAVE_SCALING.pointsPerWave + WAVE_BASE_POINTS
      enemies.spawn(hp, speed, dmg, points, typeDef)
    }
  }

  function checkWaveProgress() {
    const st = store.getState()
    // Solo spawneamos la siguiente oleada cuando no quedan enemigos vivos
    // NI cadaveres animandose (allCleared). Antes bastaba con
    // enemiesRemaining === 0, lo que spawneaba la nueva oleada mientras
    // los cuerpos de la anterior aun se hundian (solapamiento visual).
    if (st.gameState === GAME_STATES.PLAYING
        && st.enemiesRemaining === 0
        && enemies.allCleared) {
      spawnWave(st.wave + 1)
    }
  }

  /* ----------------------------------------------------------------------
     DISPOSE.
     ---------------------------------------------------------------------- */
  function dispose() {
    mounted = false
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    if (_onGunshipClick) window.removeEventListener('mousedown', _onGunshipClick)
    document.removeEventListener('visibilitychange', onVisibilityChangeFn)
    document.removeEventListener('pointerlockchange', onPointerLockChangeFn)
    if (onContextLost && renderer) {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored, false)
    }
    if (player) player.dispose()
    if (enemies) enemies.dispose()
    if (particles) particles.dispose()
    if (world) world.dispose()
    if (audio) audio.dispose()
    if (minimap) minimap.dispose()
    if (streaks) streaks.dispose()
    if (grenades) grenades.dispose()
    if (decals) decals.dispose()
    if (pickups) pickups.dispose()
    if (remotePlayers) { remotePlayers.dispose(); remotePlayers = null }
    if (composer) composer.dispose()
    // envMap PMREM: antes se leak-eaba en cada recreación del engine.
    if (envMap) { envMap.dispose(); envMap = null }
    if (scene) scene.environment = null
    if (renderer) {
      renderer.dispose()
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }

  function applySettings(settings) {
    if (player) player.applySettings(settings)
    if (audio && audio.setMasterVolume) audio.setMasterVolume(settings.masterVolume)
  }

  return { mount, dispose, startGame, startMPGame, resumeGame, quitToMenu, spawnWave, applySettings,
    set onMinimapReady(fn) { onMinimapReady = fn } }
}

/* =========================================================================
   Shader cinematográfico: vignette + aberración cromática + grano + god rays.
   Mejoras:
   - God rays: 16 samples (no 32) + sin branch if dentro del loop.
   ========================================================================= */
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteIntensity: { value: 1.1 },
    vignetteOffset: { value: 0.3 },
    aberration: { value: 0.0018 },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    sunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    godRaysIntensity: { value: 0.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteIntensity;
    uniform float vignetteOffset;
    uniform float aberration;
    uniform vec2 resolution;
    uniform float time;
    uniform vec2 sunScreenPos;
    uniform float godRaysIntensity;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - vec2(0.5);
      float dist = length(dir);

      // --- Aberración cromática ---
      float ab = aberration * (dist * 2.0);
      vec4 color;
      color.r = texture2D(tDiffuse, uv + dir * ab).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - dir * ab).b;
      color.a = 1.0;

      // --- God rays: radial blur desde la posición del sol ---
      // 16 samples (antes 32) para mejorar rendimiento.
      // Early-out cuando intensidad ~0 (sol detrás de cámara): antes el
      // loop de 16 muestras corría siempre aunque el resultado se
      // multiplicara por 0 (desperdicio de GPU).
      vec2 sunDir = uv - sunScreenPos;
      vec3 godRays = vec3(0.0);
      if (godRaysIntensity > 0.001) {
        const int SAMPLES = 16;
        float illum = 0.0;
        for (int i = 0; i < SAMPLES; i++) {
          float t = float(i) / float(SAMPLES);
          vec2 offset = sunScreenPos + sunDir * t;
          float decay = pow(1.0 - t, 2.0);
          // Sin branch if: usamos step para descartar muestras fuera de pantalla.
          float inBounds = step(0.0, offset.x) * step(offset.x, 1.0)
                         * step(0.0, offset.y) * step(offset.y, 1.0);
          vec3 s = texture2D(tDiffuse, offset).rgb;
          float lum = dot(s, vec3(0.299, 0.587, 0.114));
          illum += smoothstep(0.6, 1.0, lum) * decay * inBounds;
        }
        godRays = vec3(1.0, 0.85, 0.6) * illum * godRaysIntensity / float(SAMPLES);
      }
      color.rgb += godRays;

      // --- Viñeta ---
      float vignette = smoothstep(0.8, vignetteOffset, dist);
      color.rgb *= mix(1.0, vignette, vignetteIntensity);

      // --- Grano de filme ---
      float grain = rand(uv * resolution + time) * 0.04 - 0.02;
      color.rgb += grain;

      // --- Contraste y saturación ---
      color.rgb = pow(color.rgb, vec3(1.05));
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(gray), color.rgb, 1.15);

      gl_FragColor = color;
    }
  `
}
