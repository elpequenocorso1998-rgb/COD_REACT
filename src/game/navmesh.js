/* =========================================================================
   Navmesh — pathfinding A* sobre grid walkable.
   --------------------------------------------------------------------------
   Antes enemies.js perseguía al jugador en línea recta + wall avoidance
   ad-hoc (parecían zombies, no soldados). Ahora pedimos rutas reales.

   Estrategia:
   - Generamos un grid 2D (XZ) de celdas de `cellSize` unidades.
   - Una celda es walkable si su centro no colisiona con ningún collider
     de world.colliders (usando world.collidesAt).
   - A* con heurística Manhattan sobre vecinos 4/8.
   - El camino se simplifica (string pulling) para no moverse en zigzag.

   Es O(1) por query de celda, y el A* es eficiente porque el grid es
   pequeño (~55x55 celdas para FLOOR_SIZE=220 con cellSize=4).
   ========================================================================= */

const NEIGHBORS_8 = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1]
]

export class NavMesh {
  constructor(world, floorSize, cellSize = 2) {
    this.cellSize = cellSize
    this.floorSize = floorSize
    this.half = floorSize / 2
    this.cols = Math.ceil(floorSize / cellSize)
    this.rows = Math.ceil(floorSize / cellSize)
    this.grid = new Uint8Array(this.cols * this.rows)
    this._world = world
    this._build()
  }

  _idx(cx, cz) { return cx + cz * this.cols }

  _build() {
    // Marcamos walkable=1 para celdas sin colisión.
    // world.collidesAt usa (x, z, radius) en coordenadas mundo.
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const wx = this._cellToWorldX(cx)
        const wz = this._cellToWorldZ(cz)
        const blocked = this._world.collidesAt(wx, wz, this.cellSize * 0.45)
        this.grid[this._idx(cx, cz)] = blocked ? 0 : 1
      }
    }
  }

  _cellToWorldX(cx) { return -this.half + cx * this.cellSize + this.cellSize / 2 }
  _cellToWorldZ(cz) { return -this.half + cz * this.cellSize + this.cellSize / 2 }
  _worldToCellX(wx) { return Math.floor((wx + this.half) / this.cellSize) }
  _worldToCellZ(wz) { return Math.floor((wz + this.half) / this.cellSize) }

  isWalkable(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return false
    return this.grid[this._idx(cx, cz)] === 1
  }

  // A* desde (startX, startZ) hasta (goalX, goalZ) en coords mundo.
  // Devuelve array de waypoints [{x, z}, ...] en coords mundo, o null.
  // Fase 8: binary heap para O(log n) por pop en vez de O(n) linear scan.
  findPath(startX, startZ, goalX, goalZ, maxIterations = 1000) {
    const startCx = this._worldToCellX(startX)
    const startCz = this._worldToCellZ(startZ)
    let goalCx = this._worldToCellX(goalX)
    let goalCz = this._worldToCellZ(goalZ)
    if (!this.isWalkable(goalCx, goalCz)) {
      // Si el goal no es walkable (player encima de un collider raro),
      // buscamos la celda walkable más cercana en espiral.
      const alt = this._nearestWalkable(goalCx, goalCz)
      if (!alt) return null
      goalCx = alt[0]; goalCz = alt[1]
    }

    const startKey = this._idx(startCx, startCz)
    const goalKey = this._idx(goalCx, goalCz)
    if (startKey === goalKey) {
      return [{ x: goalX, z: goalZ }]
    }

    const cameFrom = new Map()
    const gScore = new Map()
    // Closed set: nodos ya expandidos (sacados de open). Sin esto, un nodo
    // podía ser re-descubierto vía uno de sus propios descendientes y crear
    // un ciclo en cameFrom, lo que hacía que _reconstruct entrara en bucle
    // infinito pushing waypoints sin fin => pico de RAM + cuelgue al iniciar
    // el juego (cada enemigo llama a findPath al spawnear).
    const closed = new Set()
    // Fase 8: open set como binary heap (min-heap por fScore).
    // Antes era un Map con linear scan O(n) por iteración; ahora O(log n).
    const heap = new MinHeap()
    // Mapa paralelo: key → {cx, cz, f} para acceso rápido.
    const openInfo = new Map()
    gScore.set(startKey, 0)
    const h0 = this._heuristic(startCx, startCz, goalCx, goalCz)
    openInfo.set(startKey, { cx: startCx, cz: startCz, f: h0 })
    heap.push(startKey, h0)

    let iter = 0
    while (heap.size > 0 && iter < maxIterations) {
      iter++
      const curKey = heap.pop()
      const info = openInfo.get(curKey)
      openInfo.delete(curKey)
      if (!info) continue
      const curCx = info.cx, curCz = info.cz

      if (curKey === goalKey) {
        return this._reconstruct(cameFrom, curKey, goalX, goalZ)
      }
      closed.add(curKey)

      for (const [dx, dz] of NEIGHBORS_8) {
        const nx = curCx + dx
        const nz = curCz + dz
        if (!this.isWalkable(nx, nz)) continue
        // Diagonal no puede cruzar esquinas (pared en L).
        if (dx !== 0 && dz !== 0) {
          if (!this.isWalkable(curCx + dx, curCz) || !this.isWalkable(curCx, curCz + dz)) continue
        }
        const nKey = this._idx(nx, nz)
        if (closed.has(nKey)) continue
        const cost = (dx !== 0 && dz !== 0) ? 1.414 : 1
        const tentative = (gScore.get(curKey) || 0) + cost
        if (tentative < (gScore.get(nKey) || Infinity)) {
          cameFrom.set(nKey, curKey)
          gScore.set(nKey, tentative)
          const f = tentative + this._heuristic(nx, nz, goalCx, goalCz)
          const existing = openInfo.get(nKey)
          if (existing) {
            existing.f = f
            heap.decreaseKey(nKey, f)
          } else {
            openInfo.set(nKey, { cx: nx, cz: nz, f })
            heap.push(nKey, f)
          }
        }
      }
    }
    return null
  }

  _heuristic(cx, cz, gx, gz) {
    const dx = Math.abs(cx - gx)
    const dz = Math.abs(cz - gz)
    // Octile distance (adecuada para 8 vecinos).
    return (dx + dz) + (1.414 - 2) * Math.min(dx, dz)
  }

  _reconstruct(cameFrom, curKey, goalX, goalZ) {
    const path = [{ x: goalX, z: goalZ }]
    let k = curKey
    // Safety net: con el closed set del A* no deberían formarse ciclos en
    // cameFrom, pero dejamos un guard por si una re-apertura futura los
    // reintroduce. Sin esto, un ciclo colgaría el tab (pico de RAM infinito).
    let guard = 0
    while (cameFrom.has(k) && guard <= cameFrom.size) {
      guard++
      const cx = k % this.cols
      const cz = Math.floor(k / this.cols)
      path.push({ x: this._cellToWorldX(cx), z: this._cellToWorldZ(cz) })
      k = cameFrom.get(k)
    }
    path.reverse()
    return this._simplify(path)
  }

  // String pulling: elimina waypoints intermedios que estén en línea
  // recta del anterior. Reduce zigzag del grid.
  _simplify(path) {
    if (path.length <= 2) return path
    const result = [path[0]]
    let anchor = path[0]
    for (let i = 2; i < path.length; i++) {
      if (!this._lineOfSight(anchor.x, anchor.z, path[i].x, path[i].z)) {
        result.push(path[i - 1])
        anchor = path[i - 1]
      }
    }
    result.push(path[path.length - 1])
    return result
  }

  _lineOfSight(x1, z1, x2, z2) {
    // DDA simple: sampling a lo largo de la línea.
    const dx = x2 - x1
    const dz = z2 - z1
    const dist = Math.hypot(dx, dz)
    const steps = Math.ceil(dist / (this.cellSize * 0.5))
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const x = x1 + dx * t
      const z = z1 + dz * t
      if (this._world.collidesAt(x, z, this.cellSize * 0.4)) return false
    }
    return true
  }

  _nearestWalkable(cx, cz) {
    // Búsqueda en espiral hasta radio 5 celdas.
    for (let r = 1; r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
          if (this.isWalkable(cx + dx, cz + dz)) return [cx + dx, cz + dz]
        }
      }
    }
    return null
  }
}

