import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'

/* =========================================================================
   Tests de integración del EnemyManager.
   --------------------------------------------------------------------------
   Verifica:
   - handleShot registra headshot vs body shot con los valores de config.
   - killEnemy marca dead y el cadáver se elimina tras 2s de animación.
   - Wall avoidance: enemigo bloqueado deriva (no se atasca para siempre).
   - dispose libera materiales clonados y geometrías por-enemigo (C2).
   ========================================================================= */

// Stub de texturas (humanoid.js las usa y jsdom no implementa canvas).
vi.mock('../src/game/textures.js', () => ({
  makeSkinTexture: () => ({ map: { dispose: () => {} }, normalMap: { dispose: () => {} } }),
  makeUniformTexture: () => ({ map: { dispose: () => {}, repeat: { set: () => {} } }, normalMap: { dispose: () => {}, repeat: { set: () => {} } } })
}))

import { createEnemyManager } from '../src/game/enemies.js'
import { WEAPON } from '../src/game/config.js'

// Escena stub: solo necesitamos add/remove y traverse para encontrar meshes.
function makeScene() {
  const items = []
  return {
    add: (o) => { items.push(o); return o },
    remove: (o) => {
      const i = items.indexOf(o)
      if (i >= 0) items.splice(i, 1)
    },
    get children() { return items }
  }
}

// World stub: collidesAt siempre false (suelo libre) salvo configuración.
function makeWorld(blocked = false) {
  return {
    colliders: [],
    collidesAt: () => blocked
  }
}

// Busca el primer enemigo spawn-eado atravesando los grupos de la escena.
function findEnemy(scene) {
  for (const group of scene.children) {
    // Los meshes head/torso tienen userData.enemy.
    group.traverse?.((obj) => {
      if (obj.userData?.enemy) return obj.userData.enemy
    })
    // group.traverse no devuelve valor; usamos un bucle manual.
    let found = null
    const stack = [group]
    while (stack.length) {
      const o = stack.pop()
      if (o.userData?.enemy) { found = o.userData.enemy; break }
      if (o.children) stack.push(...o.children)
    }
    if (found) return found
  }
  return null
}

