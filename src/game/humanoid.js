import * as THREE from 'three'
import { makeSkinTexture, makeUniformTexture } from './textures.js'

/* =========================================================================
   Humanoide anatómico.
   --------------------------------------------------------------------------
   Construye un personaje con proporciones humanas realistas usando una
   jerarquía de huesos (THREE.Group) para poder animarlo:
     - hips (cadera, raíz)
       └ spine (columna)
         └ chest (pecho)
           └ neck → head (cabeza con cara)
           └ shoulderL/R → upperArmL/R → lowerArmL/R → handL/R
       └ thighL/R → shinL/R → footL/R

   Cada parte usa la geometría adecuada:
     - Cabeza: esfera con piel + nariz + ojos + boca + pelo.
     - Torso: cápsula ahusada (lathe) para dar forma de pecho/cintura.
     - Brazos/piernas: cilindros con codos/rodillas.
     - Manos: pequeñas cajas.
     - Pies: botas.

   La animación de caminar mueve todos los huesos con un ciclo natural:
   piernas alternas, contrabalanceo de brazos, balanceo de cadera y
   pequeño bobbing vertical.
   ========================================================================= */

// Materiales y geometrías compartidas entre todos los enemigos.
let _matSkin, _matUniform, _matPants, _matHair, _matEye, _matBoot, _matBelt
let _matVest, _matHelmet, _matGloves, _matBrow, _matMouth
let _geoHead, _geoNeck, _geoTorso, _geoHip, _geoUpperArm, _geoLowerArm
let _geoHand, _geoThigh, _geoShin, _geoFoot, _geoHair, _geoNose, _geoMouth
let _geoVest, _geoHelmet, _geoCalf, _geoEar

function initShared() {
  if (_matSkin) return
  const skinTex = makeSkinTexture(128)
  const uniformTex = makeUniformTexture(256)
  uniformTex.repeat.set(1, 1)

  _matSkin = new THREE.MeshStandardMaterial({ map: skinTex, color: 0xc9a07a, roughness: 0.7, metalness: 0.05 })
  _matUniform = new THREE.MeshStandardMaterial({ map: uniformTex, color: 0x4a3320, roughness: 0.85, metalness: 0.1 })
  _matPants = new THREE.MeshStandardMaterial({ map: uniformTex, color: 0x2a2a2a, roughness: 0.85, metalness: 0.1 })
  _matHair = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9, metalness: 0.05 })
  _matEye = new THREE.MeshBasicMaterial({ color: 0xff2020 })
  _matBoot = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.3 })
  _matBelt = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.5 })
  // Chaleco táctico (kevlar): más oscuro y rugoso.
  _matVest = new THREE.MeshStandardMaterial({ color: 0x1a1f1a, roughness: 0.95, metalness: 0.15 })
  // Casco militar.
  _matHelmet = new THREE.MeshStandardMaterial({ color: 0x2a2f24, roughness: 0.7, metalness: 0.3 })
  // Guantes.
  _matGloves = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85, metalness: 0.2 })
  _matBrow = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 })
  _matMouth = new THREE.MeshStandardMaterial({ color: 0x4a1a1a })

  _geoHead = new THREE.SphereGeometry(0.14, 16, 16)
  _geoNeck = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8)
  _geoTorso = new THREE.CapsuleGeometry(0.18, 0.32, 6, 12)
  _geoHip = new THREE.CapsuleGeometry(0.16, 0.08, 6, 10)
  _geoUpperArm = new THREE.CapsuleGeometry(0.05, 0.24, 4, 8)
  _geoLowerArm = new THREE.CapsuleGeometry(0.045, 0.22, 4, 8)
  _geoHand = new THREE.SphereGeometry(0.055, 8, 8)
  _geoThigh = new THREE.CapsuleGeometry(0.08, 0.3, 4, 8)
  _geoShin = new THREE.CapsuleGeometry(0.07, 0.28, 4, 8)
  _geoFoot = new THREE.BoxGeometry(0.1, 0.06, 0.22)
  _geoHair = new THREE.SphereGeometry(0.15, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6)
  _geoNose = new THREE.ConeGeometry(0.025, 0.06, 6)
  _geoMouth = new THREE.BoxGeometry(0.06, 0.01, 0.01)
  // Chaleco: torso más ancho.
  _geoVest = new THREE.CapsuleGeometry(0.2, 0.28, 6, 12)
  // Casco: media esfera más grande que la cabeza.
  _geoHelmet = new THREE.SphereGeometry(0.16, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7)
  // Pantorrilla con botas.
  _geoCalf = new THREE.CylinderGeometry(0.075, 0.06, 0.15, 8)
  // Orejas (antes se creaba una geometría por enemigo: leak acumulativo).
  _geoEar = new THREE.SphereGeometry(0.022, 8, 8)
}

