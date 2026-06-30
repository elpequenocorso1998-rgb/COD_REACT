import * as THREE from 'three'
import { mulberry32 } from './math.js'
import { PRNG_SEEDS } from './constants.js'

/* =========================================================================
   Constructor de edificios de Pamplona.
   --------------------------------------------------------------------------
   Tipologías históricas pamplonesas:
   - Casas de sillar (piedra caliza crema, "sillar").
   - Balcones de hierro forjado.
   - Tejados de teja cerámica curva (terracota).
   - Cornisas y molduras.
   - Ventanas con contraventanas de madera.
   - Banderines rojos y blancos de San Fermín colgados entre edificios.
   - Plaza de Toros (circular con arcos).
   - Murallas (con almenas).
   ========================================================================= */

// --- Texturas procedurales ---

// Sillar: bloques de piedra caliza crema con juntas marcadas.
export function makeSillarTexture(size = 512) {
  const rng = mulberry32(PRNG_SEEDS.sillar)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')

  // Normal map canvas (RGB = surface relief).
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')
  nctx.fillStyle = 'rgb(128,128,255)' // flat normal (Z-up)
  nctx.fillRect(0, 0, size, size)

  // Roughness map canvas (grayscale = roughness variation).
  const rc = document.createElement('canvas')
  rc.width = rc.height = size
  const rctx = rc.getContext('2d')
  rctx.fillStyle = '#888888' // medium roughness
  rctx.fillRect(0, 0, size, size)

  // Base crema.
  ctx.fillStyle = '#d8c9a0'
  ctx.fillRect(0, 0, size, size)

  // Bloques de sillar (filas desplazadas).
  const rows = 8, cols = 4
  const bh = size / rows, bw = size / cols
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2)
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + offset
      // Variación de tono por bloque.
      const tone = 200 + Math.floor(rng() * 40)
      ctx.fillStyle = `rgb(${tone}, ${tone - 20}, ${tone - 70})`
      ctx.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2)
      // Punteado de textura de piedra.
      for (let i = 0; i < 30; i++) {
        const px = x + rng() * bw
        const py = r * bh + rng() * bh
        ctx.fillStyle = `rgba(120,100,70,${rng() * 0.2})`
        ctx.fillRect(px, py, 2, 2)
        // Normal map: small bumps.
        nctx.fillStyle = `rgb(${128 + Math.floor(rng() * 40 - 20)},${128 + Math.floor(rng() * 40 - 20)},255)`
        nctx.fillRect(px, py, 3, 3)
        // Roughness: variation.
        const rv = 100 + Math.floor(rng() * 80)
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`
        rctx.fillRect(px, py, 3, 3)
      }
      // Juntas: normal map oscuro (hacia abajo = groove).
      nctx.fillStyle = 'rgb(100,100,200)' // groove normal
      nctx.fillRect(x, r * bh, bw, 2)
      nctx.fillRect(x, r * bh, 2, bh)
      // Roughness en juntas: más rugoso.
      rctx.fillStyle = '#606060'
      rctx.fillRect(x, r * bh, bw, 2)
      rctx.fillRect(x, r * bh, 2, bh)
      // Sombras en las juntas (color map).
      ctx.strokeStyle = 'rgba(80,60,40,0.5)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 1, r * bh + 1, bw - 2, bh - 2)
    }
  }
  // Manchas de humedad.
  for (let i = 0; i < 15; i++) {
    const x = rng() * size, y = rng() * size, r = 10 + rng() * 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(80,60,40,0.3)')
    g.addColorStop(1, 'rgba(80,60,40,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    // Roughness: manchas = más rugoso.
    const rg = rctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, '#404040')
    rg.addColorStop(1, '#888888')
    rctx.fillStyle = rg
    rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  const normalTex = new THREE.CanvasTexture(nc)
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping
  const roughTex = new THREE.CanvasTexture(rc)
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping
  return { map: tex, normalMap: normalTex, roughnessMap: roughTex }
}

// Teja cerámica curva (terracota).
export function makeRoofTexture(size = 256) {
  const rng = mulberry32(PRNG_SEEDS.roof)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')

  ctx.fillStyle = '#8a3a20'
  ctx.fillRect(0, 0, size, size)

  // Filas de tejas.
  const rows = 10
  const rh = size / rows
  for (let r = 0; r < rows; r++) {
    const y = r * rh
    // Degradado para simular curvatura de la teja.
    const g = ctx.createLinearGradient(0, y, 0, y + rh)
    g.addColorStop(0, '#6a2a18')
    g.addColorStop(0.5, '#a04525')
    g.addColorStop(1, '#6a2a18')
    ctx.fillStyle = g
    ctx.fillRect(0, y, size, rh)
    // Líneas entre tejas.
    ctx.strokeStyle = 'rgba(40,15,5,0.7)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * size
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rh); ctx.stroke()
    }
  }
  // Musgo y desgaste.
  for (let i = 0; i < 20; i++) {
    const x = rng() * size, y = rng() * size, r = 4 + rng() * 12
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(60,80,40,0.4)')
    g.addColorStop(1, 'rgba(60,80,40,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Madera para contraventanas y puertas.
export function makeWoodTexture(size = 256, baseColor = '#5a3a1c') {
  const rng = mulberry32(PRNG_SEEDS.wood)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)
  // Vetetas.
  for (let i = 0; i < 30; i++) {
    const y = rng() * size
    ctx.strokeStyle = `rgba(${30 + rng() * 30},${20 + rng() * 20},${5 + rng() * 10},${0.5 + rng() * 0.4})`
    ctx.lineWidth = 1 + rng() * 2
    ctx.beginPath(); ctx.moveTo(0, y)
    for (let x = 0; x < size; x += 6) ctx.lineTo(x, y + (rng() - 0.5) * 3)
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

/* ---------------------------------------------------------------------------
   Construye una casa pamplonesa típica (sillar + balcones + teja).
   Devuelve { group, box } para colisiones.
   --------------------------------------------------------------------------- */
export function buildPamplonaHouse({
  width = 8, height = 9, depth = 7, floors = 3,
  sillarTex, roofTex, woodTex
}) {
  const group = new THREE.Group()
  const colliders = []

  // --- Cuerpo principal (sillar) ---
  const sillarMat = new THREE.MeshStandardMaterial({
    map: sillarTex.map.clone(),
    normalMap: sillarTex.normalMap.clone(),
    roughnessMap: sillarTex.roughnessMap.clone(),
    color: 0xd8c9a0,
    roughness: 0.92,
    metalness: 0.05,
    normalScale: new THREE.Vector2(0.8, 0.8)
  })
  sillarMat.map.repeat.set(width / 3, height / 3)
  sillarMat.normalMap.repeat.set(width / 3, height / 3)
  sillarMat.roughnessMap.repeat.set(width / 3, height / 3)

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    sillarMat
  )
  body.position.y = height / 2
  body.castShadow = true; body.receiveShadow = true
  group.add(body)
  colliders.push(new THREE.Box3().setFromObject(body))

  // --- Cornisa superior (moldura) ---
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3),
    sillarMat
  )
  cornice.position.y = height + 0.15
  cornice.castShadow = true; group.add(cornice)

  // --- Tejado a dos aguas (teja cerámica) ---
  const roofMat = new THREE.MeshStandardMaterial({
    map: roofTex.clone(),
    color: 0x8a3a20,
    roughness: 0.85,
    metalness: 0.1,
    // DoubleSide: el tejado tiene caras con winding inconsistente; sin
    // esto, partes del tejado se verían invisibles desde ciertos ángulos.
    side: THREE.DoubleSide
  })
  roofMat.map.repeat.set(width / 2, depth / 2)
  // Prisma triangular para el tejado.
  const roofH = 1.8
  const roofGeo = new THREE.BufferGeometry()
  const w = width / 2 + 0.2, d = depth / 2 + 0.2, h = roofH
  // Vértices del prisma triangular (a lo largo del eje Z).
  const vertices = new Float32Array([
    -w, 0, -d,  w, 0, -d,  w, 0, d,  -w, 0, d,   // base
     0, h, -d,   0, h, d                       // cumbrera
  ])
  const indices = [
    // Frontal (z = -d)
    0, 1, 4,
    // Trasera (z = d)
    3, 5, 2,
    // Lado izquierdo
    0, 4, 3,
    3, 4, 5,
    // Lado derecho
    1, 2, 5,
    1, 5, 4
  ]
  roofGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  roofGeo.setIndex(indices)
  roofGeo.computeVertexNormals()
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = height + 0.3
  roof.castShadow = true; roof.receiveShadow = true
  group.add(roof)
  // Collider del tejado: las balas y el jugador no deben atravesarlo
  // (antes solo el cuerpo de la casa era collider).
  colliders.push(new THREE.Box3().setFromObject(roof))
  // Cornisa también sólida para que las balas no la atraviesen.
  colliders.push(new THREE.Box3().setFromObject(cornice))

  // --- Ventanas y balcones por planta ---
  const balconyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.85, roughness: 0.4, envMapIntensity: 1.5
  })
  const shutterMat = new THREE.MeshStandardMaterial({
    map: woodTex, color: 0x6a3a20, roughness: 0.8, metalness: 0.1
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x223344, emissive: 0x0a1525, emissiveIntensity: 0.3,
    metalness: 0.9, roughness: 0.1, envMapIntensity: 2.5
  })

  const floorH = height / floors
  for (let f = 0; f < floors; f++) {
    const y = (f + 1) * floorH - floorH / 2 + 0.3
    // 2-3 ventanas por planta en la fachada frontal.
    const numWindows = width < 6 ? 2 : 3
    for (let i = 0; i < numWindows; i++) {
      const x = -width / 2 + (width / (numWindows + 1)) * (i + 1)
      // Hueco de ventana (marco).
      const winW = 1.1, winH = 1.4
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(winW, winH, 0.15),
        glassMat
      )
      win.position.set(x, y, depth / 2 + 0.05)
      group.add(win)
      // Contraventanas de madera a los lados.
      const shutterL = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, winH, 0.05), shutterMat
      )
      shutterL.position.set(x - winW / 2 - 0.25, y, depth / 2 + 0.08)
      shutterL.rotation.y = 0.2
      group.add(shutterL)
      const shutterR = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, winH, 0.05), shutterMat
      )
      shutterR.position.set(x + winW / 2 + 0.25, y, depth / 2 + 0.08)
      shutterR.rotation.y = -0.2
      group.add(shutterR)

      // Balcón en la planta baja y primera, barandilla de hierro.
      if (f >= 1) {
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(winW + 0.6, 0.05, 0.4),
          balconyMat
        )
        balcony.position.set(x, y - winH / 2 - 0.05, depth / 2 + 0.2)
        group.add(balcony)
        // Barandilla: varios barrotes verticales.
        const railH = 0.7
        const railTop = new THREE.Mesh(
          new THREE.BoxGeometry(winW + 0.6, 0.04, 0.04), balconyMat
        )
        railTop.position.set(x, y - winH / 2 - 0.05 + railH, depth / 2 + 0.38)
        group.add(railTop)
        const nBars = 5
        for (let b = 0; b <= nBars; b++) {
          const bx = x - (winW + 0.6) / 2 + (winW + 0.6) * b / nBars
          const bar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, railH, 6), balconyMat
          )
          bar.position.set(bx, y - winH / 2 - 0.05 + railH / 2, depth / 2 + 0.38)
          group.add(bar)
        }
      }
    }
  }

  // --- Puerta de madera en la planta baja ---
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.4, 0.1),
    shutterMat
  )
  door.position.set(0, 1.2, depth / 2 + 0.06)
  group.add(door)
  // Dintel.
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.3, 0.15), sillarMat
  )
  lintel.position.set(0, 2.6, depth / 2 + 0.07)
  group.add(lintel)

  return { group, colliders }
}

/* ---------------------------------------------------------------------------
   Plaza de Toros de Pamplona: estructura circular con arcos.
   --------------------------------------------------------------------------- */
export function buildBullring(sillarTex, roofTex) {
  const group = new THREE.Group()
  const radius = 28
  const wallH = 8

  // Muro circular exterior.
  const wallMat = new THREE.MeshStandardMaterial({
    map: sillarTex.map.clone(),
    normalMap: sillarTex.normalMap.clone(),
    roughnessMap: sillarTex.roughnessMap.clone(),
    color: 0xc8b890, roughness: 0.92, metalness: 0.05
  })
  wallMat.map.repeat.set(20, 3)

  // Usamos un cilindro vacío para el muro.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, wallH, 64, 1, true),
    wallMat
  )
  wall.position.y = wallH / 2
  wall.castShadow = true; wall.receiveShadow = true
  group.add(wall)

  // Arcos: pequeños rectángulos emisivos alrededor del muro.
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a, roughness: 0.9
  })
  const numArches = 32
  for (let i = 0; i < numArches; i++) {
    const a = (i / numArches) * Math.PI * 2
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 0.4),
      archMat
    )
    arch.position.set(Math.cos(a) * (radius + 0.1), 2.5, Math.sin(a) * (radius + 0.1))
    arch.rotation.y = -a + Math.PI / 2
    group.add(arch)
  }

  // Bajo cubierta: anillo de teja en la parte superior.
  const roofMat = new THREE.MeshStandardMaterial({
    map: roofTex.clone(), color: 0x8a3a20, roughness: 0.85
  })
  roofMat.map.repeat.set(20, 2)
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 1, radius, 1.2, 64, 1, true),
    roofMat
  )
  roof.position.y = wallH + 0.6
  group.add(roof)

  // Cáscara exterior (backside) para que se vea desde fuera.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 1.2, radius + 1.2, wallH + 1, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8a3a20, side: THREE.BackSide, roughness: 0.9 })
  )
  shell.position.y = (wallH + 1) / 2
  group.add(shell)

  // Sin colliders AABB: la plaza de toros es circular y world.js la modela
  // con un circleCollider (más preciso que un AABB). Antes se calculaba un
  // colBox aprox que world.js ignoraba (código muerto).
  return { group, colliders: [] }
}

/* ---------------------------------------------------------------------------
   Muralla (con almenas).
   --------------------------------------------------------------------------- */
export function buildCityWall({ length, height = 6, sillarTex }) {
  const group = new THREE.Group()
  const colliders = []

  const wallMat = new THREE.MeshStandardMaterial({
    map: sillarTex.map.clone(),
    normalMap: sillarTex.normalMap.clone(),
    roughnessMap: sillarTex.roughnessMap.clone(),
    color: 0xc8b890, roughness: 0.95, metalness: 0.05
  })
  wallMat.map.repeat.set(length / 3, height / 3)

  // Cuerpo principal.
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, 1.2),
    wallMat
  )
  wall.position.y = height / 2
  wall.castShadow = true; wall.receiveShadow = true
  group.add(wall)
  colliders.push(new THREE.Box3().setFromObject(wall))

  // Almenas: pequeños bloques en la parte superior.
  const merlonMat = wallMat
  const merlonCount = Math.floor(length / 1.5)
  for (let i = 0; i < merlonCount; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 1.2),
      merlonMat
    )
    m.position.set(-length / 2 + 0.75 + i * 1.5, height + 0.35, 0)
    m.castShadow = true
    group.add(m)
  }

  return { group, colliders }
}

/* ---------------------------------------------------------------------------
   Cadena de banderines rojos y blancos de San Fermín entre dos puntos.
   --------------------------------------------------------------------------- */
export function buildSanFerdinandBanners(start, end, height = 6) {
  const group = new THREE.Group()
  const startV = new THREE.Vector3(...start)
  const endV = new THREE.Vector3(...end)
  const dir = endV.clone().sub(startV)
  const length = dir.length()
  const segments = Math.floor(length / 1.5)
  // Guard: si el tramo es más corto que 1.5, segments=0 produce 0/0=NaN
  // en el cálculo de t. Sin banderines en tramos cortos.
  if (segments < 1) return group

  // Cuerda superior.
  const ropeGeo = new THREE.BufferGeometry()
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = startV.x + dir.x * t
    const z = startV.z + dir.z * t
    // Catenaria ligera.
    const sag = Math.sin(t * Math.PI) * 0.3
    const y = height - sag
    points.push(new THREE.Vector3(x - startV.x, y, z - startV.z))
  }
  ropeGeo.setFromPoints(points)
  const rope = new THREE.Line(
    ropeGeo,
    new THREE.LineBasicMaterial({ color: 0x222222 })
  )
  group.add(rope)

  // Banderines triangulares alternando rojo y blanco.
  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments
    const x = startV.x + dir.x * t - startV.x
    const z = startV.z + dir.z * t - startV.z
    const sag = Math.sin(t * Math.PI) * 0.3
    const y = height - sag
    const color = i % 2 === 0 ? 0xff2222 : 0xffffff
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.5, 4),
      new THREE.MeshStandardMaterial({
        color, side: THREE.DoubleSide,
        roughness: 0.7, metalness: 0.0,
        emissive: color, emissiveIntensity: 0.15
      })
    )
    flag.position.set(x, y - 0.25, z)
    flag.rotation.x = Math.PI
    flag.castShadow = true
    group.add(flag)
  }

  group.position.copy(startV)
  return group
}

/* ---------------------------------------------------------------------------
   Fuente de piedra (estilo Plaza del Castillo).
   --------------------------------------------------------------------------- */
export function buildFountain(sillarTex) {
  const group = new THREE.Group()

  const stoneMat = new THREE.MeshStandardMaterial({
    map: sillarTex.map.clone(),
    normalMap: sillarTex.normalMap.clone(),
    roughnessMap: sillarTex.roughnessMap.clone(), color: 0xc8b890, roughness: 0.92
  })
  stoneMat.map.repeat.set(2, 1)

  // Pilar central.
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 2.5, 16),
    stoneMat
  )
  pillar.position.y = 1.25; pillar.castShadow = true; group.add(pillar)

  // Taza superior (donde sale el agua).
  const topBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.5, 0.2, 16),
    stoneMat
  )
  topBowl.position.y = 2.6; group.add(topBowl)

  // Agua en la taza superior (realmente reflectante gracias al envMap).
  // Fase 1.7: oleaje animado via onBeforeCompile (sin perder PBR/envMap).
  const waterMatTop = makeWaterMaterial()
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24),
    waterMatTop
  )
  water.position.y = 2.65; group.add(water)

  // Pila inferior.
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2.2, 0.6, 24),
    stoneMat
  )
  basin.position.y = 0.3; basin.castShadow = true; basin.receiveShadow = true; group.add(basin)

  // Agua de la pila.
  // Fase 1.7: oleaje animado.
  const basinWaterMat = makeWaterMaterial()
  const basinWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.85, 0.05, 32),
    basinWaterMat
  )
  basinWater.position.y = 0.55; group.add(basinWater)

  // Colliders: la pila es sólida (antes el jugador cruzaba la fuente).
  // Devolvemos un collider AABB aprox de la pila (suficiente para no
  // atravesarla; el cilindro exacto requeriría circleCollider).
  const colliders = [new THREE.Box3().setFromObject(basin)]
  // Fase 1.7: materiales de agua para animar su oleaje cada frame.
  const waterMaterials = [waterMatTop, basinWaterMat]
  return { group, colliders, waterMaterials }
}

/* ---------------------------------------------------------------------------
   Material de agua con oleaje animado (Fase 1.7).
   --------------------------------------------------------------------------
   Usa MeshStandardMaterial (preserva PBR + envMap reflections) pero
   inyecta un uniform de tiempo en el vertex shader para desplazar la
   superficie con ondas senos. El caller debe actualizar material.userData.time
   cada frame (lo hace world.update).
   --------------------------------------------------------------------------- */
function makeWaterMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a90c0, metalness: 1.0, roughness: 0.05,
    transparent: true, opacity: 0.85,
    emissive: 0x2a6080, emissiveIntensity: 0.3,
    envMapIntensity: 3.0
  })
  mat.userData.time = { value: 0 }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.time
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `
        uniform float uTime;
        varying float vWave;
        void main() {
          vWave = sin(position.x * 8.0 + uTime * 2.0) * 0.5
                + cos(position.z * 6.0 + uTime * 1.5) * 0.5;
      `)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed.y += vWave * 0.02;
      `)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `
        varying float vWave;
        void main() {
      `)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse + vec3(0.0, 0.05, 0.1) * vWave, opacity );')
  }
  return mat
}

