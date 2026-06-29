import * as THREE from 'three'
import { mulberry32 } from '../math.js'
import { makeConcreteTextures, makeCrateTextures } from '../textures.js'
import { FLOOR_SIZE } from '../constants.js'

/* =========================================================================
   Mapa: Desert Outpost.
   --------------------------------------------------------------------------
   Outpost militar en desierto: hangares, barracas, torres de vigilancia,
   bidones, cajas de munición, muros de contención.
   ========================================================================= */

export function buildDesert(colliders) {
  const group = new THREE.Group()
  const rng = mulberry32(424242)
  const waterMaterials = []

  const sandTex = makeConcreteTextures(512)
  sandTex.map.repeat.set(40, 40)
  sandTex.normalMap.repeat.set(40, 40)
  sandTex.roughnessMap.repeat.set(40, 40)
  sandTex.map.colorSpace = THREE.SRGBColorSpace
  const sandMat = new THREE.MeshStandardMaterial({
    map: sandTex.map,
    normalMap: sandTex.normalMap,
    roughnessMap: sandTex.roughnessMap,
    color: 0xc2a878,
    roughness: 0.95,
    metalness: 0.05,
    normalScale: new THREE.Vector2(0.6, 0.6)
  })
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 64, 64),
    sandMat
  )
  sand.rotation.x = -Math.PI / 2
  sand.receiveShadow = true
  group.add(sand)

  const hangarMat = new THREE.MeshStandardMaterial({
    color: 0x8a7a5a, roughness: 0.85, metalness: 0.2
  })
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a2a, roughness: 0.6, metalness: 0.7
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

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const r = 18
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 4, z, 14, 8, 10, hangarMat)
    addBox(x, 8.2, z, 14, 0.4, 10, metalMat)
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3
    const r = 30
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    addBox(x, 2.5, z, 4, 5, 4, hangarMat)
    addBox(x, 5.2, z, 4.5, 0.5, 4.5, metalMat)
  }

  for (let i = 0; i < 20; i++) {
    const x = (rng() - 0.5) * 70
    const z = (rng() - 0.5) * 70
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue
    addBox(x, 1, z, 1.2, 1.2, 1.2, metalMat, 'crate')
  }

  for (let i = 0; i < 12; i++) {
    const x = (rng() - 0.5) * 60
    const z = (rng() - 0.5) * 60
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue
    addBox(x, 0.7, z, 0.8, 1.4, 0.8, metalMat, 'crate')
  }

  addBox(0, 2, -8, 12, 4, 1, hangarMat)
  addBox(-6, 2, -8, 1, 4, 6, hangarMat)
  addBox(6, 2, -8, 1, 4, 6, hangarMat)

  const sandbagMat = new THREE.MeshStandardMaterial({
    color: 0x9a8a6a, roughness: 0.95, metalness: 0.05
  })
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const r = 12
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    for (let j = 0; j < 3; j++) {
      addBox(x, 0.4 + j * 0.5, z, 2.5, 0.5, 1.5, sandbagMat, 'crate')
    }
  }

  const crateTex = makeCrateTextures(256)
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.map,
    normalMap: crateTex.normalMap,
    roughness: 0.85
  })
  for (let i = 0; i < 15; i++) {
    const x = (rng() - 0.5) * 80
    const z = (rng() - 0.5) * 80
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
    const s = 1 + rng() * 0.5
    addBox(x, s / 2, z, s, s, s, crateMat, 'crate')
  }

  return { group, colliders: [], waterMaterials, spawnEdges: ['N', 'S', 'E', 'W'] }
}