// Dispose de los recursos compartidos. Debe llamarse al destruir el engine
// (antes los materiales/geometrías compartidas nunca se liberaban, lo que
// provocaba un leak al recrear el engine en hot-reload / remontaje).
export function disposeHumanoidShared() {
  if (!_matSkin) return
  const mats = [_matSkin, _matUniform, _matPants, _matHair, _matEye, _matBoot, _matBelt,
    _matVest, _matHelmet, _matGloves, _matBrow, _matMouth]
  const geos = [_geoHead, _geoNeck, _geoTorso, _geoHip, _geoUpperArm, _geoLowerArm,
    _geoHand, _geoThigh, _geoShin, _geoFoot, _geoHair, _geoNose, _geoMouth,
    _geoVest, _geoHelmet, _geoCalf, _geoEar]
  for (const m of mats) m.dispose()
  for (const g of geos) g.dispose()
  // Liberamos las texturas de piel/uniforme (el resto de materiales no tienen map).
  _matSkin.map?.dispose()
  _matUniform.map?.dispose()
  _matSkin = null; _matUniform = null
  _matPants = null; _matHair = null; _matEye = null; _matBoot = null; _matBelt = null
  _matVest = null; _matHelmet = null; _matGloves = null; _matBrow = null; _matMouth = null
  _geoHead = null; _geoNeck = null; _geoTorso = null; _geoHip = null
  _geoUpperArm = null; _geoLowerArm = null; _geoHand = null; _geoThigh = null
  _geoShin = null; _geoFoot = null; _geoHair = null; _geoNose = null; _geoMouth = null
  _geoVest = null; _geoHelmet = null; _geoCalf = null; _geoEar = null
}

/* ---------------------------------------------------------------------------
   Construye un humanoide completo con jerarquía de huesos.
   Devuelve { root, parts... } donde parts son los pivotes para animar.
   --------------------------------------------------------------------------- */
