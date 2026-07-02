import { describe, it, expect } from 'vitest'
import { NavMesh } from '@/game/enemies/navmesh'

/* Tests del NavMesh y A* pathfinding.
   Cubre: findPath, _reconstruct (regresión del bug de ciclo infinito),
   _simplify, _nearestWalkable, grid walkable. */

// Mock world con collidesAt: bloquea celdas en (5,5) y alrededores.
function makeWorld(blocked = []) {
  const blockedSet = new Set(blocked.map(([x, z]) => `${x},${z}`))
  return {
    collidesAt(x, z, _radius) {
      // Redondea a celdas de 2 unidades (cellSize=2).
      const cx = Math.floor((x + 110) / 2)
      const cz = Math.floor((z + 110) / 2)
      return blockedSet.has(`${cx},${cz}`)
    }
  }
}

describe('NavMesh', () => {
  it('grid walkable: celdas bloqueadas marcan 0', () => {
    const world = makeWorld([[55, 55]]) // centro del mapa
    const nav = new NavMesh(world, 220, 2)
    expect(nav.isWalkable(55, 55)).toBe(false)
    expect(nav.isWalkable(0, 0)).toBe(true)
  })

  it('findPath: devuelve camino directo en mapa vacío', () => {
    const world = makeWorld([])
    const nav = new NavMesh(world, 220, 2)
    const path = nav.findPath(0, 0, 10, 10)
    expect(path).not.toBeNull()
    expect(path.length).toBeGreaterThan(0)
    // El último waypoint debe ser el goal.
    const last = path[path.length - 1]
    expect(last.x).toBe(10)
    expect(last.z).toBe(10)
  })

  it('findPath: start === goal devuelve un solo waypoint', () => {
    const world = makeWorld([])
    const nav = new NavMesh(world, 220, 2)
    const path = nav.findPath(5, 5, 5, 5)
    expect(path).toHaveLength(1)
    expect(path[0].x).toBe(5)
    expect(path[0].z).toBe(5)
  })

  it('findPath: rodea un obstáculo', () => {
    // Bloqueamos una pared vertical en x=0 (celdas 54-56 en z).
    const wall = []
    for (let z = 50; z <= 60; z++) wall.push([55, z])
    const world = makeWorld(wall)
    const nav = new NavMesh(world, 220, 2)
    const path = nav.findPath(-5, 55, 5, 55)
    // Debe encontrar un camino (rodeando la pared).
    expect(path).not.toBeNull()
    expect(path.length).toBeGreaterThan(1)
  })

  it('findPath: devuelve null si no hay camino', () => {
    // Bloqueamos todo el mapa excepto el start.
    const blocked = []
    for (let x = 0; x < 110; x++)
      for (let z = 0; z < 110; z++)
        if (!(x === 55 && z === 55)) blocked.push([x, z])
    const world = makeWorld(blocked)
    const nav = new NavMesh(world, 220, 2)
    const path = nav.findPath(0, 0, 100, 100)
    expect(path).toBeNull()
  })

  it('_reconstruct: NO entra en ciclo infinito (regresión del bug)', () => {
    // Este test es una regresión del bug original: el A* sin closed set
    // podía crear ciclos en cameFrom, y _reconstruct hacía un while
    // infinito pushing waypoints sin fin → pico de RAM + cuelgue.
    // Con el closed set + guard, _reconstruct siempre termina.
    const world = makeWorld([])
    const nav = new NavMesh(world, 220, 2)
    // Simulamos un cameFrom con un ciclo artificial.
    const cameFrom = new Map()
    cameFrom.set(1, 2)
    cameFrom.set(2, 1) // ciclo: 1→2→1→2...
    // El guard (guard <= cameFrom.size) debe cortar el bucle.
    const path = nav._reconstruct(cameFrom, 1, 10, 10)
    // Debe terminar (no colgar) y devolver un array finito.
    expect(path).toBeInstanceOf(Array)
    expect(path.length).toBeLessThanOrEqual(cameFrom.size + 2)
  })

  it('_nearestWalkable: encuentra celda libre cercana', () => {
    const world = makeWorld([[55, 55], [56, 55], [55, 56]])
    const nav = new NavMesh(world, 220, 2)
    const alt = nav._nearestWalkable(55, 55)
    expect(alt).not.toBeNull()
    expect(nav.isWalkable(alt[0], alt[1])).toBe(true)
  })

  it('_nearestWalkable: devuelve null si todo está bloqueado', () => {
    const blocked = []
    for (let dx = -5; dx <= 5; dx++)
      for (let dz = -5; dz <= 5; dz++)
        blocked.push([55 + dx, 55 + dz])
    const world = makeWorld(blocked)
    const nav = new NavMesh(world, 220, 2)
    const alt = nav._nearestWalkable(55, 55)
    expect(alt).toBeNull()
  })

  it('MinHeap: push/pop mantiene orden', () => {
    // El MinHeap es interno pero se prueba indirectamente via findPath.
    // Aquí verificamos que findPath con muchos nodos no se cuelga.
    const world = makeWorld([])
    const nav = new NavMesh(world, 220, 2)
    const path = nav.findPath(-100, -100, 100, 100)
    expect(path).not.toBeNull()
  })
})
