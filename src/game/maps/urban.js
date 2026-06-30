import * as THREE from 'three'
import { mulberry32 } from '../math.js'
import { makeConcreteTextures, makeCrateTextures } from '../textures.js'
import { FLOOR_SIZE } from '../constants.js'

/* =========================================================================
   Mapa: Urban Destroyed.
   --------------------------------------------------------------------------
   Ciudad moderna destruida: edificios de hormigón con escombros,
   coches abandonados, barricadas, contenedores.
   ========================================================================= */

export function buildUrban(colliders) {
  const group = new THREE.Group()
  const rng = mulberry32(707070)
  const waterMaterials = []

  const roadTex = makeConcreteTextures(512)
  roadTex.map.repeat.set(20, 20)
  roadTex.normalMap.repeat.set(20, 20)
  roadTex.roughnessMap.repeat.set(20, 20)
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex.map,
    normalMap: roadTex.normalMap,
    roughnessMap: roadTex.roughnessMap,
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.1,
    normalScale: new THREE.Vector2(0.5, 0.5)
  })
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 64, 64),
    roadMat
  )
  road.rotation.x = -Math.PI / 2
  road.receiveShadow = true
  group.add(road)

  // Suelo extendido para cubrir el horizonte.
  const extRoadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
  const extRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE * 6, FLOOR_SIZE * 6),
    extRoadMat
  )
  extRoad.rotation.x = -Math.PI / 2
  extRoad.position.y = -0.02
  group.add(extRoad)

  // Fase 19.10: texturas PBR para edificios urbanos.
  const concTex = makeConcreteTextures(512)
  concTex.map.repeat.set(6, 6)
  concTex.normalMap.repeat.set(6, 6)
  concTex.roughnessMap.repeat.set(6, 6)
  const buildingMat = new THREE.MeshStandardMaterial({
    map: concTex.map, normalMap: concTex.normalMap,
    roughnessMap: concTex.roughnessMap,
    color: 0x6a6a6a, roughness: 0.85, metalness: 0.15
  })
  const crateTexResult = makeCrateTextures(256)
  const _crateMat = new THREE.MeshStandardMaterial({
    map: crateTexResult.map, normalMap: crateTexResult.normalMap,
    color: 0x4a3a2a, roughness: 0.8, metalness: 0.1
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, roughness: 0.7, metalness: 0.4
  })
  const carMat = new THREE.MeshStandardMaterial({
    color: 0x4a2a2a, roughness: 0.5, metalness: 0.7
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

  const buildingPositions = [
    { x: -22, z: -22, w: 12, h: 14, d: 12 },
    { x: -22, z: 0, w: 12, h: 18, d: 10 },
    { x: -22, z: 22, w: 12, h: 12, d: 12 },
    { x: 22, z: -22, w: 12, h: 16, d: 12 },
    { x: 22, z: 0, w: 12, h: 14, d: 10 },
    { x: 22, z: 22, w: 12, h: 18, d: 12 },
    { x: 0, z: -30, w: 18, h: 16, d: 8 },
    { x: 0, z: 30, w: 18, h: 14, d: 8 }
  ]
  buildingPositions.forEach((b) => {
    addBox(b.x, b.h / 2, b.z, b.w, b.h, b.d, buildingMat)
    addBox(b.x, b.h + 0.2, b.z, b.w + 0.5, 0.4, b.d + 0.5, darkMat)
  })

  for (let i = 0; i < 8; i++) {
    const x = (rng() - 0.5) * 40
    const z = (rng() - 0.5) * 40
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue
    addBox(x, 0.7, z, 4, 1.4, 2, carMat, 'crate')
    addBox(x, 1.5, z, 4, 0.4, 2, darkMat)
  }

  const containerMat = new THREE.MeshStandardMaterial({
    color: 0x8a4a2a, roughness: 0.8, metalness: 0.4
  })
  for (let i = 0; i < 6; i++) {
    const x = (rng() - 0.5) * 50
    const z = (rng() - 0.5) * 50
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
    const horizontal = rng() > 0.5
    const w = horizontal ? 6 : 2.5
    const d = horizontal ? 2.5 : 6
    addBox(x, 1.3, z, w, 2.6, d, containerMat, 'crate')
  }

  const barricadeMat = new THREE.MeshStandardMaterial({
    color: 0x5a4a3a, roughness: 0.9, metalness: 0.1
  })
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const r = 8
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 0.5, z, 2, 1, 0.5, barricadeMat, 'crate')
  }

  const debrisMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a7a, roughness: 0.95
  })
  for (let i = 0; i < 25; i++) {
    const x = (rng() - 0.5) * 80
    const z = (rng() - 0.5) * 80
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue
    const s = 0.3 + rng() * 0.7
    addBox(x, s / 2, z, s, s, s, debrisMat, 'crate')
  }

  return { group, colliders: [], waterMaterials, spawnEdges: ['N', 'S', 'E', 'W'] }
}
