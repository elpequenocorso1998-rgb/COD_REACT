import * as THREE from 'three'

/* =========================================================================
   Firing Range builder (Fase 18.53).
   --------------------------------------------------------------------------
   Mapa dedicado para testear armas/attachments sin enemigos.
   - Targets estáticos con daño por zona visible (head/chest/limbs).
   - Dummies a varias distancias (5m, 10m, 25m, 50m).
   - Distance markers en el suelo.
   - Invulnerable, infinite ammo, weapon swap freely.
   ========================================================================= */

export function buildFiringRange(colliders) {
  const group = new THREE.Group()

  // Suelo (grid).
  const floorGeo = new THREE.PlaneGeometry(120, 120)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  group.add(floor)

  // Distance markers (cada 5m de 5 a 50m).
  for (let d = 5; d <= 50; d += 5) {
    const markGeo = new THREE.BoxGeometry(2, 0.05, 0.4)
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const mark = new THREE.Mesh(markGeo, markMat)
    mark.position.set(0, 0.05, -d)
    group.add(mark)

    // Texto simulado con un plano (placeholder, no cargamos fonts).
    const poleGeo = new THREE.BoxGeometry(0.1, 1.5, 0.1)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666 })
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.set(1.5, 0.75, -d)
    group.add(pole)
  }

  // Dummies a distintas distancias.
  const distances = [5, 10, 15, 25, 35, 50]
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i]
    // 3 dummies por fila, distribuidos horizontalmente.
    for (let j = -1; j <= 1; j++) {
      const dummy = makeDummy(d)
      dummy.position.set(j * 4, 0, -d)
      group.add(dummy)
      if (colliders) {
        colliders.push({
          box: new THREE.Box3(
            new THREE.Vector3(j * 4 - 0.5, 0, -d - 0.3),
            new THREE.Vector3(j * 4 + 0.5, 2, -d + 0.3)
          ),
          type: 'crate'
        })
      }
    }
  }

  // Coberturas laterales para practicar wallbang.
  const coverGeo = new THREE.BoxGeometry(0.5, 1.5, 4)
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 })
  for (const x of [-8, 8]) {
    const cover = new THREE.Mesh(coverGeo, coverMat)
    cover.position.set(x, 0.75, -15)
    group.add(cover)
    if (colliders) {
      colliders.push({
        box: new THREE.Box3().setFromObject(cover),
        type: 'crate'
      })
    }
  }

  // Pared de fondo.
  const wallGeo = new THREE.BoxGeometry(60, 6, 0.5)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95 })
  const wall = new THREE.Mesh(wallGeo, wallMat)
  wall.position.set(0, 3, -55)
  group.add(wall)
  if (colliders) {
    colliders.push({
      box: new THREE.Box3().setFromObject(wall),
      type: 'wall'
    })
  }

  return group
}

function makeDummy(distance) {
  const dummy = new THREE.Group()
  // Poste.
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 })
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.y = 0.9
  dummy.add(pole)
  // Head (esfera roja — headshot target).
  const headGeo = new THREE.SphereGeometry(0.18, 16, 12)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xff3030, emissive: 0x801010, emissiveIntensity: 0.4
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 1.65
  head.userData.part = 'head'
  dummy.add(head)
  // Chest (caja amarilla — body shot).
  const chestGeo = new THREE.BoxGeometry(0.5, 0.6, 0.3)
  const chestMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00, emissive: 0x806000, emissiveIntensity: 0.3
  })
  const chest = new THREE.Mesh(chestGeo, chestMat)
  chest.position.y = 1.15
  chest.userData.part = 'chest'
  dummy.add(chest)
  // Limbs (cilindros verdes).
  const limbGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8)
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x30ff30, emissive: 0x108010, emissiveIntensity: 0.3
  })
  const armL = new THREE.Mesh(limbGeo, limbMat)
  armL.position.set(-0.35, 1.15, 0)
  armL.userData.part = 'leftArm'
  dummy.add(armL)
  const armR = new THREE.Mesh(limbGeo, limbMat)
  armR.position.set(0.35, 1.15, 0)
  armR.userData.part = 'rightArm'
  dummy.add(armR)
  const legL = new THREE.Mesh(limbGeo, limbMat)
  legL.position.set(-0.15, 0.5, 0)
  legL.userData.part = 'leftLeg'
  dummy.add(legL)
  const legR = new THREE.Mesh(limbGeo, limbMat)
  legR.position.set(0.15, 0.5, 0)
  legR.userData.part = 'rightLeg'
  dummy.add(legR)

  dummy.userData.distance = distance
  dummy.userData.isTarget = true
  return dummy
}

// Añade firing range al registry de mapas (lo hace el importer si procede).
export const FIRING_RANGE_META = {
  id: 'firingRange',
  name: 'Firing Range',
  biome: 'training',
  desc: 'Practice range with targets at multiple distances',
  fogColor: 0x444444,
  fogDensity: 0.005,
  sunColor: 0xffffff,
  sunIntensity: 1.2,
  ambientColor: 0x666666,
  ambientIntensity: 0.6,
  hemiSky: 0x999999,
  hemiGround: 0x444444,
  hemiIntensity: 0.7,
  skyTop: 0x556677,
  skyBottom: 0x999999
}
