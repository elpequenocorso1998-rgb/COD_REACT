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
  // Sin allocations por celda: usamos Map y arrays reutilizables.
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

    const open = new Map()
    const cameFrom = new Map()
    const gScore = new Map()
    const fScore = new Map()
    // Closed set: nodos ya expandidos (sacados de open). Sin esto, un nodo
    // podía ser re-descubierto vía uno de sus propios descendientes y crear
    // un ciclo en cameFrom, lo que hacía que _reconstruct entrara en bucle
    // infinito pushing waypoints sin fin => pico de RAM + cuelgue al iniciar
    // el juego (cada enemigo llama a findPath al spawnear).
    const closed = new Set()
    gScore.set(startKey, 0)
    const h0 = this._heuristic(startCx, startCz, goalCx, goalCz)
    fScore.set(startKey, h0)
    open.set(startKey, [startCx, startCz, h0])

    let iter = 0
    while (open.size > 0 && iter < maxIterations) {
      iter++
      // Nodo con menor fScore (linear scan; grid pequeño).
      let curKey = null, curF = Infinity, curCx = 0, curCz = 0
      for (const [k, v] of open) {
        if (v[2] < curF) { curKey = k; curF = v[2]; curCx = v[0]; curCz = v[1] }
      }
      if (curKey === goalKey) {
        return this._reconstruct(cameFrom, curKey, goalX, goalZ)
      }
      open.delete(curKey)
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
          fScore.set(nKey, f)
          open.set(nKey, [nx, nz, f])
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