export function buildHumanoid() {
  initShared()

  const root = new THREE.Group() // raíz = pies en y=0

  // --- CADERA (caderas a ~0.95m) ---
  const hips = new THREE.Group()
  hips.position.y = 0.95
  root.add(hips)

  const hipMesh = new THREE.Mesh(_geoHip, _matPants)
  hipMesh.position.y = 0; hipMesh.castShadow = true; hips.add(hipMesh)

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.22), _matBelt)
  belt.position.y = 0.04; hips.add(belt)

  // --- COLUMNA ---
  const spine = new THREE.Group()
  spine.position.y = 0.08
  hips.add(spine)

  // --- PECHO ---
  const chest = new THREE.Group()
  chest.position.y = 0.22
  spine.add(chest)

  const torsoMesh = new THREE.Mesh(_geoTorso, _matUniform)
  torsoMesh.position.y = 0.0; torsoMesh.castShadow = true; chest.add(torsoMesh)

  // --- CHALECO TÁCTICO (kevlar) sobre el torso ---
  const vest = new THREE.Mesh(_geoVest, _matVest)
  vest.position.y = 0.02; vest.castShadow = true; chest.add(vest)
  // Pockets del chaleco: pequeñas cajas en el pecho.
  for (let i = 0; i < 2; i++) {
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.05),
      _matVest
    )
    pocket.position.set((i === 0 ? -1 : 1) * 0.1, 0.05, 0.18)
    pocket.castShadow = true; chest.add(pocket)
  }

  // --- CUELLO + CABEZA ---
  const neck = new THREE.Group()
  neck.position.y = 0.22
  chest.add(neck)

  const neckMesh = new THREE.Mesh(_geoNeck, _matSkin)
  neckMesh.position.y = 0.05; neckMesh.castShadow = true; neck.add(neckMesh)

  const head = new THREE.Group()
  head.position.y = 0.15
  neck.add(head)

  const headMesh = new THREE.Mesh(_geoHead, _matSkin)
  headMesh.castShadow = true; head.add(headMesh)

  // Pelo.
  const hair = new THREE.Mesh(_geoHair, _matHair)
  hair.position.y = 0.02; hair.castShadow = true; head.add(hair)

  // --- CASCO MILITAR encima del pelo ---
  const helmet = new THREE.Mesh(_geoHelmet, _matHelmet)
  helmet.position.y = 0.03; helmet.castShadow = true; head.add(helmet)
  // Visera del casco: pequeña extensión frontal.
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.06),
    _matHelmet
  )
  visor.position.set(0, 0.08, 0.12); head.add(visor)

  // Ojos.
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), _matEye)
  eyeL.position.set(-0.04, 0.015, 0.125); head.add(eyeL)
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), _matEye)
  eyeR.position.set(0.04, 0.015, 0.125); head.add(eyeR)

  // Cejas.
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), _matBrow)
  browL.position.set(-0.04, 0.045, 0.13); head.add(browL)
  const browR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), _matBrow)
  browR.position.set(0.04, 0.045, 0.13); head.add(browR)

  // Nariz.
  const nose = new THREE.Mesh(_geoNose, _matSkin)
  nose.position.set(0, 0, 0.14); nose.rotation.x = Math.PI / 2; head.add(nose)

  // Boca.
  const mouth = new THREE.Mesh(_geoMouth, _matMouth)
  mouth.position.set(0, -0.06, 0.135); head.add(mouth)

  // Orejas (geometría compartida, antes se creaba una por enemigo).
  const earL = new THREE.Mesh(_geoEar, _matSkin)
  earL.position.set(-0.135, 0, 0); earL.scale.z = 0.4; head.add(earL)
  const earR = new THREE.Mesh(_geoEar, _matSkin)
  earR.position.set(0.135, 0, 0); earR.scale.z = 0.4; head.add(earR)

  // --- BRAZOS ---
  // Hombro → brazo superior → codo → brazo inferior → mano.
  function buildArm(side) {
    const sign = side === 'L' ? -1 : 1
    const shoulder = new THREE.Group()
    shoulder.position.set(sign * 0.22, 0.18, 0)
    chest.add(shoulder)

    const upperArm = new THREE.Mesh(_geoUpperArm, _matUniform)
    upperArm.position.y = -0.14; upperArm.castShadow = true; shoulder.add(upperArm)

    const elbow = new THREE.Group()
    elbow.position.y = -0.28
    shoulder.add(elbow)

    const lowerArm = new THREE.Mesh(_geoLowerArm, _matSkin)
    lowerArm.position.y = -0.12; lowerArm.castShadow = true; elbow.add(lowerArm)

    // Guante sobre la mano.
    const hand = new THREE.Mesh(_geoHand, _matGloves)
    hand.position.y = -0.26; hand.castShadow = true; elbow.add(hand)

    return { shoulder, elbow }
  }
  const armL = buildArm('L')
  const armR = buildArm('R')

  // --- PIERNAS ---
  // Cadera → muslo → rodilla → espinilla → pantorrilla con bota → pie.
  function buildLeg(side) {
    const sign = side === 'L' ? -1 : 1
    const hip = new THREE.Group()
    hip.position.set(sign * 0.1, -0.05, 0)
    hips.add(hip)

    const thigh = new THREE.Mesh(_geoThigh, _matPants)
    thigh.position.y = -0.18; thigh.castShadow = true; hip.add(thigh)

    const knee = new THREE.Group()
    knee.position.y = -0.36
    hip.add(knee)

    const shin = new THREE.Mesh(_geoShin, _matPants)
    shin.position.y = -0.16; shin.castShadow = true; knee.add(shin)

    // Pantorrilla con bota (geometría más oscura).
    const calf = new THREE.Mesh(_geoCalf, _matBoot)
    calf.position.y = -0.32; calf.castShadow = true; knee.add(calf)

    // Pie (bota).
    const foot = new THREE.Mesh(_geoFoot, _matBoot)
    foot.position.set(0, -0.4, 0.05); foot.castShadow = true; knee.add(foot)

    return { hip, knee }
  }
  const legL = buildLeg('L')
  const legR = buildLeg('R')

  return {
    root, hips, spine, chest, neck, head,
    armL, armR, legL, legR,
    headMesh, torsoMesh
  }
}

