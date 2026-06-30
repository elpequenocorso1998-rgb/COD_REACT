import * as THREE from 'three'
import { makeGunMetalTexture } from './textures.js'
import { WEAPONS } from './config.js'

/* =========================================================================
   Viewmodels en primera persona — UNO por arma.
   --------------------------------------------------------------------------
   Antes player.js construía un único rifle M4 que se mostraba para TODAS
   las armas (pistol, sniper, shotgun...). Inaceptable para CoD-grade.
   Cada función buildXxx() devuelve:
     { viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
       hipX, hipY, adsX, adsY, dispose() }
   - viewmodel: THREE.Group raíz (se añade a la cámara).
   - rifleGroup: subgrupo que recibe el retroceso.
   - muzzleLight / muzzleSprite: flash de boca.
   - sightDot: punto de mira para alinear ADS (opcional).
   - hip/ads: offsets X/Y de la pose hipfire y ADS.
   - dispose(): libera todos los recursos Three.js del viewmodel.
   ========================================================================= */

let _sharedGunTex = null
let _sharedMuzzleTex = null

function getGunTex() {
  if (!_sharedGunTex) _sharedGunTex = makeGunMetalTexture(256)
  return _sharedGunTex
}

function getMuzzleTex() {
  if (!_sharedMuzzleTex) _sharedMuzzleTex = makeMuzzleTexture()
  return _sharedMuzzleTex
}

// Textura del muzzle flash (compartida por todos los viewmodels).
function makeMuzzleTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60)
  grad.addColorStop(0, 'rgba(255,255,220,1)')
  grad.addColorStop(0.25, 'rgba(255,200,80,0.95)')
  grad.addColorStop(0.6, 'rgba(255,120,30,0.5)')
  grad.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(255,220,150,0.9)'; ctx.lineWidth = 3
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3
    const len = 30 + Math.random() * 30
    ctx.beginPath(); ctx.moveTo(64, 64)
    ctx.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len); ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

// Helper: añade muzzle light + sprite a un rifleGroup en una posición dada.
function addMuzzle(rifleGroup, x, y, z) {
  const muzzleLight = new THREE.PointLight(0xffaa44, 0, 10, 2)
  muzzleLight.position.set(x, y, z)
  rifleGroup.add(muzzleLight)
  const muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getMuzzleTex(), transparent: true, opacity: 0,
    depthTest: false, blending: THREE.AdditiveBlending
  }))
  muzzleSprite.scale.set(0.5, 0.5, 0.5)
  muzzleSprite.position.set(x, y, z)
  rifleGroup.add(muzzleSprite)
  return { muzzleLight, muzzleSprite }
}

/* =========================================================================
   M4 Carbine — rifle de asalto táctico con rail y sight dot.
   ========================================================================= */
function buildM4() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x2a2e30, metalness: 0.95, roughness: 0.28,
    envMapIntensity: 1.5
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x141619, metalness: 0.95, roughness: 0.35, envMapIntensity: 1.2
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1f, metalness: 0.4, roughness: 0.6, envMapIntensity: 0.8
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.13, 0.7)), metalMat)
  body.position.set(0, 0, -0.45); rifleGroup.add(body)

  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.025, 0.5, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.85); rifleGroup.add(barrel)

  const muzzleTip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12)), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2; muzzleTip.position.set(0, 0.02, -1.12); rifleGroup.add(muzzleTip)

  const mag = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.22, 0.12)), polymerMat)
  mag.position.set(0, -0.14, -0.35); mag.rotation.x = 0.2; rifleGroup.add(mag)

  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.18, 0.09)), polymerMat)
  grip.position.set(0, -0.12, -0.18); grip.rotation.x = -0.3; rifleGroup.add(grip)

  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.04, -0.22); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  const stock = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.11, 0.28)), polymerMat)
  stock.position.set(0, 0, -0.05); rifleGroup.add(stock)
  const stockTube = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8)), darkMetalMat)
  stockTube.rotation.x = Math.PI / 2; stockTube.position.set(0, 0.02, 0.12); rifleGroup.add(stockTube)

  const rail = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.02, 0.5)), darkMetalMat)
  rail.position.set(0, 0.08, -0.45); rifleGroup.add(rail)

  const sightFrame = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.06, 0.02)), darkMetalMat)
  sightFrame.position.set(0, 0.11, -0.45); rifleGroup.add(sightFrame)
  const sightDot = new THREE.Mesh(track(new THREE.SphereGeometry(0.008, 8, 8)), new THREE.MeshBasicMaterial({ color: 0xff2020 }))
  sightDot.position.set(0, 0.11, -0.46); rifleGroup.add(sightDot)

  const handguard = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.07, 0.3)), polymerMat)
  handguard.position.set(0, 0.02, -0.6); rifleGroup.add(handguard)

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.02, -1.2)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    muzzleSprite.material.dispose()
    sightDot.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.2, hipY: -0.18, adsX: 0, adsY: -0.12, dispose
  }
}

