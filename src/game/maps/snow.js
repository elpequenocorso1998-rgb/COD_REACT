import * as THREE from 'three'
import { mulberry32 } from '../math.js'
import { makeConcreteTextures, makeCrateTextures } from '../textures.js'
import { FLOOR_SIZE } from '../constants.js'

/* =========================================================================
   Mapa: Snow Base.
   --------------------------------------------------------------------------
   Base militar ártica: hangares, torres de radio, generadores, cajas
   de munición, muros de hormigón con nieve acumulada.
   ========================================================================= */

export function buildSnow(colliders) {
  const group = new THREE.Group()
  const rng = mulberry32(313131)
  const waterMaterials = []

  const snowTex = makeConcreteTextures(512)
  snowTex.map.repeat.set(50, 50)
  snowTex.normalMap.repeat.set(50, 50)
  snowTex.roughnessMap.repeat.set(50, 50)
  const snowMat = new THREE.MeshStandardMaterial({
    map: snowTex.map,
    normalMap: snowTex.normalMap,
    roughnessMap: snowTex.roughnessMap,
    color: 0xe8eef2,
    roughness: 0.6,
    metalness: 0.05,
    normalScale: new THREE.Vector2(0.3, 0.3)
  })
  const snow = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 64, 64),
    snowMat
  )
  snow.rotation.x = -Math.PI / 2
  snow.receiveShadow = true
  group.add(snow)

  // Suelo extendido para cubrir el horizonte.
  const extSnowMat = new THREE.MeshStandardMaterial({ color: 0xd8e0e8, roughness: 0.9 })
  const extSnow = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE * 6, FLOOR_SIZE * 6),
    extSnowMat
  )
  extSnow.rotation.x = -Math.PI / 2
  extSnow.position.y = -0.02
  group.add(extSnow)

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x4a5a6a, roughness: 0.5, metalness: 0.7
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a4a, roughness: 0.6, metalness: 0.5
  })
  const snowOnTopMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8, roughness: 0.5, metalness: 0.05
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

  const buildings = [
    { x: -20, z: -20, w: 14, h: 7, d: 14 },
    { x: 20, z: -20, w: 14, h: 8, d: 14 },
    { x: -20, z: 20, w: 14, h: 7, d: 14 },
    { x: 20, z: 20, w: 14, h: 9, d: 14 }
  ]
  buildings.forEach((b) => {
    addBox(b.x, b.h / 2, b.z, b.w, b.h, b.d, metalMat)
    addBox(b.x, b.h + 0.2, b.z, b.w + 0.4, 0.5, b.d + 0.4, snowOnTopMat)
  })

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
    const r = 14
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 3, z, 0.6, 6, 0.6, darkMat)
    addBox(x, 6.2, z, 3, 0.4, 3, darkMat)
    addBox(x, 6.4, z, 1, 0.4, 1, snowOnTopMat)
  }

  for (let i = 0; i < 6; i++) {
    const x = (rng() - 0.5) * 50
    const z = (rng() - 0.5) * 50
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
    addBox(x, 1, z, 2, 2, 2, darkMat, 'crate')
    addBox(x, 2.1, z, 1.5, 0.3, 1.5, snowOnTopMat)
  }

  for (let i = 0; i < 10; i++) {
    const x = (rng() - 0.5) * 70
    const z = (rng() - 0.5) * 70
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue
    const radius = 0.4 + rng() * 0.8
    const pineGeo = new THREE.ConeGeometry(radius, 3 + rng() * 2, 6)
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a2a, roughness: 0.9
    })
    const pine = new THREE.Mesh(pineGeo, pineMat)
    pine.position.set(x, 1.5, z)
    pine.castShadow = true
    group.add(pine)
    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.7, 1, 6),
      snowOnTopMat
    )
    snowCap.position.set(x, 2.5, z)
    group.add(snowCap)
  }

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x5a6a7a, roughness: 0.7, metalness: 0.3
  })
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const r = 10
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 1.5, z, 3, 3, 0.6, wallMat)
    addBox(x, 3.1, z, 3, 0.3, 0.6, snowOnTopMat)
  }

  const crateTex = makeCrateTextures(256)
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.map,
    normalMap: crateTex.normalMap,
    roughness: 0.8
  })
  for (let i = 0; i < 12; i++) {
    const x = (rng() - 0.5) * 60
    const z = (rng() - 0.5) * 60
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue
    addBox(x, 0.6, z, 1.2, 1.2, 1.2, crateMat, 'crate')
  }

  return { group, colliders: [], waterMaterials, spawnEdges: ['N', 'S', 'E', 'W'] }
}
