/* =========================================================================
   Shader de cielo — Preetham atmospheric scattering (Three.js Sky).
   --------------------------------------------------------------------------
   Reemplaza el gradiente 3-color por scattering atmosférico real con
   disco solar, turbidity, rayleigh y mie. Más realista que un gradiente.
   ========================================================================= */

import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { SUN_DIR } from '../constants.js'

export function createSkyMaterial() {
  // Fallback: si Sky no está disponible, usar el gradiente antiguo.
  const sky = new Sky()
  sky.scale.setScalar(500)

  const uniforms = sky.material.uniforms
  uniforms.turbidity.value = 8
  uniforms.rayleigh.value = 2
  uniforms.mieCoefficient.value = 0.005
  uniforms.mieDirectionalG.value = 0.8

  // Posición del sol (normalizada).
  const sunPhi = THREE.MathUtils.degToRad(90 - SUN_DIR[1] * 50)
  const sunTheta = THREE.MathUtils.degToRad(180)
  const sunX = Math.sin(sunPhi) * Math.cos(sunTheta)
  const sunY = Math.cos(sunPhi)
  const sunZ = Math.sin(sunPhi) * Math.sin(sunTheta)
  uniforms.sunPosition.value.set(sunX, sunY, sunZ)

  return sky.material
}

// Helper para construir el mesh de cielo completo (con sky dome).
export function createSkyMesh() {
  const sky = new Sky()
  sky.scale.setScalar(500)
  const uniforms = sky.material.uniforms
  uniforms.turbidity.value = 8
  uniforms.rayleigh.value = 2
  uniforms.mieCoefficient.value = 0.005
  uniforms.mieDirectionalG.value = 0.8
  const sunPhi = THREE.MathUtils.degToRad(90 - 30)
  const sunTheta = THREE.MathUtils.degToRad(180)
  const sunX = Math.sin(sunPhi) * Math.cos(sunTheta)
  const sunY = Math.cos(sunPhi)
  const sunZ = Math.sin(sunPhi) * Math.sin(sunTheta)
  uniforms.sunPosition.value.set(sunX, sunY, sunZ)
  return sky
}