/* =========================================================================
   AK-47 — rifle con cañón inclinado, mag curvo, madera.
   ========================================================================= */
function buildAK47() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x1f1f1f, metalness: 0.9, roughness: 0.4,
    envMapIntensity: 1.3
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e0e, metalness: 0.9, roughness: 0.45, envMapIntensity: 1.0
  })
  // Madera característica del AK (furniture).
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6a3a1a, metalness: 0.1, roughness: 0.7, envMapIntensity: 0.8
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.13, 0.6)), metalMat)
  body.position.set(0, 0, -0.4); rifleGroup.add(body)

  // Cañón inclinado ligeramente hacia abajo (rasgo del AK).
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.024, 0.45, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2 - 0.04; barrel.position.set(0, -0.01, -0.8); rifleGroup.add(barrel)

  const muzzleTip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 12)), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2 - 0.04; muzzleTip.position.set(0, -0.015, -1.05); rifleGroup.add(muzzleTip)

  // Cargador curvo característico (banana mag): dos cajas rotadas.
  const magLower = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.18, 0.12)), metalMat)
  magLower.position.set(0, -0.13, -0.32); magLower.rotation.x = 0.35; rifleGroup.add(magLower)

  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.17, 0.09)), polymerWood(woodMat))
  grip.position.set(0, -0.11, -0.16); grip.rotation.x = -0.35; rifleGroup.add(grip)

  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.03, -0.2); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Stock de madera.
  const stock = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.1, 0.3)), woodMat)
  stock.position.set(0, -0.02, 0.05); rifleGroup.add(stock)

  // Handguard de madera.
  const handguard = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.06, 0.28)), woodMat)
  handguard.position.set(0, 0.02, -0.55); rifleGroup.add(handguard)

  // Mira de hierro del AK (U-notch + post).
  const rearSight = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.025, 0.02)), darkMetalMat)
  rearSight.position.set(0, 0.08, -0.35); rifleGroup.add(rearSight)
  const frontSight = new THREE.Mesh(track(new THREE.BoxGeometry(0.012, 0.04, 0.012)), darkMetalMat)
  frontSight.position.set(0, 0.06, -0.9); rifleGroup.add(frontSight)

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, -0.02, -1.13)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); woodMat.dispose()
    muzzleSprite.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot: frontSight,
    hipX: 0.2, hipY: -0.18, adsX: 0, adsY: -0.10, dispose
  }
}

// Helper: el grip del AK usa madera pero clonada para no compartir disposal.
function polymerWood(woodMat) { return woodMat }

/* =========================================================================
   MP5 SMG — corto, stock retráctil, silenciador.
   ========================================================================= */