/* =========================================================================
   MinHeap — binary heap para el open set del A*.
   --------------------------------------------------------------------------
   Fase 8: antes el A* usaba un Map con linear scan O(n) para encontrar el
   nodo con menor fScore. Con 24 enemigos re-pathfindando cada 0.5s en un
   grid de 110×110, eso era ~144M ops/seg en el peor caso. Un binary heap
   reduce el pop a O(log n) y el decreaseKey a O(log n).
   ========================================================================= */
class MinHeap {
  constructor() {
    this._keys = []     // keys (cell indices)
    this._fscores = []  // fScores paralelo
    this._pos = new Map() // key → índice en _keys
  }

  get size() { return this._keys.length }

  push(key, f) {
    const i = this._keys.length
    this._keys.push(key)
    this._fscores.push(f)
    this._pos.set(key, i)
    this._siftUp(i)
  }

  pop() {
    const topKey = this._keys[0]
    const lastIdx = this._keys.length - 1
    if (lastIdx === 0) {
      this._keys.pop()
      this._fscores.pop()
    } else {
      this._keys[0] = this._keys[lastIdx]
      this._fscores[0] = this._fscores[lastIdx]
      this._pos.set(this._keys[0], 0)
      this._keys.pop()
      this._fscores.pop()
      this._siftDown(0)
    }
    this._pos.delete(topKey)
    return topKey
  }

  decreaseKey(key, newF) {
    const i = this._pos.get(key)
    if (i === undefined) return
    if (newF < this._fscores[i]) {
      this._fscores[i] = newF
      this._siftUp(i)
    }
  }

  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this._fscores[i] < this._fscores[parent]) {
        this._swap(i, parent)
        i = parent
      } else break
    }
  }

  _siftDown(i) {
    const n = this._keys.length
    let guard = 0
    for (;;) {
      if (++guard > n) break
      const l = 2 * i + 1, r = 2 * i + 2
      let smallest = i
      if (l < n && this._fscores[l] < this._fscores[smallest]) smallest = l
      if (r < n && this._fscores[r] < this._fscores[smallest]) smallest = r
      if (smallest !== i) {
        this._swap(i, smallest)
        i = smallest
      } else break
    }
  }

  _swap(a, b) {
    const tmpK = this._keys[a]; this._keys[a] = this._keys[b]; this._keys[b] = tmpK
    const tmpF = this._fscores[a]; this._fscores[a] = this._fscores[b]; this._fscores[b] = tmpF
    this._pos.set(this._keys[a], a)
    this._pos.set(this._keys[b], b)
  }
}
