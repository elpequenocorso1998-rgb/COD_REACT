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
import { createEnemyManager } from './enemies.js'
import { createParticleSystem } from './particles.js'
import { createEnvironment } from './environment.js'
import { createAudioSystem } from './audio.js'
import { useGameStore, GAME_STATES } from './store.js'

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
   - Dispose completo: world, player, enemies, particles, audio, passes.
   ========================================================================= */
export function createEngine() {
  let scene, camera, renderer, clock, composer
  let world, player, enemies, particles, audio
  let sunMesh = null
  let cinematicPass = null
  let rafId = null
  let mounted = false
  let container = null
  let prevState = null

  const store = useGameStore

  /* ----------------------------------------------------------------------
     MONTAR: construye escena, renderer, post-procesado y sistemas.
     ---------------------------------------------------------------------- */
  function mount(containerEl) {
    container = containerEl
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07090e)

    camera = new THREE.PerspectiveCamera(
      78, container.clientWidth / container.clientHeight, 0.05, 600
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

    const ssaoPass = new SSAOPass(
      scene, camera, container.clientWidth, container.clientHeight
    )
    ssaoPass.kernelRadius = 0.5
    ssaoPass.minDistance = 0.001
    ssaoPass.maxDistance = 0.1
    composer.addPass(ssaoPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.7, 0.4, 0.85
    )
    composer.addPass(bloomPass)

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
    createEnvironment(scene, renderer)
    particles = createParticleSystem(scene, { max: 250 })
    player = createPlayer(scene, camera, world, particles)
    enemies = createEnemyManager(scene, world, particles)
    audio = createAudioSystem()

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
    }
    enemies.onKilled = (enemy, points) => {
      store.getState().registerKill(points)
      audio.playKill()
    }

    player.onShoot = (originVec, dirVec) => {
      if (!store.getState().fire()) return false
      audio.playShoot()
      const hitEnemy = enemies.handleShot(originVec, dirVec, (enemy, isHead, hitPoint, hitNormal) => {
        store.getState().registerHit(isHead ? 25 : 10)
        particles.spawnBlood(hitPoint, hitNormal)
        audio.playHitFlesh()
      })
      if (!hitEnemy) audio.playHitWall()
      return hitEnemy
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)

    mounted = true
    prevState = store.getState().gameState
    store.getState().setLoading(false)

    loop()
  }

  /* ----------------------------------------------------------------------
     BUCLE PRINCIPAL.
     ---------------------------------------------------------------------- */
  const _sunWorld = new THREE.Vector3()
  const _sunScreen = new THREE.Vector3()

  function loop() {
    if (!mounted) return
    rafId = requestAnimationFrame(loop)

    const dt = Math.min(clock.getDelta(), 0.05)
    const state = store.getState().gameState

    // Detectar transiciones de estado para mutear audio y liberar pointer.
    if (state !== prevState) {
      if (state === GAME_STATES.GAMEOVER || state === GAME_STATES.MENU) {
        audio.setMuted(true)
        player.exitPointerLock()
      }
      prevState = state
    }

    if (state === GAME_STATES.PLAYING) {
      player.update(dt)
      enemies.update(dt, player.getPosition())
      world.update(dt)
      // Farolas dinámicas: activa las cercanas al jugador.
      if (world.updateLamps) world.updateLamps(player.getPosition())
      particles.update(dt)
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
  }

  function onResize() {
    if (!container) return
    const w = container.clientWidth, h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    // Actualizamos el uniform de resolución para el grano de filme.
    if (cinematicPass) cinematicPass.uniforms.resolution.value.set(w, h)
  }

  /* ----------------------------------------------------------------------
     API pública.
     ---------------------------------------------------------------------- */
  function startGame() {
    audio.init()
    audio.setMuted(false)
    store.getState().reset()
    enemies.reset()
    particles.reset()
    player.reset()
    spawnWave(1)
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
    store.getState().setState(GAME_STATES.MENU)
  }

  function spawnWave(n) {
    const count = 4 + n * 2
    store.getState().startWave(n, count)
    for (let i = 0; i < count; i++) {
      const hp = 50 + n * 15
      const speed = 2.0 + n * 0.15
      const dmg = 8 + n * 2
      enemies.spawn(hp, speed, dmg, n * 10 + 90)
    }
  }

  function checkWaveProgress() {
    const st = store.getState()
    if (st.gameState === GAME_STATES.PLAYING && st.enemiesRemaining === 0) {
      spawnWave(st.wave + 1)
    }
  }

  /* ----------------------------------------------------------------------
     DISPOSE.
     ---------------------------------------------------------------------- */
  function dispose() {
    mounted = false
    if (rafId) cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    if (player) player.dispose()
    if (enemies) enemies.dispose()
    if (particles) particles.dispose()
    if (audio) audio.dispose()
    if (composer) composer.dispose()
    if (renderer) {
      renderer.dispose()
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }

  return { mount, dispose, startGame, resumeGame, quitToMenu, spawnWave }
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
      vec2 sunDir = uv - sunScreenPos;
      vec3 godRays = vec3(0.0);
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