function buildMP5() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x1a1a1a, metalness: 0.92, roughness: 0.3,
    envMapIntensity: 1.4
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.92, roughness: 0.4, envMapIntensity: 1.0
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x141414, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.7
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  // Cuerpo compacto.
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.12, 0.45)), metalMat)
  body.position.set(0, 0, -0.3); rifleGroup.add(body)

  // Cañón corto + silenciador característico.
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.022, 0.25, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.55); rifleGroup.add(barrel)
  const suppressor = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 16)), darkMetalMat)
  suppressor.rotation.x = Math.PI / 2; suppressor.position.set(0, 0.02, -0.7); rifleGroup.add(suppressor)

  // Cargador curvo corto.
  const mag = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.16, 0.1)), polymerMat)
  mag.position.set(0, -0.11, -0.25); mag.rotation.x = 0.15; rifleGroup.add(mag)

  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.15, 0.08)), polymerMat)
  grip.position.set(0, -0.09, -0.12); grip.rotation.x = -0.3; rifleGroup.add(grip)

  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.03, -0.16); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Stock retráctil (dos varillas).
  const stockRod1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6)), darkMetalMat)
  stockRod1.rotation.x = Math.PI / 2; stockRod1.position.set(-0.03, 0.02, 0.1); rifleGroup.add(stockRod1)
  const stockRod2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6)), darkMetalMat)
  stockRod2.rotation.x = Math.PI / 2; stockRod2.position.set(0.03, 0.02, 0.1); rifleGroup.add(stockRod2)
  const stockButt = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.06, 0.02)), polymerMat)
  stockButt.position.set(0, 0.02, 0.22); rifleGroup.add(stockButt)

  // Handguard.
  const handguard = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.05, 0.18)), polymerMat)
  handguard.position.set(0, 0.02, -0.4); rifleGroup.add(handguard)

  // Mira frontal.
  const sightDot = new THREE.Mesh(track(new THREE.SphereGeometry(0.006, 8, 8)), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  sightDot.position.set(0, 0.07, -0.5); rifleGroup.add(sightDot)

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.02, -0.82)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    muzzleSprite.material.dispose()
    sightDot.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.18, hipY: -0.16, adsX: 0, adsY: -0.10, dispose
  }
}

/* =========================================================================
   Sniper Rifle — cañón largo + scope cilíndrico.
   ========================================================================= */
function buildSniper() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x2a2a2a, metalness: 0.85, roughness: 0.35,
    envMapIntensity: 1.4
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.0
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.7
  })
  // Glass para el scope.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x113355, metalness: 1.0, roughness: 0.05,
    transparent: true, opacity: 0.7, envMapIntensity: 3.0
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  // Cuerpo largo.
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.12, 0.9)), metalMat)
  body.position.set(0, 0, -0.55); rifleGroup.add(body)

  // Cañón muy largo.
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.025, 0.7, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -1.1); rifleGroup.add(barrel)

  const muzzleTip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12)), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2; muzzleTip.position.set(0, 0.02, -1.5); rifleGroup.add(muzzleTip)

  // Cargador interno corto (box mag pequeño).
  const mag = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.1, 0.08)), polymerMat)
  mag.position.set(0, -0.08, -0.5); rifleGroup.add(mag)

  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.18, 0.09)), polymerMat)
  grip.position.set(0, -0.12, -0.3); grip.rotation.x = -0.3; rifleGroup.add(grip)

  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.04, -0.34); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Stock con cheek rest.
  const stock = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.13, 0.35)), polymerMat)
  stock.position.set(0, 0, 0.05); rifleGroup.add(stock)
  const cheekRest = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.04, 0.2)), polymerMat)
  cheekRest.position.set(0, 0.06, 0.0); rifleGroup.add(cheekRest)

  // Scope: cilindro sobre el cuerpo.
  const scopeBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 16)), darkMetalMat)
  scopeBody.rotation.x = Math.PI / 2; scopeBody.position.set(0, 0.13, -0.5); rifleGroup.add(scopeBody)
  const scopeFront = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16)), darkMetalMat)
  scopeFront.rotation.x = Math.PI / 2; scopeFront.position.set(0, 0.13, -0.69); rifleGroup.add(scopeFront)
  const scopeLens = new THREE.Mesh(track(new THREE.CircleGeometry(0.04, 16)), glassMat)
  scopeLens.position.set(0, 0.13, -0.71); scopeLens.rotation.y = Math.PI; rifleGroup.add(scopeLens)
  const scopeRear = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16)), darkMetalMat)
  scopeRear.rotation.x = Math.PI / 2; scopeRear.position.set(0, 0.13, -0.32); rifleGroup.add(scopeRear)

  // Bipod (plegado).
  const bipodL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 6)), darkMetalMat)
  bipodL.position.set(-0.04, -0.08, -0.95); bipodL.rotation.z = 0.4; rifleGroup.add(bipodL)
  const bipodR = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 6)), darkMetalMat)
  bipodR.position.set(0.04, -0.08, -0.95); bipodR.rotation.z = -0.4; rifleGroup.add(bipodR)

  const sightDot = scopeLens

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.02, -1.6)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    glassMat.dispose()
    muzzleSprite.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.22, hipY: -0.2, adsX: 0, adsY: -0.13, dispose
  }
}

/* =========================================================================
   Shotgun — tubo + pump (corredera).
   ========================================================================= */
