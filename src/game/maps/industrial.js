import * as THREE from 'three'
import { mulberry32 } from '@/game/core/math'
import { makeConcreteTextures, makeCrateTextures, makeBarrelTexture } from '@/game/world/textures'
import { FLOOR_SIZE } from '@/game/core/constants'

/* =========================================================================
   Mapa: Industrial.
   --------------------------------------------------------------------------
   Fábrica + tanques + tuberías + grúas + contenedores.
   ========================================================================= */

export function buildIndustrial(colliders) {
  const group = new THREE.Group()
  const rng = mulberry32(909090)
  const waterMaterials = []

  const concreteTex = makeConcreteTextures(512)
  concreteTex.map.repeat.set(30, 30)
  concreteTex.normalMap.repeat.set(30, 30)
  concreteTex.roughnessMap.repeat.set(30, 30)
  const floorMat = new THREE.MeshStandardMaterial({
    map: concreteTex.map,
    normalMap: concreteTex.normalMap,
    roughnessMap: concreteTex.roughnessMap,
    color: 0x4a4a4a,
    roughness: 0.9,
    metalness: 0.15,
    normalScale: new THREE.Vector2(0.7, 0.7)
  })
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 64, 64),
    floorMat
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  // Suelo extendido para cubrir el horizonte.
  const extFloorMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
  const extFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE * 6, FLOOR_SIZE * 6),
    extFloorMat
  )
  extFloor.rotation.x = -Math.PI / 2
  extFloor.position.y = -0.02
  group.add(extFloor)

  // Fase 19.10: texturas PBR para edificios industriales.
  const concTex = makeConcreteTextures(512)
  concTex.map.repeat.set(5, 5)
  concTex.normalMap.repeat.set(5, 5)
  concTex.roughnessMap.repeat.set(5, 5)
  const metalMat = new THREE.MeshStandardMaterial({
    map: concTex.map, normalMap: concTex.normalMap,
    roughnessMap: concTex.roughnessMap,
    color: 0x5a5a5a, roughness: 0.5, metalness: 0.8
  })
  const rustMat = new THREE.MeshStandardMaterial({
    color: 0x8a4a2a, roughness: 0.8, metalness: 0.4
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, roughness: 0.6, metalness: 0.6
  })

  function addBox(x, y, z, w, h, d, mat, type = 'wall') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    const box = new THREE.Box3().setFromObject(mesh)
    colliders.push({ box, type })
    return mesh
  }

  function addCylinder(x, y, z, r, h, mat, type = 'wall') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    const box = new THREE.Box3().setFromObject(mesh)
    colliders.push({ box, type })
    return mesh
  }

  const warehousePositions = [
    { x: -22, z: -22, w: 16, h: 8, d: 12 },
    { x: 22, z: -22, w: 16, h: 8, d: 12 },
    { x: -22, z: 22, w: 16, h: 10, d: 12 },
    { x: 22, z: 22, w: 16, h: 10, d: 12 }
  ]
  warehousePositions.forEach((w) => {
    addBox(w.x, w.h / 2, w.z, w.w, w.h, w.d, metalMat)
    addBox(w.x, w.h + 0.2, w.z, w.w + 0.5, 0.4, w.d + 0.5, darkMat)
  })

  for (let i = 0; i < 6; i++) {
    const x = (rng() - 0.5) * 50
    const z = (rng() - 0.5) * 50
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
    const r = 2 + rng() * 1.5
    const h = 4 + rng() * 4
    addCylinder(x, h / 2, z, r, h, rustMat)
    addCylinder(x, h + 0.3, z, r + 0.2, 0.6, darkMat)
  }

  for (let i = 0; i < 20; i++) {
    const x1 = (rng() - 0.5) * 60
    const z1 = (rng() - 0.5) * 60
    const x2 = x1 + (rng() - 0.5) * 8
    const z2 = z1 + (rng() - 0.5) * 8
    const y = 3 + rng() * 4
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.5) continue
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, len, 8),
      rustMat
    )
    pipe.position.set((x1 + x2) / 2, y, (z1 + z2) / 2)
    pipe.rotation.z = Math.PI / 2
    pipe.rotation.y = Math.atan2(dz, dx)
    pipe.castShadow = true
    group.add(pipe)
  }

  const barrelTex = makeBarrelTexture(256)
  const barrelMat = new THREE.MeshStandardMaterial({
    map: barrelTex,
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.5
  })
  for (let i = 0; i < 20; i++) {
    const x = (rng() - 0.5) * 70
    const z = (rng() - 0.5) * 70
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue
    addCylinder(x, 0.6, z, 0.5, 1.2, barrelMat, 'crate')
  }

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
    const r = 15
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 4, z, 0.6, 8, 0.6, darkMat)
    const armLen = 6
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armLen, 0.4, 0.4),
      metalMat
    )
    arm.position.set(x + Math.cos(angle + Math.PI / 2) * armLen / 2, 8, z + Math.sin(angle + Math.PI / 2) * armLen / 2)
    arm.castShadow = true
    group.add(arm)
  }

  const crateTex = makeCrateTextures(256)
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.map,
    normalMap: crateTex.normalMap,
    roughness: 0.85
  })
  for (let i = 0; i < 18; i++) {
    const x = (rng() - 0.5) * 70
    const z = (rng() - 0.5) * 70
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue
    const stack = 1 + Math.floor(rng() * 3)
    for (let j = 0; j < stack; j++) {
      addBox(x, 0.6 + j * 1.2, z, 1.2, 1.2, 1.2, crateMat, 'crate')
    }
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const r = 8
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 1, z, 4, 2, 1, metalMat, 'crate')
  }

  return { group, colliders: [], waterMaterials, spawnEdges: ['N', 'S', 'E', 'W'] }
}
