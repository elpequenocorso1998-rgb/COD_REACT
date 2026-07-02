import * as THREE from 'three'
import { mulberry32 } from '@/game/core/math'
import { PRNG_SEEDS } from '@/game/core/constants'

/* =========================================================================
   Factoría de texturas PBR procedurales.
   --------------------------------------------------------------------------
   Generamos en canvas mapas de color, normal y roughness para dar relieve
   realista a materiales sin necesidad de ficheros externos. Cada función
   devuelve un objeto { map, normalMap, roughnessMap } listo para usar.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   Suelo de hormigón: gris con grietas, manchas de aceite y ruido fino.
   El normal map simula baches y juntas.
   --------------------------------------------------------------------------- */
export function makeConcreteTextures(size = 512) {
  const rng = mulberry32(PRNG_SEEDS.concrete)

  // --- COLOR MAP ---
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = colorCanvas.height = size
  const ctx = colorCanvas.getContext('2d')

  // Base
  const baseGrad = ctx.createLinearGradient(0, 0, size, size)
  baseGrad.addColorStop(0, '#262a30')
  baseGrad.addColorStop(0.5, '#2c3038')
  baseGrad.addColorStop(1, '#22262c')
  ctx.fillStyle = baseGrad
  ctx.fillRect(0, 0, size, size)

  // Manchas de aceite/oscuras
  for (let i = 0; i < 30; i++) {
    const x = rng() * size, y = rng() * size, r = 8 + rng() * 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(15,15,18,${0.4 + rng() * 0.4})`)
    g.addColorStop(1, 'rgba(15,15,18,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  // Manchas de óxido/musgo
  for (let i = 0; i < 15; i++) {
    const x = rng() * size, y = rng() * size, r = 6 + rng() * 25
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(80,55,30,${0.3 + rng() * 0.3})`)
    g.addColorStop(1, 'rgba(80,55,30,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  // Ruido fino
  for (let i = 0; i < 4000; i++) {
    const v = 30 + rng() * 40
    ctx.fillStyle = `rgba(${v},${v},${v},${rng() * 0.15})`
    ctx.fillRect(rng() * size, rng() * size, 2, 2)
  }
  // Juntas de losas
  ctx.strokeStyle = 'rgba(10,10,12,0.6)'
  ctx.lineWidth = 3
  const tiles = 4
  for (let i = 0; i <= tiles; i++) {
    const p = (i / tiles) * size
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke()
  }

  // --- NORMAL MAP ---
  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = normalCanvas.height = size
  const nctx = normalCanvas.getContext('2d')
  // Base azul (z+)
  nctx.fillStyle = '#8080ff'
  nctx.fillRect(0, 0, size, size)

  // Baches: cada bache es un pequeño degradado que simula altura.
  for (let i = 0; i < 600; i++) {
    const x = rng() * size, y = rng() * size, r = 1 + rng() * 3
    const g = nctx.createRadialGradient(x, y, 0, x, y, r)
    const dir = rng() > 0.5 ? 1 : -1
    g.addColorStop(0, dir > 0 ? '#a0a0ff' : '#6060c0')
    g.addColorStop(1, '#8080ff')
    nctx.fillStyle = g
    nctx.beginPath(); nctx.arc(x, y, r, 0, Math.PI * 2); nctx.fill()
  }
  // Juntas marcadas (hundidas)
  nctx.strokeStyle = '#4040a0'
  nctx.lineWidth = 4
  for (let i = 0; i <= tiles; i++) {
    const p = (i / tiles) * size
    nctx.beginPath(); nctx.moveTo(p, 0); nctx.lineTo(p, size); nctx.stroke()
    nctx.beginPath(); nctx.moveTo(0, p); nctx.lineTo(size, p); nctx.stroke()
  }

  // --- ROUGHNESS MAP ---
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = roughCanvas.height = size
  const rctx = roughCanvas.getContext('2d')
  // Base mate
  rctx.fillStyle = '#d0d0d0'
  rctx.fillRect(0, 0, size, size)
  // Zonas más pulidas (manchas de aceite)
  for (let i = 0; i < 25; i++) {
    const x = rng() * size, y = rng() * size, r = 8 + rng() * 35
    const g = rctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, '#505050')
    g.addColorStop(1, '#d0d0d0')
    rctx.fillStyle = g
    rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill()
  }

  const map = new THREE.CanvasTexture(colorCanvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(12, 12)
  map.anisotropy = 8

  const normalMap = new THREE.CanvasTexture(normalCanvas)
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
  normalMap.repeat.set(12, 12)
  normalMap.anisotropy = 8

  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
  roughnessMap.repeat.set(12, 12)
  roughnessMap.anisotropy = 8

  return { map, normalMap, roughnessMap }
}

/* ---------------------------------------------------------------------------
   Metal pintado (rojo) para bidones: con rayas y óxido.
   --------------------------------------------------------------------------- */
export function makeBarrelTexture(size = 256) {
  const rng = mulberry32(PRNG_SEEDS.barrel)
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#b8431f'
  ctx.fillRect(0, 0, size, size)
  // Franjas
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, size * 0.15, size, size * 0.05)
  ctx.fillRect(0, size * 0.8, size, size * 0.05)
  // Óxido
  for (let i = 0; i < 30; i++) {
    const x = rng() * size, y = rng() * size, r = 4 + rng() * 15
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(60,30,10,0.6)')
    g.addColorStop(1, 'rgba(60,30,10,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  // Arañazos
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(80,30,10,${0.2 + rng() * 0.3})`
    ctx.lineWidth = 1
    ctx.beginPath()
    const x = rng() * size, y = rng() * size
    ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 30, y + (rng() - 0.5) * 30)
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

/* ---------------------------------------------------------------------------
   Madera vieja para cajas.
   --------------------------------------------------------------------------- */
export function makeCrateTextures(size = 256) {
  const rng = mulberry32(PRNG_SEEDS.crate)
  // Color
  const cc = document.createElement('canvas')
  cc.width = cc.height = size
  const ctx = cc.getContext('2d')
  ctx.fillStyle = '#6b4a26'
  ctx.fillRect(0, 0, size, size)
  // Vetas de madera
  for (let i = 0; i < 60; i++) {
    const y = rng() * size
    ctx.strokeStyle = `rgba(${40 + rng() * 30},${25 + rng() * 20},${10 + rng() * 10},${0.4 + rng() * 0.4})`
    ctx.lineWidth = 1 + rng() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + (rng() - 0.5) * 4)
    }
    ctx.stroke()
  }
  // Nudos
  for (let i = 0; i < 5; i++) {
    const x = rng() * size, y = rng() * size, r = 4 + rng() * 8
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, '#3a2410')
    g.addColorStop(1, 'rgba(58,36,16,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  // Marco metálico
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, size - 8, size - 8)

  // Normal map (vetas hundidas)
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')
  nctx.fillStyle = '#8080ff'
  nctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 60; i++) {
    const y = rng() * size
    nctx.strokeStyle = '#5050d0'
    nctx.lineWidth = 1 + rng() * 2
    nctx.beginPath(); nctx.moveTo(0, y); nctx.lineTo(size, y); nctx.stroke()
  }

  const map = new THREE.CanvasTexture(cc)
  const normalMap = new THREE.CanvasTexture(nc)
  return { map, normalMap }
}

/* ---------------------------------------------------------------------------
   Metal oscuro para armas: rayado longitudinal + desgaste.
   --------------------------------------------------------------------------- */
export function makeGunMetalTexture(size = 256) {
  const rng = mulberry32(PRNG_SEEDS.gunMetal)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  // Normal map canvas.
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')
  nctx.fillStyle = 'rgb(128,128,255)'
  nctx.fillRect(0, 0, size, size)
  // Roughness map canvas.
  const rc = document.createElement('canvas')
  rc.width = rc.height = size
  const rctx = rc.getContext('2d')
  rctx.fillStyle = '#707070'
  rctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#1c1e22'
  ctx.fillRect(0, 0, size, size)
  // Rayado longitudinal
  for (let i = 0; i < 80; i++) {
    const y = rng() * size
    ctx.strokeStyle = `rgba(${30 + rng() * 40},${30 + rng() * 40},${35 + rng() * 40},${0.3 + rng() * 0.4})`
    ctx.lineWidth = 0.5 + rng()
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (rng() - 0.5) * 2); ctx.stroke()
    // Normal map: small grooves from machining.
    nctx.strokeStyle = `rgb(${120 + rng() * 10},${120 + rng() * 10},255)`
    nctx.lineWidth = 0.5
    nctx.beginPath(); nctx.moveTo(0, y); nctx.lineTo(size, y); nctx.stroke()
    // Roughness: variation along scratches.
    rctx.strokeStyle = `rgb(${80 + rng() * 60},${80 + rng() * 60},${80 + rng() * 60})`
    rctx.lineWidth = 0.5
    rctx.beginPath(); rctx.moveTo(0, y); rctx.lineTo(size, y); rctx.stroke()
  }
  // Desgaste brillante
  for (let i = 0; i < 20; i++) {
    const x = rng() * size, y = rng() * size, r = 2 + rng() * 6
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(120,120,130,0.5)')
    g.addColorStop(1, 'rgba(120,120,130,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    // Roughness: shiny spots = lower roughness.
    const rg = rctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, '#404040')
    rg.addColorStop(1, '#707070')
    rctx.fillStyle = rg
    rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  const normalTex = new THREE.CanvasTexture(nc)
  const roughTex = new THREE.CanvasTexture(rc)
  return { map: tex, normalMap: normalTex, roughnessMap: roughTex }
}

/* ---------------------------------------------------------------------------
   Tejido para uniformes de enemigos: camuflaje urbano.
   --------------------------------------------------------------------------- */
export function makeUniformTexture(size = 256) {
  const rng = mulberry32(PRNG_SEEDS.uniform)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  // Normal map (cloth weave pattern).
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')
  nctx.fillStyle = 'rgb(128,128,255)'
  nctx.fillRect(0, 0, size, size)
  // Base gris oscuro
  ctx.fillStyle = '#2a2d33'
  ctx.fillRect(0, 0, size, size)
  // Manchas de camuflaje
  const colors = ['#1a1d22', '#3a3d44', '#4a4d54', '#1f2328']
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)]
    const x = rng() * size, y = rng() * size, r = 8 + rng() * 30
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
    // Normal: camo edges have slight bump.
    nctx.strokeStyle = 'rgb(135,135,255)'
    nctx.lineWidth = 1
    nctx.beginPath()
    nctx.ellipse(x, y, r, r * (0.5 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2)
    nctx.stroke()
  }
  // Ruido fino + normal weave
  for (let i = 0; i < 1500; i++) {
    const v = 20 + rng() * 30
    ctx.fillStyle = `rgba(${v},${v},${v},${rng() * 0.2})`
    const px = rng() * size, py = rng() * size
    ctx.fillRect(px, py, 2, 2)
    // Cloth weave pattern in normal map.
    nctx.fillStyle = `rgb(${125 + Math.floor(rng() * 6 - 3)},${125 + Math.floor(rng() * 6 - 3)},255)`
    nctx.fillRect(px, py, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  const normalTex = new THREE.CanvasTexture(nc)
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping
  return { map: tex, normalMap: normalTex }
}

/* ---------------------------------------------------------------------------
   Piel para cabezas de enemigos.
   --------------------------------------------------------------------------- */
export function makeSkinTexture(size = 128) {
  const rng = mulberry32(PRNG_SEEDS.skin)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  // Normal map (pores).
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')
  nctx.fillStyle = 'rgb(128,128,255)'
  nctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#c9a07a'
  ctx.fillRect(0, 0, size, size)
  // Pecas/manchas
  for (let i = 0; i < 80; i++) {
    const x = rng() * size, y = rng() * size, r = 1 + rng() * 3
    ctx.fillStyle = `rgba(${100 + rng() * 50},${60 + rng() * 30},${40 + rng() * 20},${0.2 + rng() * 0.3})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    // Normal: freckle bump.
    nctx.fillStyle = 'rgb(132,132,255)'
    nctx.beginPath(); nctx.arc(x, y, r, 0, Math.PI * 2); nctx.fill()
  }
  // Poros
  for (let i = 0; i < 2000; i++) {
    const px = rng() * size, py = rng() * size
    ctx.fillStyle = `rgba(80,50,30,${rng() * 0.15})`
    ctx.fillRect(px, py, 1, 1)
    // Normal: pore = tiny indent.
    nctx.fillStyle = `rgb(${126 + Math.floor(rng() * 4 - 2)},${126 + Math.floor(rng() * 4 - 2)},255)`
    nctx.fillRect(px, py, 1, 1)
  }
  return { map: new THREE.CanvasTexture(c), normalMap: new THREE.CanvasTexture(nc) }
}