function buildShotgun() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x1a1a1a, metalness: 0.9, roughness: 0.35,
    envMapIntensity: 1.4
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.0
  })
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5a2a10, metalness: 0.1, roughness: 0.75, envMapIntensity: 0.8
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  // Cuerpo.
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.11, 0.55)), metalMat)
  body.position.set(0, 0, -0.35); rifleGroup.add(body)

  // Cañón grueso + tubo de munición debajo.
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.032, 0.55, 16)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.04, -0.75); rifleGroup.add(barrel)
  const magTube = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 12)), darkMetalMat)
  magTube.rotation.x = Math.PI / 2; magTube.position.set(0, -0.04, -0.75); rifleGroup.add(magTube)

  const muzzleTip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12)), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2; muzzleTip.position.set(0, 0.04, -1.05); rifleGroup.add(muzzleTip)

  // Pump (corredera) bajo el cañón.
  const pump = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 16)), woodMat)
  pump.rotation.x = Math.PI / 2; pump.position.set(0, -0.04, -0.7); rifleGroup.add(pump)

  // Guardamonte.
  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.04, -0.2); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Stock de madera.
  const stock = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.1, 0.3)), woodMat)
  stock.position.set(0, -0.02, 0.05); rifleGroup.add(stock)
  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.16, 0.09)), woodMat)
  grip.position.set(0, -0.1, -0.16); grip.rotation.x = -0.3; rifleGroup.add(grip)

  // Mira de hierro: bead sight frontal.
  const sightDot = new THREE.Mesh(track(new THREE.SphereGeometry(0.008, 8, 8)), new THREE.MeshBasicMaterial({ color: 0xffcc44 }))
  sightDot.position.set(0, 0.08, -1.0); rifleGroup.add(sightDot)

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.04, -1.13)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); woodMat.dispose()
    muzzleSprite.material.dispose()
    sightDot.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.22, hipY: -0.2, adsX: 0, adsY: -0.13, dispose
  }
}

/* =========================================================================
   LMG — caja de munición + bípode.
   ========================================================================= */
function buildLMG() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x252525, metalness: 0.92, roughness: 0.3,
    envMapIntensity: 1.4
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.92, roughness: 0.4, envMapIntensity: 1.0
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x141414, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.7
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  // Cuerpo grande.
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.14, 0.75)), metalMat)
  body.position.set(0, 0, -0.45); rifleGroup.add(body)

  // Cañón grueso con heat shield.
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.028, 0.6, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.95); rifleGroup.add(barrel)
  const heatShield = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12, 1, true)), darkMetalMat)
  heatShield.rotation.x = Math.PI / 2; heatShield.position.set(0, 0.02, -0.9); rifleGroup.add(heatShield)

  const muzzleTip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12)), darkMetalMat)
  muzzleTip.rotation.x = Math.PI / 2; muzzleTip.position.set(0, 0.02, -1.3); rifleGroup.add(muzzleTip)

  // Caja de munición (belt box) debajo, grande.
  const magBox = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.18, 0.18)), polymerMat)
  magBox.position.set(0, -0.16, -0.4); rifleGroup.add(magBox)

  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.17, 0.09)), polymerMat)
  grip.position.set(0, -0.1, -0.18); grip.rotation.x = -0.3; rifleGroup.add(grip)

  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.04, -0.22); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Stock con agarradera.
  const stock = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.12, 0.3)), polymerMat)
  stock.position.set(0, -0.02, 0.05); rifleGroup.add(stock)

  // Carry handle sobre el cuerpo.
  const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.04, 0.008, 8, 16, Math.PI)), darkMetalMat)
  handle.position.set(0, 0.09, -0.4); handle.rotation.x = -Math.PI / 2; rifleGroup.add(handle)

  // Bípode desplegado al frente.
  const bipodL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6)), darkMetalMat)
  bipodL.position.set(-0.06, -0.12, -1.1); bipodL.rotation.z = 0.5; rifleGroup.add(bipodL)
  const bipodR = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6)), darkMetalMat)
  bipodR.position.set(0.06, -0.12, -1.1); bipodR.rotation.z = -0.5; rifleGroup.add(bipodR)

  // Mira: carrying handle actúa como sight reference.
  const sightDot = handle

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.02, -1.4)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    muzzleSprite.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.24, hipY: -0.22, adsX: 0, adsY: -0.14, dispose
  }
}

