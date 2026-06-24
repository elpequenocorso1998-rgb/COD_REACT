import * as THREE from 'three'

/* =========================================================================
   Constantes de render y motor (antes mágicas por todo el código).
   --------------------------------------------------------------------------
   Centraliza los valores de cámara, sombras, niebla, sol, partículas y
   escalado de oleadas para que sean fáciles de encontrar y ajustar.
   ========================================================================= */

// --- Sol / iluminación ---
// Dirección unificada para luz direccional, mesh visual y env map.
// Antes estaba repetida en world.js (linea 42) y environment.js (3 sitios).
export const SUN_DIR = new THREE.Vector3(80, 120, 60)
export const SUN_DIR_NORMALIZED = SUN_DIR.clone().normalize()
export const SUN_COLOR = 0xffd0a0
export const SUN_INTENSITY = 2.4
export const SUN_GLOW_COLOR = 0xffaa50
export const SUN_MESH_COLOR = 0xfff0c0

// --- Cámara ---
export const FOV = 78
export const SPRINT_FOV = 88
export const CAMERA_NEAR = 0.05
export const CAMERA_FAR = 600

// --- Sombras ---
export const SHADOW_MAP_SIZE = 2048
export const SHADOW_CAMERA_NEAR = 1
export const SHADOW_CAMERA_FAR = 350
export const SHADOW_CAMERA_BOUNDS = 110
export const SHADOW_BIAS = -0.0004
export const SHADOW_NORMAL_BIAS = 0.02

// --- Niebla y cielo ---
export const FOG_COLOR = 0x3a2a1a
export const FOG_DENSITY = 0.008
export const FLOOR_SIZE = 220
export const SKY_TOP = 0x2a4a7a
export const SKY_MIDDLE = 0xc88a5a
export const SKY_BOTTOM = 0x2a1a1a

// --- Partículas ---
export const MAX_PARTICLES = 250

// --- Escalado de oleadas ---
// count = WAVE_BASE + n * WAVE_PER_WAVE
export const WAVE_BASE = 4
export const WAVE_PER_WAVE = 2

// --- IDs de semilla PRNG para texturas (determinismo entre builds) ---
export const PRNG_SEEDS = {
  concrete: 42,
  barrel: 7,
  crate: 99,
  gunMetal: 123,
  uniform: 7,
  skin: 55,
  sillar: 11,
  roof: 33,
  wood: 7,
  world: 1337
}

// --- Calidad gráfica (perfiles) ---
// Se selecciona uno en runtime según FPS / device (ver quality.js).
export const QUALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
}
