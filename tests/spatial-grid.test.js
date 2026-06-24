import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialGrid } from '../src/game/spatial-grid.js'
import * as THREE from 'three'

/* Tests del SpatialGrid: hash espacial para collidesAt O(k). */

function makeBox(minX, minZ, maxX, maxZ) {
  return new THREE.Box3(
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 4, maxZ)
  )
}

describe('SpatialGrid', () => {
  let grid
  beforeEach(() => {
    grid = new SpatialGrid(4)
  })

  it('inserta y encuentra un collider en la misma celda', () => {
    grid.insert(makeBox(0, 0, 2, 2))
    const res = grid.query(1, 1, 0.4)
    expect(res).toHaveLength(1)
  })

  it('no encuentra colliders lejos del query', () => {
    grid.insert(makeBox(0, 0, 2, 2))
    const res = grid.query(50, 50, 0.4)
    expect(res).toHaveLength(0)
  })

  it('un AABB grande cubre múltiples celdas', () => {
    grid.insert(makeBox(0, 0, 20, 20)) // 6x6 celdas de tamaño 4
    // Cualquier punto dentro debe encontrarlo.
    expect(grid.query(1, 1, 0.4)).toHaveLength(1)
    expect(grid.query(19, 19, 0.4)).toHaveLength(1)
    expect(grid.query(10, 10, 0.4)).toHaveLength(1)
  })

  it('múltiples colliders en celdas distintas se aíslan', () => {
    grid.insert(makeBox(0, 0, 2, 2), 'a')
    grid.insert(makeBox(40, 40, 42, 42), 'b')
    grid.insert(makeBox(80, 80, 82, 82), 'c')
    expect(grid.query(1, 1, 0.4)).toHaveLength(1)
    expect(grid.query(41, 41, 0.4)).toHaveLength(1)
    expect(grid.query(81, 81, 0.4)).toHaveLength(1)
    expect(grid.query(50, 50, 0.4)).toHaveLength(0)
  })

  it('varios colliders en la misma celda se devuelven todos', () => {
    grid.insert(makeBox(0, 0, 1, 1), 'a')
    grid.insert(makeBox(1, 1, 2, 2), 'b')
    grid.insert(makeBox(0, 1, 1, 2), 'c')
    const res = grid.query(1, 1, 0.4)
    expect(res).toHaveLength(3)
  })

  it('query con radio grande abarca celdas vecinas', () => {
    grid.insert(makeBox(0, 0, 1, 1))
    // query a 5 unidades pero con radio 6 debe alcanzar el collider
    const res = grid.query(5, 0, 6)
    expect(res.length).toBeGreaterThanOrEqual(1)
  })

  it('clear vacía todas las celdas', () => {
    grid.insert(makeBox(0, 0, 2, 2))
    expect(grid.query(1, 1, 0.4)).toHaveLength(1)
    grid.clear()
    expect(grid.query(1, 1, 0.4)).toHaveLength(0)
    expect(grid.size).toBe(0)
  })

  it('query con radio 0 solo revisa la celda del punto', () => {
    grid.insert(makeBox(0, 0, 3.9, 3.9)) // celda 0,0
    grid.insert(makeBox(4, 4, 7, 7))     // celda 1,1
    // punto en (1,1) celda 0,0, radio 0 → solo celda 0,0
    const res = grid.query(1, 1, 0)
    expect(res).toHaveLength(1)
  })
})