/* =========================================================================
   Pistol — corto, sin stock, slide móvil.
   ========================================================================= */
function buildPistol() {
  const viewmodel = new THREE.Group()
  const rifleGroup = new THREE.Group()
  viewmodel.add(rifleGroup)

  const gunTex = getGunTex()
  const metalMat = new THREE.MeshStandardMaterial({
    map: gunTex.map, normalMap: gunTex.normalMap, roughnessMap: gunTex.roughnessMap, color: 0x2a2a2a, metalness: 0.92, roughness: 0.25,
    envMapIntensity: 1.5
  })
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x141414, metalness: 0.92, roughness: 0.4, envMapIntensity: 1.0
  })
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.7
  })

  const geos = []
  const track = (g) => { geos.push(g); return g }

  // Slide (parte superior que retrocede al disparar).
  const slide = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.06, 0.32)), metalMat)
  slide.position.set(0, 0.04, -0.2); rifleGroup.add(slide)

  // Frame inferior.
  const frame = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.04, 0.32)), polymerMat)
  frame.position.set(0, -0.01, -0.2); rifleGroup.add(frame)

  // Cañón corto asomando del slide.
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.02, 0.06, 12)), darkMetalMat)
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.04, -0.38); rifleGroup.add(barrel)

  // Grip (empuñadura) inclinado.
  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.16, 0.08)), polymerMat)
  grip.position.set(0, -0.1, -0.12); grip.rotation.x = -0.25; rifleGroup.add(grip)

  // Mag dentro del grip.
  const mag = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.04, 0.07)), darkMetalMat)
  mag.position.set(0, -0.18, -0.1); rifleGroup.add(mag)

  // Trigger guard.
  const trigger = new THREE.Mesh(track(new THREE.TorusGeometry(0.018, 0.006, 8, 16, Math.PI)), darkMetalMat)
  trigger.position.set(0, -0.04, -0.18); trigger.rotation.x = Math.PI / 2; rifleGroup.add(trigger)

  // Rear sight + front sight.
  const rearSight = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.015, 0.015)), darkMetalMat)
  rearSight.position.set(0, 0.08, -0.1); rifleGroup.add(rearSight)
  const frontSight = new THREE.Mesh(track(new THREE.BoxGeometry(0.012, 0.025, 0.012)), darkMetalMat)
  frontSight.position.set(0, 0.08, -0.34); rifleGroup.add(frontSight)

  const sightDot = frontSight

  const { muzzleLight, muzzleSprite } = addMuzzle(rifleGroup, 0, 0.04, -0.42)

  function dispose() {
    metalMat.dispose(); darkMetalMat.dispose(); polymerMat.dispose()
    muzzleSprite.material.dispose()
    for (const g of geos) g.dispose()
    geos.length = 0
  }

  // La pistol se sostiene más cerca y centrada.
  return {
    viewmodel, rifleGroup, muzzleLight, muzzleSprite, sightDot,
    hipX: 0.16, hipY: -0.18, adsX: 0, adsY: -0.12, dispose
  }
}

/* =========================================================================
   Dispatcher: factory por weaponId.
   ========================================================================= */
const BUILDERS = {
  m4: buildM4,
  ak47: buildAK47,
  mp5: buildMP5,
  sniper: buildSniper,
  shotgun: buildShotgun,
  lmg: buildLMG,
  pistol: buildPistol
}

const CATEGORY_FALLBACKS = {
  ar: buildM4,
  smg: buildMP5,
  sniper: buildSniper,
  marksman: buildSniper,
  shotgun: buildShotgun,
  lmg: buildLMG,
  pistol: buildPistol,
  launcher: buildM4
}

export function buildViewModel(weaponId) {
  const builder = BUILDERS[weaponId]
  if (builder) return builder()
  const weapon = WEAPONS && WEAPONS[weaponId]
  const fallback = (weapon && CATEGORY_FALLBACKS[weapon.category]) || buildM4
  return fallback()
}

// Dispose compartido de texturas (gunTex + muzzleTex) al destruir engine.
export function disposeViewModelShared() {
  if (_sharedGunTex) { _sharedGunTex.dispose(); _sharedGunTex = null }
  if (_sharedMuzzleTex) { _sharedMuzzleTex.dispose(); _sharedMuzzleTex = null }
}
