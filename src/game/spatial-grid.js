/* =========================================================================
   SpatialGrid: hash espacial 2D para colisiones.
   --------------------------------------------------------------------------
   world.collidesAt era O(n) sobre 100+ colliders, llamada múltiples veces
   por frame (player X/Z + cada enemigo X/Z). En oleada 10 (24 enemigos)
   eran ~5000 checks/frame. SpatialGrid reduce a O(k) donde k = colisionadores
   en la celda del query (típicamente 1-3).

   - Celda cuadrada de `cellSize` unidades.
   - Inserción de AABBs: cubre todas las celdas que el AABB toca.
   - Query punto+radio: solo revisa las celdas que toca el círculo.
   - Reconstrucción barota: se llama una vez al cargar el mundo.
   - Clave NUMÉRICA (cx * 73856093 ^ cz * 19349663) en lugar de string
     "cx,cz": Map con números es más rápido que con strings y evita
     allocar un string por lookup.
   ========================================================================= */

export class SpatialGrid {
  constructor(cellSize = 4) {
    this.cellSize = cellSize
    this.cells = new Map() // clave numérica -> array de {box, type}
  }

  // Hash numérico determinista para un par de coords de celda.
  _key(cx, cz) {
    // Mezcla tipo FNV-ish para distribuir bien en el rango del Map.
    return (cx * 73856093) ^ (cz * 19349663)
  }

  // Inserta un collider AABB. Lo añade a todas las celdas que toca.
  insert(box, type = 'wall') {
    const cs = this.cellSize
    const minX = Math.floor((box.min.x) / cs)
    const maxX = Math.floor((box.max.x) / cs)
    const minZ = Math.floor((box.min.z) / cs)
    const maxZ = Math.floor((box.max.z) / cs)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const k = this._key(cx, cz)
        let arr = this.cells.get(k)
        if (!arr) { arr = []; this.cells.set(k, arr) }
        arr.push({ box, type })
      }
    }
  }

  // Devuelve los colliders candidatos para un punto (x, z) con radio dado.
  // O(k) donde k = colisionadores en las celdas afectadas.
  query(x, z, radius = 0.4) {
    const cs = this.cellSize
    const minX = Math.floor((x - radius) / cs)
    const maxX = Math.floor((x + radius) / cs)
    const minZ = Math.floor((z - radius) / cs)
    const maxZ = Math.floor((z + radius) / cs)
    const result = []
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const arr = this.cells.get(this._key(cx, cz))
        if (arr) {
          for (const c of arr) result.push(c)
        }
      }
    }
    return result
  }

  // Itera los colliders candidatos sin allocar un array (versión de
  // bajo alloc para collidesAt en hot loops).
  forEachCandidate(x, z, radius, fn) {
    const cs = this.cellSize
    const minX = Math.floor((x - radius) / cs)
    const maxX = Math.floor((x + radius) / cs)
    const minZ = Math.floor((z - radius) / cs)
    const maxZ = Math.floor((z + radius) / cs)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const arr = this.cells.get(this._key(cx, cz))
        if (arr) {
          for (const c of arr) fn(c)
        }
      }
    }
  }

  clear() {
    this.cells.clear()
  }

  get size() {
    return this.cells.size
  }
}
