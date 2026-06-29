import * as THREE from 'three'
import { PICKUPS } from './config.js'
import { hasPerk } from './loadout.js'

/* =========================================================================
   Sistema de pickups — items que sueltan los enemigos al morir.
   --------------------------------------------------------------------------
   Antes la config PICKUPS existía pero era código muerto: nadie la importaba.
   Ahora cada kill tiene dropChance de soltar un item (salud/munición/granada)
   que el jugador recoge al pasar por encima.

   - Scavenger (perk): 100% drop de munición (en vez de 30%).
   - Los pickups rotan y flotan (bob) para ser visibles.
   - Pool de meshes para no allocar por cada drop.
   ========================================================================= */

const PICKUP_RADIUS = 1.5    // distancia de recogida
const BOB_AMP = 0.15         // amplitud del flotado
const BOB_SPEED = 2.5        // velocidad del flotado
const LIFE_TIME = 30         // segundos antes de desaparecer

const COLORS = {
  health: 0x33ff66,
  ammo: 0xffcc33,
  grenade: 0x66aaff
}

export function createPickupSystem(scene, store, particles, audio) {
  const pickups = []
  // Geometría/material compartidos por tipo.
  const geos = {
    health: new THREE.OctahedronGeometry(0.3),
    ammo: new THREE.BoxGeometry(0.35, 0.25, 0.35),
    grenade: new THREE.SphereGeometry(0.22, 8, 8)
  }
  const mats = {
    health: new THREE.MeshStandardMaterial({ color: COLORS.health, emissive: COLORS.health, emissiveIntensity: 0.5 }),
    ammo: new THREE.MeshStandardMaterial({ color: COLORS.ammo, emissive: COLORS.ammo, emissiveIntensity: 0.4 }),
    grenade: new THREE.MeshStandardMaterial({ color: COLORS.grenade, emissive: COLORS.grenade, emissiveIntensity: 0.4 })
  }

  // Selecciona un tipo de pickup según los pesos de config.
  function rollType() {
    const types = PICKUPS.types
    let total = 0
    for (const k of Object.keys(types)) total += types[k].weight
    let r = Math.random() * total
    for (const k of Object.keys(types)) {
      r -= types[k].weight
      if (r <= 0) return k
    }
    return 'ammo'
  }

  // Spawnea un pickup en la posición dada. Si scavenger activo, fuerza munición.
  function spawnAt(pos, forceAmmo = false) {
    const type = forceAmmo ? 'ammo' : rollType()
    const mesh = new THREE.Mesh(geos[type], mats[type])
    mesh.position.set(pos.x, 0.5, pos.z)
    mesh.castShadow = true
    scene.add(mesh)
    pickups.push({
      mesh,
      type,
      bornAt: performance.now(),
      phase: Math.random() * Math.PI * 2
    })
  }

  // Llamado por el engine cuando un enemigo muere.
  function onEnemyKilled(enemyPos) {
    // Scavenger: 100% drop de munición.
    if (hasPerk('scavenger')) {
      spawnAt(enemyPos, true)
      return
    }
    // Drop normal: dropChance de soltar un item aleatorio.
    if (Math.random() < PICKUPS.dropChance) {
      spawnAt(enemyPos)
    }
  }

  // Update: bob/rotate + detección de proximidad del jugador.
  function update(dt, playerPos) {
    const now = performance.now()
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]
      // Bob + rotación.
      p.phase += dt * BOB_SPEED
      p.mesh.position.y = 0.5 + Math.sin(p.phase) * BOB_AMP
      p.mesh.rotation.y += dt * 1.5

      // Expira tras LIFE_TIME segundos.
      if ((now - p.bornAt) / 1000 > LIFE_TIME) {
        scene.remove(p.mesh)
        pickups.splice(i, 1)
        continue
      }

      // Detección de proximidad: si el jugador pasa cerca, recoge.
      const dx = playerPos.x - p.mesh.position.x
      const dz = playerPos.z - p.mesh.position.z
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
        applyPickup(p.type)
        if (audio) audio.playHitMarker?.('body')
        scene.remove(p.mesh)
        pickups.splice(i, 1)
      }
    }
  }

  // Aplica el efecto del pickup al store.
  function applyPickup(type) {
    const cfg = PICKUPS.types[type]
    if (!cfg || !store) return
    const st = store.getState()
    if (type === 'health') st.addHealth(cfg.amount)
    else if (type === 'ammo') st.addReserve(cfg.amount)
    else if (type === 'grenade') st.addGrenade('frag', cfg.amount)
  }

  function reset() {
    for (const p of pickups) scene.remove(p.mesh)
    pickups.length = 0
  }

  function dispose() {
    reset()
    for (const k of Object.keys(geos)) geos[k].dispose()
    for (const k of Object.keys(mats)) mats[k].dispose()
  }

  return { onEnemyKilled, update, reset, dispose }
}
