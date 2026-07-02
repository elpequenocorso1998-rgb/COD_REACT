/* =========================================================================
   Shader de cielo — Preetham atmospheric scattering (Three.js Sky).
   --------------------------------------------------------------------------
   Reemplaza el gradiente 3-color por scattering atmosférico real con
   disco solar, turbidity, rayleigh y mie. Más realista que un gradiente.
   ========================================================================= */

import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { SUN_DIR } from '@/game/core/constants'

function configureSky(sky) {
  sky.scale.setScalar(500)
  const uniforms = sky.material.uniforms
  uniforms.turbidity.value = 8
  uniforms.rayleigh.value = 2
  uniforms.mieCoefficient.value = 0.005
  uniforms.mieDirectionalG.value = 0.8
  // Posición del sol desde SUN_DIR (Vector3).
  const dir = SUN_DIR.clone().normalize()
  uniforms.sunPosition.value.set(dir.x, dir.y, dir.z)
}

export function createSkyMaterial() {
  const sky = new Sky()
  configureSky(sky)
  return sky.material
}

export function createSkyMesh() {
  const sky = new Sky()
  configureSky(sky)
  return sky
}
