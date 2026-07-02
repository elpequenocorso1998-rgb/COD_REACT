import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialGrid } from '@/game/core/spatial-grid'
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

  // --- Cobertura ampliada (T4: validar refs devueltos, T5: edge cases) ---

  it('devuelve los colliders correctos (no solo count): valida type/tag (T4)', () => {
    grid.insert(makeBox(0, 0, 2, 2), 'wall')
    grid.insert(makeBox(0, 0, 2, 2), 'crate')
    const res = grid.query(1, 1, 0.4)
    expect(res).toHaveLength(2)
    const tags = res.map((c) => c.type).sort()
    expect(tags).toEqual(['crate', 'wall'])
    // Las boxes devueltas son las mismas referencias insertadas.
    const insertedBox = makeBox(0, 0, 2, 2)
    grid.insert(insertedBox, 'refcheck')
    const res2 = grid.query(1, 1, 0.4)
    expect(res2.some((c) => c.box === insertedBox)).toBe(true)
  })

  it('coordenadas negativas funcionan correctamente (T5)', () => {
    grid.insert(makeBox(-6, -6, -4, -4), 'neg')
    // Punto en (-5,-5), celda (-2,-2) con cellSize 4: floor(-5/4)=-2.
    const res = grid.query(-5, -5, 0.4)
    expect(res).toHaveLength(1)
    expect(res[0].type).toBe('neg')
  })

  it('punto exactamente en frontera de celda (T5)', () => {
    // cellSize=4: x=4 es frontera entre celda 0 y celda 1.
    // makeBox(0,0,1,1) cubre solo celda 0,0 (floor(1/4)=0).
    // makeBox(8,8,9,9) cubre solo celda 2,2 (floor(8/4)=2).
    // Punto en (4.5,4.5) radio 0.1: celdas 1,1 (floor(4.4/4)=1 a floor(4.6/4)=1).
    grid.insert(makeBox(0, 0, 1, 1), 'left')
    grid.insert(makeBox(8, 8, 9, 9), 'right')
    const res = grid.query(4.5, 4.5, 0.1)
    // Ni 'left' (celda 0,0) ni 'right' (celda 2,2) están en celda 1,1.
    expect(res.some((c) => c.type === 'left')).toBe(false)
    expect(res.some((c) => c.type === 'right')).toBe(false)
    expect(res).toHaveLength(0)
  })

  it('query que abarca todo el grid devuelve todos los colliders (T5)', () => {
    // Nota: un AABB grande se inserta en múltiples celdas, así que el
    // query puede devolver el MISMO collider varias veces (una por celda).
    // Usamos colliders pequeños (1 celda) para que count == insertados.
    grid.insert(makeBox(0, 0, 1, 1), 'a')
    grid.insert(makeBox(10, 10, 11, 11), 'b')
    grid.insert(makeBox(20, 20, 21, 21), 'c')
    const res = grid.query(0, 0, 100)
    const tags = res.map((c) => c.type)
    expect(tags).toContain('a')
    expect(tags).toContain('b')
    expect(tags).toContain('c')
  })

  it('forEachCandidate itera sin allocar array', () => {
    grid.insert(makeBox(0, 0, 2, 2), 'a')
    grid.insert(makeBox(0, 0, 2, 2), 'b')
    const seen = []
    grid.forEachCandidate(1, 1, 0.4, (c) => seen.push(c.type))
    expect(seen.sort()).toEqual(['a', 'b'])
  })

  it('grid vacío: query devuelve array vacío sin error', () => {
    const res = grid.query(0, 0, 10)
    expect(res).toEqual([])
  })
})