/* ---------------------------------------------------------------------------
   Animación de caminar.
   phase = tiempo acumulado (rad).
   speed = factor de intensidad (0 = parado, 1 = corriendo).
   --------------------------------------------------------------------------- */
export function animateWalk(humanoid, phase, speed = 1) {
  const s = Math.min(speed, 1)
  if (s < 0.05) {
    // Idle: postura relajada con leve respiración.
    humanoid.chest.rotation.x = Math.sin(phase * 0.5) * 0.02
    humanoid.head.rotation.y = Math.sin(phase * 0.3) * 0.05
    humanoid.head.rotation.x = Math.sin(phase * 0.5) * 0.01
    humanoid.armL.shoulder.rotation.x = 0.05
    humanoid.armR.shoulder.rotation.x = 0.05
    humanoid.armL.shoulder.rotation.z = 0.05
    humanoid.armR.shoulder.rotation.z = -0.05
    humanoid.armL.elbow.rotation.x = -0.2
    humanoid.armR.elbow.rotation.x = -0.2
    humanoid.legL.hip.rotation.x = 0
    humanoid.legR.hip.rotation.x = 0
    humanoid.legL.knee.rotation.x = 0.05
    humanoid.legR.knee.rotation.x = 0.05
    humanoid.hips.position.y = 0.95 + Math.sin(phase * 0.5) * 0.005
    return
  }

  // Ciclo de caminar: dos piernas desfasadas 180°.
  const swing = Math.sin(phase) * 0.55 * s
  const swing2 = Math.sin(phase + Math.PI) * 0.55 * s

  // Piernas.
  humanoid.legL.hip.rotation.x = swing
  humanoid.legR.hip.rotation.x = swing2
  // Rodillas: solo se doblan hacia atrás en la fase de recuperación.
  humanoid.legL.knee.rotation.x = Math.max(0, -swing) * 1.4 + 0.05
  humanoid.legR.knee.rotation.x = Math.max(0, -swing2) * 1.4 + 0.05

  // Brazos (contrabalanceo, menos intensos al correr para "guarda").
  const armSwing = s < 0.8 ? 0.7 : 0.4
  humanoid.armL.shoulder.rotation.x = swing2 * armSwing
  humanoid.armR.shoulder.rotation.x = swing * armSwing
  humanoid.armL.elbow.rotation.x = -0.5 - Math.abs(swing2) * 0.4
  humanoid.armR.elbow.rotation.x = -0.5 - Math.abs(swing) * 0.4
  // Brazos ligeramente separados del cuerpo.
  humanoid.armL.shoulder.rotation.z = 0.08
  humanoid.armR.shoulder.rotation.z = -0.08

  // Torso: balanceo lateral + rotación contraria + leve inclinación frontal.
  humanoid.spine.rotation.z = Math.sin(phase) * 0.05 * s
  humanoid.chest.rotation.y = Math.sin(phase) * 0.08 * s
  humanoid.chest.rotation.x = 0.08 * s
  // Pelvis: contrabalanceo.
  humanoid.hips.rotation.y = -Math.sin(phase) * 0.06 * s

  // Cabeza: mira al frente con leve compensación (mantiene estable la mirada).
  humanoid.head.rotation.y = -Math.sin(phase) * 0.06 * s
  humanoid.head.rotation.x = -0.06 * s
  humanoid.head.rotation.z = -Math.sin(phase) * 0.02 * s

  // Bobbing vertical de la cadera (caminar real produce oscilación vertical).
  humanoid.hips.position.y = 0.95 + Math.abs(Math.sin(phase)) * 0.04 * s
}
