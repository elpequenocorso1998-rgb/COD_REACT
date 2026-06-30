import * as THREE from 'three'
import {
  makeConcreteTextures,
  makeBarrelTexture,
  makeCrateTextures
} from './textures.js'
import {
  makeSillarTexture,
  makeRoofTexture,
  makeWoodTexture,
  buildPamplonaHouse,
  buildPamplonaHouseInterior,
  buildBullring,
  buildCityWall,
  buildSanFerdinandBanners,
  buildFountain
} from './pamplona.js'
import { mulberry32 } from './math.js'
import { createSkyMaterial } from './shaders/sky.js'
import { SpatialGrid } from './spatial-grid.js'
import { getMapConfig } from './maps/index.js'
import {
  SUN_DIR, SUN_DIR_NORMALIZED, SUN_GLOW_COLOR, SUN_MESH_COLOR,
  SHADOW_MAP_SIZE, SHADOW_CAMERA_NEAR, SHADOW_CAMERA_FAR, SHADOW_CAMERA_BOUNDS,
  SHADOW_BIAS, SHADOW_NORMAL_BIAS,
  FLOOR_SIZE, PRNG_SEEDS
} from './constants.js'

/* =========================================================================
   Mundo: Pamplona.
   --------------------------------------------------------------------------
   Monta un escenario inspirado en Pamplona:
   - Suelo de adoquines.
   - Plaza central (estilo Plaza del Castillo) con fuente.
   - Callejones de casas de sillar con balcones y teja.
   - Plaza de Toros al fondo.
   - Tramos de muralla con almenas.
   - Banderines rojiblancos de San Fermín entre edificios.
   - Farolas históricas, árboles, escombros.

   Mejoras técnicas:
   - collidesAt SIN allocations: reutilizamos vectores y comprobamos
     contra los AABB originales (sin clone+expandByScalar por llamada).
   - Los colliders de las casas rotadas se calculan correctamente
     aplicando la rotación al grupo ANTES de setFromObject.
   - Posición del sol unificada para luz, mesh visual y env map.
   - Reducidas las luces dinámicas: solo las farolas cercanas al jugador
     se activan (las demás son solo emisivas).
   - Niebla con color que coincide con el horizonte del cielo.
   ========================================================================= */

