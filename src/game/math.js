/* =========================================================================
   Utilidades matemáticas compartidas.
   --------------------------------------------------------------------------
   - mulberry32: PRNG determinista (semilla) para texturas y generación
     procedural. Antes estaba duplicado en textures.js, world.js y
     pamplona.js (3 copias idénticas).
   - Helpers de uso común (clamp, lerp, smoothstep, deg2rad) para evitar
     repetir fórmulas por todo el código.
   ========================================================================= */

// PRNG determinista mulberry32. Devuelve una función que produce floats
// en [0, 1) a partir de una semilla entera.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Limita v al rango [min, max].
export function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v)
}

// Interpolación lineal: a + (b - a) * t. t normalmente en [0, 1].
export function lerp(a, b, t) {
  return a + (b - a) * t
}

// Interpolación suave (smoothstep) en [0, 1] con derivadas nulas en los
// extremos. Útil para transiciones de cámara y fade.
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// Conversión grados -> radianes.
export function deg2rad(deg) {
  return deg * Math.PI / 180
}

// Distancia 2D entre dos puntos (sin allocar Vector3).
export function dist2d(x1, z1, x2, z2) {
  const dx = x2 - x1
  const dz = z2 - z1
  return Math.sqrt(dx * dx + dz * dz)
}
