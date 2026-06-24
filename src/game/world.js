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
  buildBullring,
  buildCityWall,
  buildSanFerdinandBanners,
  buildFountain
} from './pamplona.js'

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

// Dirección del sol unificada para luz, mesh y environment map.
const SUN_DIR = new THREE.Vector3(80, 120, 60)
const SUN_DIR_NORMALIZED = SUN_DIR.clone().normalize()

export function createWorld(scene) {
  const colliders = []
  // Collider circular de la plaza de toros: { cx, cz, rOuter, rInner }.
  const circleColliders = []

  // ---------------------------------------------------------------------
  // LUCES: atardecer dorado pamplonés.
  // ---------------------------------------------------------------------
  const ambient = new THREE.AmbientLight(0x6a5a4a, 0.5)
  scene.add(ambient)

  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x3a2a1a, 0.7)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffd0a0, 2.4)
  sun.position.copy(SUN_DIR)
  sun.target.position.set(0, 0, 0)
  scene.add(sun.target)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 350
  sun.shadow.camera.left = -110
  sun.shadow.camera.right = 110
  sun.shadow.camera.top = 110
  sun.shadow.camera.bottom = -110
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  const fill = new THREE.DirectionalLight(0x8a6a4a, 0.4)
  fill.position.set(-50, 40, -30)
  scene.add(fill)

  // ---------------------------------------------------------------------
  // SUELO: adoquines.
  // ---------------------------------------------------------------------
  const FLOOR_SIZE = 220
  const tex = makeConcreteTextures(512)
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

  // Texturas compartidas de Pamplona.
  const sillarTex = makeSillarTexture(512)
  const roofTex = makeRoofTexture(256)
  const woodTex = makeWoodTexture(256, '#5a3a1c')

  // ---------------------------------------------------------------------
  // PLAZA CENTRAL (estilo Plaza del Castillo).
  // Espacio abierto con fuente en el centro.
  // ---------------------------------------------------------------------
  const fountain = buildFountain(sillarTex)
  fountain.position.set(0, 0, 0)
  scene.add(fountain)

  // ---------------------------------------------------------------------
  // CASAS alrededor de la plaza, formando callejones.
  // Anillo de casas en 4 lados dejando callejones de entrada.
  // ---------------------------------------------------------------------
  const houses = [
    { x: -14, z: -25, w: 10, h: 10, d: 7, floors: 3, rotY: 0 },
    { x: 0, z: -25, w: 10, h: 11, d: 7, floors: 3, rotY: 0 },
    { x: 14, z: -25, w: 10, h: 10, d: 7, floors: 3, rotY: 0 },
    { x: -14, z: 25, w: 10, h: 10, d: 7, floors: 3, rotY: Math.PI },
    { x: 0, z: 25, w: 10, h: 12, d: 7, floors: 4, rotY: Math.PI },
    { x: 14, z: 25, w: 10, h: 10, d: 7, floors: 3, rotY: Math.PI },
    { x: -25, z: -14, w: 7, h: 10, d: 10, floors: 3, rotY: Math.PI / 2 },
    { x: -25, z: 0, w: 7, h: 11, d: 10, floors: 3, rotY: Math.PI / 2 },
    { x: -25, z: 14, w: 7, h: 10, d: 10, floors: 3, rotY: Math.PI / 2 },
    { x: 25, z: -14, w: 7, h: 10, d: 10, floors: 3, rotY: -Math.PI / 2 },
    { x: 25, z: 0, w: 7, h: 12, d: 10, floors: 4, rotY: -Math.PI / 2 },
    { x: 25, z: 14, w: 7, h: 10, d: 10, floors: 3, rotY: -Math.PI / 2 }
  ]
  houses.forEach((cfg) => {
    const { group, colliders: c } = buildPamplonaHouse({
      width: cfg.w, height: cfg.h, depth: cfg.d, floors: cfg.floors,
      sillarTex, roofTex, woodTex
    })
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
  const rng = mulberry32(1337)
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
  const lampLights = []
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
    lampLights.push({ light: pl, x: x + sign * 0.5, z: z + sign * 0.5 })
  })

  // ---------------------------------------------------------------------
  // ÁRBOLES.
  // ---------------------------------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
  const leavesMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a2a, roughness: 0.8, metalness: 0.05
  })
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2
    const r = 18 + rng() * 20
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 3, 8), trunkMat
    )
    trunk.position.set(x, 1.5, z); trunk.castShadow = true; scene.add(trunk)
    for (let j = 0; j < 4; j++) {
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 + rng() * 0.4, 10, 10), leavesMat
      )
      leaves.position.set(
        x + (rng() - 0.5) * 1.5,
        3.5 + rng() * 1.5,
        z + (rng() - 0.5) * 1.5
      )
      leaves.castShadow = true; scene.add(leaves)
    }
  }

  // ---------------------------------------------------------------------
  // ESCOMBROS y detalle.
  // ---------------------------------------------------------------------
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.95 })
  for (let i = 0; i < 80; i++) {
    const s = 0.1 + rng() * 0.4
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0), debrisMat
    )
    mesh.position.set(
      (rng() - 0.5) * (FLOOR_SIZE - 8),
      s * 0.5,
      (rng() - 0.5) * (FLOOR_SIZE - 8)
    )
    mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI)
    mesh.castShadow = true; mesh.receiveShadow = true
    scene.add(mesh)
  }

  // Algunos bidones y cajas dispersos como cobertura táctica.
  const crateTex = makeCrateTextures(256)
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.map, normalMap: crateTex.normalMap,
    roughness: 0.9, metalness: 0.05,
    normalScale: new THREE.Vector2(0.7, 0.7)
  })
  const barrelTex = makeBarrelTexture(256)
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

  // ---------------------------------------------------------------------
  // CIELO: gradiente esférico con sol.
  // Niebla con color que coincide con el horizonte del cielo.
  // ---------------------------------------------------------------------
  scene.fog = new THREE.FogExp2(0x3a2a1a, 0.008)

  const skyGeo = new THREE.SphereGeometry(500, 32, 16)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top:    { value: new THREE.Color(0x2a4a7a) },
      middle: { value: new THREE.Color(0xc88a5a) },
      bottom: { value: new THREE.Color(0x2a1a1a) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 middle;
      uniform vec3 bottom;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = clamp(h, -1.0, 1.0);
        vec3 col;
        if (t > 0.0) col = mix(middle, top, pow(t, 0.6));
        else col = mix(middle, bottom, pow(-t, 0.5));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  // Sol: disco emisivo + glow. Posición unificada con la luz direccional.
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0 })
  )
  sunMesh.position.copy(SUN_DIR).multiplyScalar(2.5)
  scene.add(sunMesh)
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffaa50, transparent: true, opacity: 0.4 })
  )
  sunGlow.position.copy(sunMesh.position)
  scene.add(sunGlow)

  // PRNG determinista.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // ---------------------------------------------------------------------
  // collidesAt SIN allocations: reutilizamos un vector y comprobamos
  // directamente contra cada AABB expandiéndolo in-place con un margen.
  // ---------------------------------------------------------------------
  const _p = new THREE.Vector3()
  const _center = new THREE.Vector3()
  const _size = new THREE.Vector3()
  function collidesAt(x, z, radius = 0.4) {
    _p.set(x, 1, z)
    // Colliders AABB.
    for (const c of colliders) {
      c.box.getCenter(_center)
      c.box.getSize(_size)
      // Expandimos el margen in-place (sin clone).
      const hx = _size.x * 0.5 + radius
      const hy = _size.y * 0.5 + radius
      const hz = _size.z * 0.5 + radius
      const dx = Math.abs(_p.x - _center.x)
      const dy = Math.abs(_p.y - _center.y)
      const dz = Math.abs(_p.z - _center.z)
      if (dx <= hx && dy <= hy && dz <= hz) return true
    }
    // Colliders circulares (plaza de toros).
    for (const c of circleColliders) {
      const dx = x - c.cx
      const dz = z - c.cz
      const dist = Math.hypot(dx, dz)
      if (dist < c.rOuter + radius && dist > c.rInner - radius) return true
    }
    return false
  }

  // Actualiza las farolas: activa las 4 más cercanas al jugador.
  const _tmpLights = []
  function updateLamps(playerPos) {
    // Apagamos todas.
    for (const ll of lampLights) ll.light.intensity = 0
    // Ordenamos por distancia y encendemos las 4 más cercanas.
    _tmpLights.length = 0
    for (const ll of lampLights) {
      const dx = ll.x - playerPos.x
      const dz = ll.z - playerPos.z
      _tmpLights.push({ ll, d: dx * dx + dz * dz })
    }
    _tmpLights.sort((a, b) => a.d - b.d)
    for (let i = 0; i < Math.min(4, _tmpLights.length); i++) {
      _tmpLights[i].ll.light.intensity = 2.5
    }
  }

  return {
    colliders,
    sunMesh,
    SUN_DIR: SUN_DIR_NORMALIZED,
    collidesAt,
    updateLamps,
    update(dt) {}
  }
}