export function createWorld(scene, mapId = 'pamplona') {
  const mapConfig = getMapConfig(mapId)
  const colliders = []
  // Collider circular de la plaza de toros: { cx, cz, rOuter, rInner }.
  const circleColliders = []

  // ---------------------------------------------------------------------
  // LUCES: configurables por mapa (bioma).
  // ---------------------------------------------------------------------
  const ambient = new THREE.AmbientLight(mapConfig.ambientColor, mapConfig.ambientIntensity)
  scene.add(ambient)

  const hemi = new THREE.HemisphereLight(mapConfig.hemiSky, mapConfig.hemiGround, mapConfig.hemiIntensity)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(mapConfig.sunColor, mapConfig.sunIntensity)
  sun.position.copy(SUN_DIR)
  sun.target.position.set(0, 0, 0)
  scene.add(sun.target)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  sun.shadow.camera.near = SHADOW_CAMERA_NEAR
  sun.shadow.camera.far = SHADOW_CAMERA_FAR
  sun.shadow.camera.left = -SHADOW_CAMERA_BOUNDS
  sun.shadow.camera.right = SHADOW_CAMERA_BOUNDS
  sun.shadow.camera.top = SHADOW_CAMERA_BOUNDS
  sun.shadow.camera.bottom = -SHADOW_CAMERA_BOUNDS
  sun.shadow.bias = SHADOW_BIAS
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS
  scene.add(sun)

  // Fase 1.7: el sun sigue al jugador para que el frustum de sombras
  // siempre cubra el área relevante (aproximación a CSM). Mantenemos la
  // dirección del sol (SUN_DIR) y desplazamos posición + target juntos.
  // Esto da sombras nítidas cerca del jugador sin necesitar múltiples maps.
  const _shadowOffset = new THREE.Vector3()
  function updateShadows(playerPos) {
    _shadowOffset.copy(SUN_DIR_NORMALIZED).multiplyScalar(100)
    sun.position.set(
      playerPos.x + _shadowOffset.x,
      _shadowOffset.y,
      playerPos.z + _shadowOffset.z
    )
    sun.target.position.set(playerPos.x, 0, playerPos.z)
    sun.target.updateMatrixWorld()
  }

  const fill = new THREE.DirectionalLight(0x8a6a4a, 0.4)
  fill.position.set(-50, 40, -30)
  scene.add(fill)

  // Niebla con color del bioma.
  scene.fog = new THREE.FogExp2(mapConfig.fogColor, mapConfig.fogDensity)

  let waterMaterials = []
  let waterTime = 0
  let tex = null
  let sillarTex = null
  let roofTex = null
  let woodTex = null
  let crateTex = null
  let barrelTex = null
  let lampLights = []

  if (mapId === 'pamplona') {
  // ---------------------------------------------------------------------
  // SUELO: adoquines.
  // ---------------------------------------------------------------------
  tex = makeConcreteTextures(512)
  // Recoloreamos a tono adoquín. IMPORTANTE: alineamos repeat de color,
  // normal y roughness para que las juntas coincidan.
  tex.map.repeat.set(30, 30)
  tex.normalMap.repeat.set(30, 30)
  tex.roughnessMap.repeat.set(30, 30)
  const floorMat = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    roughnessMap: tex.roughnessMap,
    color: 0x4a4030,
    roughness: 0.85,
    metalness: 0.15,
    normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 0.8
  })
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 64, 64),
    floorMat
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Suelo extendido más allá del área jugable para que el horizonte
  // siempre se vea cubierto (sin corte visible contra el cielo).
  const extendedFloorMat = new THREE.MeshStandardMaterial({
    color: 0x3a3020,
    roughness: 0.95,
    metalness: 0.05
  })
  const extendedFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE * 6, FLOOR_SIZE * 6),
    extendedFloorMat
  )
  extendedFloor.rotation.x = -Math.PI / 2
  extendedFloor.position.y = -0.02
  extendedFloor.receiveShadow = false
  scene.add(extendedFloor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Texturas compartidas de Pamplona.
  sillarTex = makeSillarTexture(512)
  roofTex = makeRoofTexture(256)
  woodTex = makeWoodTexture(256, '#5a3a1c')

  // ---------------------------------------------------------------------
  // PLAZA CENTRAL (estilo Plaza del Castillo).
  // Espacio abierto con fuente en el centro.
  // ---------------------------------------------------------------------
  const fountain = buildFountain(sillarTex)
  fountain.group.position.set(0, 0, 0)
  fountain.group.updateMatrixWorld(true)
  scene.add(fountain.group)
  // La fuente es sólida (antes el jugador la atravesaba).
  if (fountain.colliders) {
    fountain.colliders.forEach((box) => {
      box.applyMatrix4(fountain.group.matrixWorld)
      colliders.push({ box, type: 'wall' })
    })
  }
  // Fase 1.7: materiales de agua para animar oleaje cada frame.
  waterMaterials = fountain.waterMaterials || []

  // ---------------------------------------------------------------------
  // CASAS alrededor de la plaza, formando callejones.
  // Anillo de casas en 4 lados dejando callejones de entrada.
  // ---------------------------------------------------------------------
  const houses = [
    { x: -14, z: -25, w: 10, h: 10, d: 7, floors: 3, rotY: 0, interior: true },
    { x: 0, z: -25, w: 10, h: 11, d: 7, floors: 3, rotY: 0, interior: false },
    { x: 14, z: -25, w: 10, h: 10, d: 7, floors: 3, rotY: 0, interior: true },
    { x: -14, z: 25, w: 10, h: 10, d: 7, floors: 3, rotY: Math.PI, interior: false },
    { x: 0, z: 25, w: 10, h: 12, d: 7, floors: 4, rotY: Math.PI, interior: true },
    { x: 14, z: 25, w: 10, h: 10, d: 7, floors: 3, rotY: Math.PI, interior: true },
    { x: -25, z: -14, w: 7, h: 10, d: 10, floors: 3, rotY: Math.PI / 2, interior: false },
    { x: -25, z: 0, w: 7, h: 11, d: 10, floors: 3, rotY: Math.PI / 2, interior: false },
    { x: -25, z: 14, w: 7, h: 10, d: 10, floors: 3, rotY: Math.PI / 2, interior: false },
    { x: 25, z: -14, w: 7, h: 10, d: 10, floors: 3, rotY: -Math.PI / 2, interior: false },
    { x: 25, z: 0, w: 7, h: 12, d: 10, floors: 4, rotY: -Math.PI / 2, interior: false },
    { x: 25, z: 14, w: 7, h: 10, d: 10, floors: 3, rotY: -Math.PI / 2, interior: false }
  ]
  houses.forEach((cfg) => {
    // Fase 1.6: las casas marcadas 'interior' usan buildPamplonaHouseInterior
    // (muros con puerta + ventanas + escalera a azotea). El resto son sólidas.
    const builder = cfg.interior ? buildPamplonaHouseInterior : buildPamplonaHouse
    const { group, colliders: c } = builder(cfg.interior
      ? { width: cfg.w, height: cfg.h, depth: cfg.d, floors: cfg.floors, sillarTex, woodTex }
      : { width: cfg.w, height: cfg.h, depth: cfg.d, floors: cfg.floors, sillarTex, roofTex, woodTex }
    )
    group.position.set(cfg.x, 0, cfg.z)
    group.rotation.y = cfg.rotY
    // ACTUALIZAMOS matrices antes de setFromObject para que el AABB
    // tenga en cuenta la rotación del grupo (bug fixed).
    group.updateMatrixWorld(true)
    scene.add(group)
    // Recalculamos los colliders desde el grupo ya transformado.
    c.forEach(box => {
      box.applyMatrix4(group.matrixWorld)
      colliders.push({ box, type: 'wall' })
    })
  })

  // ---------------------------------------------------------------------
  // CALLEJONES: más casas formando calles estrechas hacia el exterior.
  // ---------------------------------------------------------------------
  const rng = mulberry32(PRNG_SEEDS.world)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const r = 55 + rng() * 5
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const w = 8 + rng() * 4
    const d = 7 + rng() * 3
    const h = 9 + Math.floor(rng() * 3) * 2
    const floors = Math.floor(h / 3.5)
    const { group, colliders: c } = buildPamplonaHouse({
      width: w, height: h, depth: d, floors,
      sillarTex, roofTex, woodTex
    })
    group.position.set(x, 0, z)
    group.rotation.y = Math.atan2(-x, -z)
    group.updateMatrixWorld(true)
    scene.add(group)
    c.forEach(box => {
      box.applyMatrix4(group.matrixWorld)
      colliders.push({ box, type: 'wall' })
    })
  }

  // ---------------------------------------------------------------------
  // PLAZA DE TOROS al fondo (norte).
  // ---------------------------------------------------------------------
  const bullring = buildBullring(sillarTex, roofTex)
  bullring.group.position.set(0, 0, -95)
  bullring.group.updateMatrixWorld(true)
  scene.add(bullring.group)
  // Collider CIRCULAR en lugar de cuadrado: dos anillos (muro exterior).
  circleColliders.push({
    cx: 0, cz: -95, rOuter: 29, rInner: 0
  })

  // ---------------------------------------------------------------------
  // MURALLAS: tramos en los bordes.
  // ---------------------------------------------------------------------
  const wallSegments = [
    { x: -85, z: 0, length: 50, rotY: Math.PI / 2 },
    { x: 85, z: 0, length: 50, rotY: Math.PI / 2 },
    { x: 0, z: 85, length: 80, rotY: 0 }
  ]
  wallSegments.forEach(seg => {
    const { group, colliders: c } = buildCityWall({
      length: seg.length, height: 7, sillarTex
    })
    group.position.set(seg.x, 0, seg.z)
    group.rotation.y = seg.rotY
    group.updateMatrixWorld(true)
    scene.add(group)
    c.forEach(box => {
      box.applyMatrix4(group.matrixWorld)
      colliders.push({ box, type: 'wall' })
    })
  })

  // ---------------------------------------------------------------------
  // BANDERINES DE SAN FERMÍN entre las casas de la plaza.
  // ---------------------------------------------------------------------
  const bannerPositions = [
    [[-10, -21], [10, -21]],
    [[-10, 21], [10, 21]],
    [[-21, -10], [-21, 10]],
    [[21, -10], [21, 10]]
  ]
  bannerPositions.forEach(([s, e]) => {
    const b = buildSanFerdinandBanners(s, e, 7)
    scene.add(b)
  })

  // ---------------------------------------------------------------------
  // FAROLAS históricas de hierro.
  // REDUCIMOS las luces dinámicas: solo guardamos las PointLight y
  // activamos las 4 más cercanas al jugador cada frame.
  // ---------------------------------------------------------------------
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.5
  })
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a0, emissive: 0xffaa44, emissiveIntensity: 4
  })
  const lampPositions = [
    [-8, -8], [8, -8], [-8, 8], [8, 8],
    [-15, 0], [15, 0], [0, -15], [0, 15],
    [-30, -30], [30, -30], [-30, 30], [30, 30]
  ]
  lampLights = []
  lampPositions.forEach(([x, z]) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 5, 8), poleMat
    )
    pole.position.set(x, 2.5, z); pole.castShadow = true; scene.add(pole)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8), poleMat
    )
    base.position.set(x, 0.15, z); scene.add(base)
    // Brazo: dirección según lado de la plaza para que apunte al centro.
    const sign = x < 0 ? 1 : -1
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), poleMat
    )
    arm.position.set(x + sign * 0.3, 4.8, z)
    arm.rotation.z = sign * Math.PI / 4
    scene.add(arm)
    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.4, 8), poleMat
    )
    cage.position.set(x + sign * 0.5, 4.6, z); scene.add(cage)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampMat)
    bulb.position.set(x + sign * 0.5, 4.6, z); scene.add(bulb)
    // PointLight: empieza apagada, se activa dinámicamente.
    const pl = new THREE.PointLight(0xffb060, 0, 18, 1.8)
    pl.position.set(x + sign * 0.5, 4.6, z)
    scene.add(pl)
    // x/z redundantes con pl.position: los guardamos para updateLamps sin
    // tener que leer .position cada frame (acceso directo más rápido).
    lampLights.push({ light: pl, x: x + sign * 0.5, z: z })
  })

  // ---------------------------------------------------------------------
  // ÁRBOLES (InstancedMesh: antes 18 troncos + 72 hojas = 90 meshes/draw
  // calls; ahora 2 InstancedMesh = 2 draw calls).
  // ---------------------------------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
  const leavesMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a2a, roughness: 0.8, metalness: 0.05
  })
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 3, 8)
  const leafGeo = new THREE.SphereGeometry(1, 10, 10) // unidad, escala por-instancia
  const TREE_COUNT = 18
  const LEAVES_PER_TREE = 4
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT)
  trunkInst.castShadow = true
  const leavesInst = new THREE.InstancedMesh(leafGeo, leavesMat, TREE_COUNT * LEAVES_PER_TREE)
  leavesInst.castShadow = true
  const _treeMat = new THREE.Matrix4()
  const _treePos = new THREE.Vector3()
  const _treeQuat = new THREE.Quaternion()
  const _treeScale = new THREE.Vector3()
  const _leafScale = new THREE.Vector3()
  let trunkIdx = 0, leafIdx = 0
  for (let i = 0; i < TREE_COUNT; i++) {
    const a = rng() * Math.PI * 2
    const r = 18 + rng() * 20
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    _treePos.set(x, 1.5, z)
    _treeQuat.identity()
    _treeScale.set(1, 1, 1)
    _treeMat.compose(_treePos, _treeQuat, _treeScale)
    trunkInst.setMatrixAt(trunkIdx++, _treeMat)
    for (let j = 0; j < LEAVES_PER_TREE; j++) {
      const radius = 1.2 + rng() * 0.4
      _treePos.set(
        x + (rng() - 0.5) * 1.5,
        3.5 + rng() * 1.5,
        z + (rng() - 0.5) * 1.5
      )
      _leafScale.set(radius, radius, radius)
      _treeMat.compose(_treePos, _treeQuat, _leafScale)
      leavesInst.setMatrixAt(leafIdx++, _treeMat)
    }
  }
  trunkInst.instanceMatrix.needsUpdate = true
  leavesInst.instanceMatrix.needsUpdate = true
  scene.add(trunkInst, leavesInst)

  // ---------------------------------------------------------------------
  // ESCOMBROS y detalle (InstancedMesh: antes 80 meshes/draw calls;
  // ahora 1 InstancedMesh = 1 draw call).
  // ---------------------------------------------------------------------
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.95 })
  const debrisGeo = new THREE.DodecahedronGeometry(1, 0) // unidad, escala por-instancia
  const DEBRIS_COUNT = 80
  const debrisInst = new THREE.InstancedMesh(debrisGeo, debrisMat, DEBRIS_COUNT)
  debrisInst.castShadow = true
  debrisInst.receiveShadow = true
  let debrisIdx = 0
  // Euler reutilizado para los escombros (antes se allocaba uno por iteración).
  const _debrisEuler = new THREE.Euler()
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const s = 0.1 + rng() * 0.4
    _treePos.set(
      (rng() - 0.5) * (FLOOR_SIZE - 8),
      s * 0.5,
      (rng() - 0.5) * (FLOOR_SIZE - 8)
    )
    _debrisEuler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI)
    _treeQuat.setFromEuler(_debrisEuler)
    _treeScale.set(s, s, s)
    _treeMat.compose(_treePos, _treeQuat, _treeScale)
    debrisInst.setMatrixAt(debrisIdx++, _treeMat)
  }
  debrisInst.instanceMatrix.needsUpdate = true
  scene.add(debrisInst)

  // Algunos bidones y cajas dispersos como cobertura táctica.
  crateTex = makeCrateTextures(256)
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.map, normalMap: crateTex.normalMap,
    roughness: 0.9, metalness: 0.05,
    normalScale: new THREE.Vector2(0.7, 0.7)
  })
  barrelTex = makeBarrelTexture(256)
  barrelTex.wrapS = THREE.RepeatWrapping
  barrelTex.repeat.set(2, 1)
  const barrelMat = new THREE.MeshStandardMaterial({
    map: barrelTex, color: 0xc24a2a, roughness: 0.45, metalness: 0.75
  })
  for (let i = 0; i < 12; i++) {
    const x = (rng() - 0.5) * 60
    const z = (rng() - 0.5) * 60
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue
    if (rng() > 0.5) {
      const s = 1.4 + rng() * 0.8
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat)
      crate.position.set(x, s / 2, z); crate.castShadow = true; crate.receiveShadow = true
      crate.rotation.y = rng() * Math.PI
      crate.updateMatrixWorld()
      scene.add(crate)
      colliders.push({ box: new THREE.Box3().setFromObject(crate), type: 'crate' })
    } else {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.6, 18), barrelMat
      )
      barrel.position.set(x, 0.8, z); barrel.castShadow = true; barrel.receiveShadow = true
      barrel.updateMatrixWorld()
      scene.add(barrel)
      colliders.push({ box: new THREE.Box3().setFromObject(barrel), type: 'crate' })
    }
  }
  } else if (mapConfig.builder) {
    const result = mapConfig.builder(colliders)
    if (result.group) scene.add(result.group)
    if (result.waterMaterials) waterMaterials = result.waterMaterials
  }

  // ---------------------------------------------------------------------
  // CIELO: gradiente esférico con sol.
  // El shader de cielo está compartido en shaders/sky.js (antes duplicado
  // aquí y en environment.js).
  // ---------------------------------------------------------------------

  const skyGeo = new THREE.SphereGeometry(500, 32, 16)
  const skyMat = createSkyMaterial()
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  // Sol: disco emisivo + glow. Posición unificada con la luz direccional.
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 24),
    new THREE.MeshBasicMaterial({ color: SUN_MESH_COLOR })
  )
  sunMesh.position.copy(SUN_DIR).multiplyScalar(2.5)
  scene.add(sunMesh)
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 24),
    new THREE.MeshBasicMaterial({ color: SUN_GLOW_COLOR, transparent: true, opacity: 0.4 })
  )
  sunGlow.position.copy(sunMesh.position)
  scene.add(sunGlow)

  // ---------------------------------------------------------------------
  // collidesAt SIN allocations: reutilizamos un vector y comprobamos
  // directamente contra cada AABB expandiéndolo in-place con un margen.
  //
  // SPATIAL HASH: en lugar de iterar los 100+ colliders lineales (O(n) por
  // llamada, ~5000 checks/frame en oleada 10), usamos un SpatialGrid que
  // solo revisa las celdas que toca el query (O(k), k≈1-3). Se construye
  // una sola vez tras añadir todos los colliders.
  // ---------------------------------------------------------------------
  const _p = new THREE.Vector3()
  const _center = new THREE.Vector3()
  const _size = new THREE.Vector3()
  const grid = new SpatialGrid(4)
  for (const c of colliders) grid.insert(c.box, c.type)

  function collidesAt(x, z, radius = 0.4) {
    _p.set(x, 1, z)
    // Colliders AABB via spatial hash. Usamos forEachCandidate para no
    // allocar un array de resultados por llamada (antes grid.query()
    // creaba un array nuevo en cada collidesAt, varios por frame).
    let hit = false
    grid.forEachCandidate(x, z, radius, (c) => {
      if (hit) return
      c.box.getCenter(_center)
      c.box.getSize(_size)
      // Expandimos el margen in-place (sin clone).
      const hx = _size.x * 0.5 + radius
      const hy = _size.y * 0.5 + radius
      const hz = _size.z * 0.5 + radius
      const dx = Math.abs(_p.x - _center.x)
      const dy = Math.abs(_p.y - _center.y)
      const dz = Math.abs(_p.z - _center.z)
      if (dx <= hx && dy <= hy && dz <= hz) hit = true
    })
    if (hit) return true
    // Colliders circulares (plaza de toros): pocos, lineal es fine.
    for (const c of circleColliders) {
      const dx = x - c.cx
      const dz = z - c.cz
      const dist = Math.hypot(dx, dz)
      if (dist < c.rOuter + radius && dist > c.rInner - radius) return true
    }
    return false
  }

  // Actualiza las farolas: activa las 4 más cercanas al jugador.
  // Pre-asignamos los slots {ll, d} una sola vez para evitar allocar 12
  // objetos por frame (antes _tmpLights.push({ll, d:...}) cada llamada).
  const NEAREST_LAMPS = 4
  const _tmpLights = lampLights.map((ll) => ({ ll, d: 0 }))
  function updateLamps(playerPos) {
    // Apagamos todas.
    for (const ll of lampLights) ll.light.intensity = 0
    // Actualizamos distancias in-place y ordenamos.
    for (const slot of _tmpLights) {
      const dx = slot.ll.x - playerPos.x
      const dz = slot.ll.z - playerPos.z
      slot.d = dx * dx + dz * dz
    }
    _tmpLights.sort((a, b) => a.d - b.d)
    for (let i = 0; i < Math.min(NEAREST_LAMPS, _tmpLights.length); i++) {
      _tmpLights[i].ll.light.intensity = 2.5
    }
  }

  // Itera colliders AABB cercanos a (x, z) sin allocar array.
  // Usado por el ragdoll para colisión partícula-vs-mundo.
  function forEachCollider(x, z, radius, fn) {
    grid.forEachCandidate(x, z, radius, fn)
  }

  return {
    colliders,
    sunMesh,
    sun,
    SUN_DIR: SUN_DIR_NORMALIZED,
    collidesAt,
    forEachCollider,
    updateLamps,
    updateShadows,
    update(dt) {
      // Fase 1.7: anima el oleaje del agua de la fuente.
      if (waterMaterials.length > 0) {
        waterTime += dt
        for (const m of waterMaterials) {
          if (m.userData.time) m.userData.time.value = waterTime
        }
      }
    },
    dispose
  }

  // Dispose de todos los materiales/geometrías/texturas del mundo.
  // Antes el world no se liberaba, causando un leak al recrear el engine.
  // Hacemos traversing del scene: player/enemies/particles ya se habrán
  // disposed y quitado antes (engine.dispose los llama antes que world),
  // así que solo quedan objetos del mundo + cámara (que no tiene geo/mat).
  function dispose() {
    const disposedMats = new Set()
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (m && !disposedMats.has(m)) {
            m.dispose()
            disposedMats.add(m)
          }
        }
      }
    })
    // Texturas Pamplona (no están en el traverse como objetos, hay que liberarlas a mano).
    if (tex) { tex.map.dispose(); tex.normalMap.dispose(); tex.roughnessMap.dispose() }
    if (sillarTex) { sillarTex.map.dispose(); sillarTex.normalMap.dispose(); sillarTex.roughnessMap.dispose() }
    if (roofTex) roofTex.dispose()
    if (woodTex) woodTex.dispose()
    if (crateTex) { crateTex.map.dispose(); crateTex.normalMap.dispose() }
    if (barrelTex) barrelTex.dispose()
  }
}
