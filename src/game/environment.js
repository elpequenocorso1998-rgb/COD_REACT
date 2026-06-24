import * as THREE from 'three'
import { createSkyMaterial } from './shaders/sky.js'
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

  // Cielo con el mismo shader que el mundo (compartido en shaders/sky.js).
  const skyMat = createSkyMaterial()
  skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat))

  // Sol emisivo dentro de la escena del env map.
  // Misma dirección que la luz direccional y el mesh del mundo (SUN_DIR).
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 24),
    new THREE.MeshBasicMaterial({ color: SUN_MESH_COLOR })
  )
  sun.position.copy(SUN_DIR)
  skyScene.add(sun)
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 24),
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
  pmrem.dispose()
  cubeCam.renderTarget.dispose()
  skyMat.dispose()
  sun.material.dispose()
  sunGlow.material.dispose()

  return envMap
}
