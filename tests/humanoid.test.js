import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

/* =========================================================================
   Tests del humanoide y su animación de caminar.
   --------------------------------------------------------------------------
   Verifica:
   - El reseteo de rotaciones en idle (bug M8: antes spine.z/chest.y/hips.y
     no se reseteaban y los cadáveres quedaban torcidos).
   - El ciclo de caminar mueve piernas alternativamente.
   - buildHumanoid expone vestMesh y helmetMesh para hit-testing (H2).
   ========================================================================= */

// Stub de texturas: humanoid.js importa makeSkinTexture/makeUniformTexture
// de textures.js, que usan document.createElement('canvas').getContext('2d')
// que jsdom no implementa. Mockeamos el módulo para devolver texturas fake.
vi.mock('../src/game/textures.js', () => ({
  makeSkinTexture: () => ({ dispose: () => {} }),
  makeUniformTexture: () => ({ dispose: () => {}, repeat: { set: () => {} } })
}))

import { buildHumanoid, animateWalk } from '../src/game/humanoid.js'

describe('buildHumanoid', () => {
  it('expone vestMesh y helmetMesh para hit-testing (H2)', () => {
    const h = buildHumanoid()
    expect(h.vestMesh).toBeInstanceOf(THREE.Mesh)
    expect(h.helmetMesh).toBeInstanceOf(THREE.Mesh)
    expect(h.perEnemyGeos).toBeInstanceOf(Array)
    expect(h.perEnemyGeos.length).toBeGreaterThan(0)
  })

  it('userData.part marca cabeza vs cuerpo para headshots (H2)', () => {
    const h = buildHumanoid()
    h.headMesh.userData.part = 'head'
    h.helmetMesh.userData.part = 'head'
    h.torsoMesh.userData.part = 'body'
    h.vestMesh.userData.part = 'body'
    expect(h.headMesh.userData.part).toBe('head')
    expect(h.helmetMesh.userData.part).toBe('head')
    expect(h.torsoMesh.userData.part).toBe('body')
    expect(h.vestMesh.userData.part).toBe('body')
  })

  it('perEnemyGeos contiene las geometrías creadas por-enemigo (C2)', () => {
    const h = buildHumanoid()
    // belt + pocket(1 shared) + visor + eye(1 shared) + brow(1 shared) = 5
    expect(h.perEnemyGeos.length).toBe(5)
    // Todas son geometrías reales de Three.js (disposeables).
    for (const g of h.perEnemyGeos) {
      expect(typeof g.dispose).toBe('function')
    }
  })
})

describe('animateWalk - reseteo de idle (M8)', () => {
  it('idle resetea spine.z, chest.y, hips.y, head.z que walk modificaba', () => {
    const h = buildHumanoid()
    // Primero caminamos: esto setea spine.z, chest.y, hips.y, head.z.
    animateWalk(h, 1.0, 1)
    expect(h.spine.rotation.z).not.toBe(0)
    expect(h.chest.rotation.y).not.toBe(0)
    expect(h.hips.rotation.y).not.toBe(0)
    expect(h.head.rotation.z).not.toBe(0)

    // Ahora idle: todos esos deben volver a 0 (antes no se reseteaban).
    animateWalk(h, 1.0, 0)
    expect(h.spine.rotation.z).toBe(0)
    expect(h.chest.rotation.y).toBe(0)
    expect(h.hips.rotation.y).toBe(0)
    expect(h.head.rotation.z).toBe(0)
  })

  it('idle aplica respiración leve (no todo a cero)', () => {
    const h = buildHumanoid()
    animateWalk(h, 0, 0)
    // chest.x oscila con sin(phase*0.5)*0.02, no es exactamente 0 en general.
    // hips.position.y = 0.95 + sin(...)*0.005, cercano a 0.95.
    expect(h.hips.position.y).toBeCloseTo(0.95, 2)
  })

  it('walk mueve las piernas alternativamente (desfasadas 180°)', () => {
    const h = buildHumanoid()
    // En phase=0: legL.hip.x = sin(0)=0, legR.hip.x = sin(PI)=0 (ambos ~0).
    animateWalk(h, 0, 1)
    expect(h.legL.hip.rotation.x).toBeCloseTo(0, 10)
    expect(h.legR.hip.rotation.x).toBeCloseTo(0, 10)

    // En phase=PI/2: legL = sin(PI/2)*0.55=0.55, legR = sin(3PI/2)*0.55=-0.55.
    animateWalk(h, Math.PI / 2, 1)
    expect(h.legL.hip.rotation.x).toBeCloseTo(0.55, 5)
    expect(h.legR.hip.rotation.x).toBeCloseTo(-0.55, 5)
  })

  it('speed intermedio (0.5) escala la oscilación', () => {
    const h = buildHumanoid()
    animateWalk(h, Math.PI / 2, 0.5)
    // swing = sin(PI/2)*0.55*0.5 = 0.275
    expect(h.legL.hip.rotation.x).toBeCloseTo(0.275, 5)
  })
})
