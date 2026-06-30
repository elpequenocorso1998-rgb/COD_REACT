import * as THREE from 'three'
import { createSkyMesh } from './shaders/sky.js'
import { SUN_DIR, SUN_MESH_COLOR, SUN_GLOW_COLOR, SUN_COLOR, SUN_INTENSITY } from './constants.js'

/* =========================================================================
   Generación de environment map procedural.
   --------------------------------------------------------------------------
   Sin un environment map, los materiales PBR (metalness > 0) se ven negros
   o planos porque no tienen nada que reflejar. Generamos un cubemap
   procedural a partir del cielo + sol y lo convertimos a PMREM
   (Prefiltered Mipmap Radiance Environment Map) para que los materiales
   MeshStandardMaterial lo usen automáticamente como `scene.environment`.

   Mejoras:
   - Shader de cielo y SUN_DIR compartidos con world.js (antes duplicados).
   - dispose() del envMap para no泄漏 memoria al recrear el engine.
   ========================================================================= */
export function createEnvironment(scene, renderer) {
  // --- 1. Creamos una escena miniatura con el cielo y el sol ---
  const skyScene = new THREE.Scene()

  // Cielo con el mismo shader que el mundo (Preetham scattering).
  const skyMesh = createSkyMesh()
  skyScene.add(skyMesh)

  // Sol emisivo dentro de la escena del env map.
  // Misma dirección que la luz direccional y el mesh del mundo (SUN_DIR).
  const sunGeo = new THREE.SphereGeometry(8, 24, 24)
  const sun = new THREE.Mesh(
    sunGeo,
    new THREE.MeshBasicMaterial({ color: SUN_MESH_COLOR })
  )
  sun.position.copy(SUN_DIR)
  skyScene.add(sun)
  const sunGlowGeo = new THREE.SphereGeometry(16, 24, 24)
  const sunGlow = new THREE.Mesh(
    sunGlowGeo,
    new THREE.MeshBasicMaterial({ color: SUN_GLOW_COLOR, transparent: true, opacity: 0.5 })
  )
  sunGlow.position.copy(SUN_DIR)
  skyScene.add(sunGlow)

  // Luz direccional fake para que el env map tenga brillos definidos.
  const dl = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  dl.position.copy(SUN_DIR)
  skyScene.add(dl)
  skyScene.add(new THREE.AmbientLight(0x8899aa, 0.5))

  // --- 2. Generamos el PMREM a partir de la escena del cielo ---
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()

  // Renderizamos la escena del cielo a un target efímero.
  const cubeCam = new THREE.CubeCamera(0.1, 1000, new THREE.WebGLCubeRenderTarget(256))
  cubeCam.update(renderer, skyScene)

  // Convertimos el cubemap a PMREM (prefiltered para PBR).
  const envMap = pmrem.fromCubemap(cubeCam.renderTarget.texture).texture

  // Lo asignamos al scene.environment: TODOS los MeshStandardMaterial lo
  // usarán automáticamente para calcular reflexiones.
  scene.environment = envMap

  // Limpieza de los recursos efímeros.
  // Fase 7: disposal completo de geometrías (antes solo materials).
  pmrem.dispose()
  cubeCam.renderTarget.dispose()
  skyMesh.material.dispose()
  sun.material.dispose()
  sunGeo.dispose()
  sunGlow.material.dispose()
  sunGlowGeo.dispose()

  return envMap
}
