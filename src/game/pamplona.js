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
      }
      // Sombras en las juntas.
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
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
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
    map: sillarTex.clone(),
    color: 0xd8c9a0,
    roughness: 0.92,
    metalness: 0.05
  })
  sillarMat.map.repeat.set(width / 3, height / 3)

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
    map: sillarTex.clone(),
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
    map: sillarTex.clone(),
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
    map: sillarTex.clone(), color: 0xc8b890, roughness: 0.92
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
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16),
    new THREE.MeshStandardMaterial({
      color: 0x4a90c0, metalness: 1.0, roughness: 0.05,
      transparent: true, opacity: 0.9,
      emissive: 0x2a6080, emissiveIntensity: 0.3,
      envMapIntensity: 3.0
    })
  )
  water.position.y = 2.65; group.add(water)

  // Pila inferior.
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2.2, 0.6, 24),
    stoneMat
  )
  basin.position.y = 0.3; basin.castShadow = true; basin.receiveShadow = true; group.add(basin)

  // Agua de la pila.
  const basinWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.85, 0.05, 24),
    new THREE.MeshStandardMaterial({
      color: 0x4a90c0, metalness: 1.0, roughness: 0.05,
      transparent: true, opacity: 0.9, envMapIntensity: 3.0
    })
  )
  basinWater.position.y = 0.55; group.add(basinWater)

  // Colliders: la pila es sólida (antes el jugador cruzaba la fuente).
  // Devolvemos un collider AABB aprox de la pila (suficiente para no
  // atravesarla; el cilindro exacto requeriría circleCollider).
  const colliders = [new THREE.Box3().setFromObject(basin)]
  return { group, colliders }
}