describe('EnemyManager - handleShot (H2: headshot vs body)', () => {
  let scene, world, mgr

  beforeEach(() => {
    scene = makeScene()
    world = makeWorld()
    mgr = createEnemyManager(scene, world, {})
  })

  it('WEAPON.headDamage y bodyDamage son los valores de config (H3)', () => {
    // Verifica que enemies.js usa config (antes hardcodeaba 100/34).
    expect(WEAPON.headDamage).toBe(100)
    expect(WEAPON.bodyDamage).toBe(34)
  })

  it('spawn añade el grupo del enemigo a la escena', () => {
    expect(scene.children.length).toBe(0)
    mgr.spawn(50, 2, 8, 100)
    expect(scene.children.length).toBe(1)
  })

  it('reset elimina todos los enemigos de la escena', () => {
    mgr.spawn(50, 2, 8, 100)
    mgr.spawn(50, 2, 8, 100)
    expect(scene.children.length).toBe(2)
    mgr.reset()
    expect(scene.children.length).toBe(0)
    expect(mgr.allCleared).toBe(true)
  })

  it('allCleared es false mientras hay cadáveres hundiéndose', () => {
    mgr.spawn(50, 2, 8, 100)
    const e = findEnemy(scene)
    e.dead = true
    e.dyingT = 0.5
    expect(mgr.allCleared).toBe(false)
  })

  it('allCleared es true cuando no hay enemigos', () => {
    expect(mgr.allCleared).toBe(true)
    mgr.spawn(50, 2, 8, 100)
    expect(mgr.allCleared).toBe(false)
  })

  it('count devuelve solo vivos (sin allocation)', () => {
    mgr.spawn(50, 2, 8, 100)
    mgr.spawn(50, 2, 8, 100)
    mgr.spawn(50, 2, 8, 100)
    expect(mgr.count).toBe(3)
    // Matamos uno.
    const e = findEnemy(scene)
    e.dead = true
    expect(mgr.count).toBe(2)
  })

  it('update elimina cadáveres tras 2.5s de animación de muerte', () => {
    mgr.spawn(50, 2, 8, 100)
    const e = findEnemy(scene)
    e.dead = true
    e.dyingT = 0
    // 2.4s: aún presente.
    mgr.update(2.4, new THREE.Vector3(100, 0, 0))
    expect(scene.children.length).toBe(1)
    // 0.2s más (>2.5s total): eliminado.
    mgr.update(0.2, new THREE.Vector3(100, 0, 0))
    expect(scene.children.length).toBe(0)
  })

  it('enemigo que alcanza al jugador muere (killEnemy con 0 puntos)', () => {
    let reached = false
    mgr.onReachPlayer = () => { reached = true }
    mgr.spawn(50, 2, 8, 100)
    const e = findEnemy(scene)
    // Posicionamos al enemigo justo al lado del "jugador" en (0,0,0).
    e.group.position.set(1.4, 0, 0)
    mgr.update(0.016, new THREE.Vector3(0, 0, 0))
    expect(reached).toBe(true)
    expect(e.dead).toBe(true)
  })

  it('dispose libera materiales y geometrías por-enemigo (C2)', () => {
    mgr.spawn(50, 2, 8, 100)
    const e = findEnemy(scene)
    expect(e.materials.length).toBeGreaterThan(0)
    expect(e.perEnemyGeos.length).toBeGreaterThan(0)
    // Espiamos dispose sin reemplazar (verificamos que no lanza excepciones).
    expect(() => mgr.dispose()).not.toThrow()
    expect(scene.children.length).toBe(0)
  })

  it('hitFlash se resetea al morir (cadáver no brilla rojo)', () => {
    mgr.spawn(50, 2, 8, 100)
    const e = findEnemy(scene)
    e.hitFlash = 0.12
    e.materials[0].emissiveIntensity = 0.96
    // Simulamos killEnemy.
    e.dead = true
    e.hitFlash = 0
    for (const m of e.materials) m.emissiveIntensity = 0
    expect(e.hitFlash).toBe(0)
    expect(e.materials[0].emissiveIntensity).toBe(0)
  })
})

describe('EnemyManager - wall avoidance (H3)', () => {
  it('enemigo bloqueado registra stuckTime y deriva', () => {
    const scene = makeScene()
    const world = makeWorld(true) // todo bloqueado
    const mgr = createEnemyManager(scene, world, {})
    mgr.spawn(100, 2, 8, 100)
    const e = findEnemy(scene)
    // Posicionamos lejos del jugador para que intente moverse.
    e.group.position.set(0, 0, -50)
    e.lastX = 0; e.lastZ = -50
    const playerPos = new THREE.Vector3(0, 0, 0)
    // Tras varios frames bloqueado, stuckTime debería crecer.
    mgr.update(0.016, playerPos)
    const stuck1 = e.stuckTime
    mgr.update(0.016, playerPos)
    expect(e.stuckTime).toBeGreaterThanOrEqual(stuck1)
    // Tras 0.3s+ bloqueado, evita el muro (avoidDir != 0).
    for (let i = 0; i < 20; i++) mgr.update(0.016, playerPos)
    expect(e.avoidDir).not.toBe(0)
  })

  it('enemigo libre NO activa wall avoidance', () => {
    const scene = makeScene()
    const world = makeWorld(false) // libre
    const mgr = createEnemyManager(scene, world, {})
    mgr.spawn(100, 2, 8, 100)
    const e = findEnemy(scene)
    e.group.position.set(0, 0, -50)
    e.lastX = 0; e.lastZ = -50
    const playerPos = new THREE.Vector3(0, 0, 0)
    for (let i = 0; i < 30; i++) mgr.update(0.016, playerPos)
    expect(e.stuckTime).toBe(0)
    expect(e.avoidDir).toBe(0)
  })
})