/* ---------------------------------------------------------------------------
   Casa pamplonesa con INTERIOR transitable (Fase 1.6).
   --------------------------------------------------------------------------
   A diferencia de buildPamplonaHouse (sólida), esta construye 4 muros con
   puerta de entrada + ventanas, dejando el interior vacío para que el
   jugador pueda entrar y disparar desde las ventanas. Incluye:
   - Piso interior.
   - Escalera a planta superior con barandilla.
   - Azotea abierta para combate vertical (snipers).
   - Tejado solo encima de la planta baja; la azotea queda abierta.

   Solo los muros exteriores (con puerta) son colliders. El interior es
   totalmente transitable.
   --------------------------------------------------------------------------- */
export function buildPamplonaHouseInterior({
  width = 8, height = 9, depth = 7,
  sillarTex, woodTex
}) {
  const group = new THREE.Group()
  const colliders = []

  const wallMat = new THREE.MeshStandardMaterial({
    map: sillarTex.map.clone(),
    normalMap: sillarTex.normalMap.clone(),
    roughnessMap: sillarTex.roughnessMap.clone(),
    color: 0xd8c9a0, roughness: 0.92, metalness: 0.05
  })
  wallMat.map.repeat.set(width / 3, height / 3)

  const floorMat = new THREE.MeshStandardMaterial({
    map: woodTex.clone(),
    color: 0x4a3018, roughness: 0.85, metalness: 0.05
  })
  floorMat.map.repeat.set(width / 2, depth / 2)

  const wallThickness = 0.3
  const w = width / 2
  const d = depth / 2

  // --- Piso interior (planta baja) ---
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width - wallThickness * 2, 0.1, depth - wallThickness * 2),
    floorMat
  )
  floor.position.y = 0.05
  floor.receiveShadow = true
  group.add(floor)

  // --- Muro frontal con puerta ---
  // La puerta es un hueco de 1.4m de ancho × 2.4m de alto.
  const doorW = 1.4, doorH = 2.4
  const sideW = (width - doorW) / 2
  // Lado izquierdo de la puerta.
  const wallFrontL = new THREE.Mesh(
    new THREE.BoxGeometry(sideW, height, wallThickness),
    wallMat
  )
  wallFrontL.position.set(-(doorW / 2 + sideW / 2), height / 2, d)
  wallFrontL.castShadow = true; wallFrontL.receiveShadow = true
  group.add(wallFrontL)
  colliders.push(new THREE.Box3().setFromObject(wallFrontL))
  // Lado derecho de la puerta.
  const wallFrontR = new THREE.Mesh(
    new THREE.BoxGeometry(sideW, height, wallThickness),
    wallMat
  )
  wallFrontR.position.set(doorW / 2 + sideW / 2, height / 2, d)
  wallFrontR.castShadow = true; wallFrontR.receiveShadow = true
  group.add(wallFrontR)
  colliders.push(new THREE.Box3().setFromObject(wallFrontR))
  // Dintel sobre la puerta.
  const lintelH = height - doorH
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, lintelH, wallThickness),
    wallMat
  )
  lintel.position.set(0, doorH + lintelH / 2, d)
  lintel.castShadow = true
  group.add(lintel)
  colliders.push(new THREE.Box3().setFromObject(lintel))

  // --- Muro trasero (con ventana) ---
  const wallBack = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wallThickness),
    wallMat
  )
  wallBack.position.set(0, height / 2, -d)
  wallBack.castShadow = true; wallBack.receiveShadow = true
  group.add(wallBack)
  colliders.push(new THREE.Box3().setFromObject(wallBack))

  // --- Muros laterales (con ventanas) ---
  // Para simplicidad, los muros laterales son sólidos (sin ventanas).
  const wallL = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, height, depth),
    wallMat
  )
  wallL.position.set(-w, height / 2, 0)
  wallL.castShadow = true; wallL.receiveShadow = true
  group.add(wallL)
  colliders.push(new THREE.Box3().setFromObject(wallL))

  const wallR = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, height, depth),
    wallMat
  )
  wallR.position.set(w, height / 2, 0)
  wallR.castShadow = true; wallR.receiveShadow = true
  group.add(wallR)
  colliders.push(new THREE.Box3().setFromObject(wallR))

  // --- Ventanas en muro frontal (junto a la puerta) ---
  // Huecos cuadrados con marco de madera (no son colliders).
  const shutterMat = new THREE.MeshStandardMaterial({
    map: woodTex, color: 0x6a3a20, roughness: 0.8, metalness: 0.1
  })
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.2, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x223344, emissive: 0x0a1525, emissiveIntensity: 0.3,
        metalness: 0.9, roughness: 0.1, envMapIntensity: 2.5
      })
    )
    win.position.set(side * (doorW / 2 + sideW / 2), 1.5, d + 0.05)
    group.add(win)
    // Contraventanas.
    const shutter = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.2, 0.05), shutterMat
    )
    shutter.position.set(side * (doorW / 2 + sideW / 2) - 0.3, 1.5, d + 0.08)
    shutter.rotation.y = 0.2
    group.add(shutter)
  }

  // --- Piso de planta superior (azotea) ---
  const upperFloorH = height * 0.55
  const upperFloor = new THREE.Mesh(
    new THREE.BoxGeometry(width - wallThickness * 2, 0.1, depth - wallThickness * 2),
    floorMat
  )
  upperFloor.position.y = upperFloorH
  upperFloor.receiveShadow = true
  group.add(upperFloor)

  // --- Escalera interior a la azotea ---
  // Rampa inclinada desde el piso hasta upperFloorH.
  const stairLen = upperFloorH * 1.8
  const stair = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.1, stairLen),
    floorMat
  )
  stair.position.set(0, upperFloorH / 2, -d / 2 + stairLen / 2 + 0.2)
  stair.rotation.x = -Math.atan2(upperFloorH, stairLen)
  stair.receiveShadow = true
  group.add(stair)

  // --- Barandilla de la azotea (para no caerse) ---
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.85, roughness: 0.4, envMapIntensity: 1.5
  })
  const railH = 1.0
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, railH, depth - wallThickness * 2),
      railMat
    )
    rail.position.set(side * (w - 0.1), upperFloorH + railH / 2, 0)
    group.add(rail)
  }
  // Barandilla frontal (con hueco para la escalera).
  const railFrontL = new THREE.Mesh(
    new THREE.BoxGeometry(width / 2 - 0.7, railH, 0.05), railMat
  )
  railFrontL.position.set(-(width / 4 + 0.35), upperFloorH + railH / 2, d - 0.1)
  group.add(railFrontL)
  const railFrontR = new THREE.Mesh(
    new THREE.BoxGeometry(width / 2 - 0.7, railH, 0.05), railMat
  )
  railFrontR.position.set(width / 4 + 0.35, upperFloorH + railH / 2, d - 0.1)
  group.add(railFrontR)

  // --- Cornisa superior ---
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3),
    wallMat
  )
  cornice.position.y = height + 0.15
  cornice.castShadow = true
  group.add(cornice)

  return { group, colliders }
}
