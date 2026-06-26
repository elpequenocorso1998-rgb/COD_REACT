/* =========================================================================
   Escalado de calidad dinámico.
   --------------------------------------------------------------------------
   Mide los FPS durante los primeros frames y selecciona un perfil de
   calidad (low/medium/high). En dispositivos modestos se desactivan SSAO
   y god rays, y se reduce el shadow map. El usuario puede forzar un perfil
   desde el menú de settings (Fase 4).

   Antes el pipeline completo (SSAO + Bloom + god rays + SMAA + sombras
   2048) corría siempre, incluso en GPUs que no lo soportan → <30 FPS.
   ========================================================================= */
import { QUALITY, SHADOW_MAP_SIZE } from './constants.js'

// Umbral de FPS para clasificar (medido sobre una ventana de 60 frames).
const FPS_HIGH = 50
const FPS_MEDIUM = 30

// Aplica un perfil de calidad al renderer y los passes de post-procesado.
// `passes` es { ssaoPass, bloomPass, cinematicPass, sun }.
// IMPORTANTE: no disposeamos sun.shadow.map manualmente; marcamos
// needsUpdate=true y dejamos que Three.js reasigne el RT de forma segura.
// Antes hacer dispose+null mid-frame podía causar un null-deref en el
// siguiente render de sombras.
export function applyQuality(quality, renderer, passes) {
  const { ssaoPass, bloomPass, cinematicPass, sun } = passes

  switch (quality) {
    case QUALITY.LOW:
      // Desactiva SSAO (el pass más caro).
      if (ssaoPass) ssaoPass.enabled = false
      // Bloom reducido.
      if (bloomPass) { bloomPass.strength = 0.4; bloomPass.radius = 0.3 }
      // Sin god rays.
      if (cinematicPass) cinematicPass.uniforms.godRaysIntensity.value = 0
      // Sombra 1024 (mitad de resolución).
      if (sun) {
        sun.shadow.mapSize.set(1024, 1024)
        sun.shadow.needsUpdate = true
      }
      // Pixel ratio capado a 1.5 (menos fill rate).
      if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      break
    case QUALITY.MEDIUM:
      if (ssaoPass) ssaoPass.enabled = true
      if (bloomPass) { bloomPass.strength = 0.55; bloomPass.radius = 0.4 }
      // God rays reducidos.
      if (cinematicPass) cinematicPass.uniforms.godRaysIntensity.value = 0.3
      if (sun) {
        sun.shadow.mapSize.set(1536, 1536)
        sun.shadow.needsUpdate = true
      }
      if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      break
    case QUALITY.HIGH:
    default:
      if (ssaoPass) ssaoPass.enabled = true
      if (bloomPass) { bloomPass.strength = 0.7; bloomPass.radius = 0.4 }
      if (cinematicPass) cinematicPass.uniforms.godRaysIntensity.value = 0.5
      if (sun) {
        sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
        sun.shadow.needsUpdate = true
      }
      if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      break
  }
}

// Clasifica la calidad a partir de los FPS medidos.
export function classifyQuality(fps) {
  if (fps >= FPS_HIGH) return QUALITY.HIGH
  if (fps >= FPS_MEDIUM) return QUALITY.MEDIUM
  return QUALITY.LOW
}

// Medidor de FPS con ventana deslizante. Llama sample(dt) cada frame y
// lee .fps. Tras `warmupFrames` frames, llama al callback con la calidad.
export class FpsSampler {
  constructor(warmupFrames = 60, onDetected = () => {}) {
    this.warmupFrames = warmupFrames
    this.onDetected = onDetected
    this.samples = []
    this.detected = false
    this.fps = 0
  }

  sample(dt) {
    if (this.detected) return
    if (dt > 0) this.samples.push(1 / dt)
    if (this.samples.length >= this.warmupFrames) {
      // Media de los FPS medidos (ignorando el primer frame, ruidoso).
      // Sin slice() (alloc): sumamos in-place desde el índice 1.
      let sum = 0
      for (let i = 1; i < this.samples.length; i++) sum += this.samples[i]
      this.fps = sum / (this.samples.length - 1)
      this.detected = true
      this.onDetected(classifyQuality(this.fps))
    }
  }

  reset() {
    this.samples = []
    this.detected = false
    this.fps = 0
  }
}
