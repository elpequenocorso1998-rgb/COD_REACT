/* =========================================================================
   Shader de cielo compartido (gradiente esférico).
   --------------------------------------------------------------------------
   Antes el vertex/fragment shader estaba duplicado en world.js (lineas
   376-397) y environment.js (lineas 24-45). Aquí se exporta una sola vez
   con los uniforms listos para clonar.
   ========================================================================= */

export const SKY_VERTEX = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const SKY_FRAGMENT = `
  uniform vec3 top;
  uniform vec3 middle;
  uniform vec3 bottom;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition).y;
    float t = clamp(h, -1.0, 1.0);
    vec3 col;
    if (t > 0.0) col = mix(middle, top, pow(t, 0.6));
    else col = mix(middle, bottom, pow(-t, 0.5));
    gl_FragColor = vec4(col, 1.0);
  }
`

// Helper: construye el material de cielo con los colores pasados.
import * as THREE from 'three'
import { SKY_TOP, SKY_MIDDLE, SKY_BOTTOM } from '../constants.js'

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) },
      middle: { value: new THREE.Color(SKY_MIDDLE) },
      bottom: { value: new THREE.Color(SKY_BOTTOM) }
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT
  })
}
