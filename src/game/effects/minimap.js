/* =========================================================================
   Minimap — canvas 2D overlay estilo Call of Duty.
   --------------------------------------------------------------------------
   - Rotate-with-player: el jugador siempre apunta arriba (triángulo verde
     en el centro). El mundo rota alrededor.
   - Enemigos: puntos rojos, parpadeantes si dispararon en los últimos 2s
     (muzzle report).
   - UAV reveal: si está activo, todos los enemigos son visibles aunque no
     hayan disparado (lo controla el store con uavActive).
   - Referencias estáticas: borde del mapa y plaza de toros.
   - Rango configurable (típicamente 80 unidades del mundo = todo el mapa).
   ========================================================================= */
import { FLOOR_SIZE } from '@/game/core/constants'

const MAP_RANGE = 100             // unidades del mundo visibles en el minimap
const CANVAS_SIZE = 140           // px del canvas
const HALF = CANVAS_SIZE / 2
const SCALE = CANVAS_SIZE / (MAP_RANGE * 2)
const MUZZLE_REPORT_MS = 2000     // ventana en la que un enemigo "parpadea"

export function createMinimap() {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  canvas.className = 'minimap'
  const ctx = canvas.getContext('2d')

  // Vector scratch para proyección.
  const _p = { x: 0, z: 0 }

  // Proyecta una posición del mundo a coordenadas del canvas (relativas
  // al jugador, rotadas para que el jugador mire hacia arriba).
  // yaw es el ángulo del jugador en radianes (0 = mirando -Z).
  function project(wx, wz, px, pz, yaw) {
    // Posición relativa al jugador.
    let dx = wx - px
    let dz = wz - pz
    // Rotamos para que el jugador apunte arriba: rotamos +yaw.
    // En pantalla, arriba = -Y. El jugador mira hacia -Z con yaw=0,
    // así que rotamos el mundo por -yaw alrededor del jugador.
    const cos = Math.cos(-yaw)
    const sin = Math.sin(-yaw)
    const rx = dx * cos - dz * sin
    const rz = dx * sin + dz * cos
    // Mapeamos al canvas: X derecha, Z arriba (negativa en pantalla).
    _p.x = HALF + rx * SCALE
    _p.z = HALF - rz * SCALE // -rz porque arriba en pantalla es -Y
    return _p
  }

  function update(dt, playerPos, playerYaw, enemies, uavActive) {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Fondo circular con vignette.
    ctx.save()
    ctx.beginPath()
    ctx.arc(HALF, HALF, HALF - 1, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = 'rgba(8, 12, 18, 0.85)'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // --- Referencias estáticas: borde del mapa y plaza de toros ---
    // Borde del mapa (cuadrado FLOOR_SIZE).
    const fx = -FLOOR_SIZE / 2, fz = -FLOOR_SIZE / 2, fs = FLOOR_SIZE
    const c1 = project(fx, fz, playerPos.x, playerPos.z, playerYaw)
    const c2 = project(fx + fs, fz, playerPos.x, playerPos.z, playerYaw)
    const c3 = project(fx + fs, fz + fs, playerPos.x, playerPos.z, playerYaw)
    const c4 = project(fx, fz + fs, playerPos.x, playerPos.z, playerYaw)
    ctx.strokeStyle = 'rgba(120, 100, 70, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(c1.x, c1.z); ctx.lineTo(c2.x, c2.z)
    ctx.lineTo(c3.x, c3.z); ctx.lineTo(c4.x, c4.z); ctx.closePath(); ctx.stroke()

    // Plaza de toros (círculo en (0,-95), radio 28).
    const br = project(0, -95, playerPos.x, playerPos.z, playerYaw)
    ctx.strokeStyle = 'rgba(120, 100, 70, 0.4)'
    ctx.beginPath()
    ctx.arc(br.x, br.z, 28 * SCALE, 0, Math.PI * 2)
    ctx.stroke()

    // --- Enemigos ---
    if (enemies) {
      const now = performance.now()
      enemies.forEachAlive((pos, typeName, lastShotAt) => {
        const p = project(pos.x, pos.z, playerPos.x, playerPos.z, playerYaw)
        // Fuera del canvas: no pintamos (clip ya lo recorta).
        if (p.x < 0 || p.x > CANVAS_SIZE || p.z < 0 || p.z > CANVAS_SIZE) return
        const recent = (now - lastShotAt) < MUZZLE_REPORT_MS
        // UAV: siempre visible. Sin UAV: solo si disparó recientemente.
        if (!uavActive && !recent) return
        // Parpadeo si disparó recientemente.
        const blink = recent && Math.floor(now / 150) % 2 === 0
        ctx.fillStyle = blink ? '#ff4040' : '#cc2020'
        const r = typeName === 'boss' ? 3 : 2
        ctx.beginPath()
        ctx.arc(p.x, p.z, r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    ctx.restore()

    // --- Borde del minimap ---
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(HALF, HALF, HALF - 1, 0, Math.PI * 2)
    ctx.stroke()

    // --- Jugador: triángulo verde en el centro apuntando arriba ---
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    ctx.moveTo(HALF, HALF - 6)         // punta
    ctx.lineTo(HALF - 4, HALF + 4)     // base izq
    ctx.lineTo(HALF + 4, HALF + 4)     // base der
    ctx.closePath()
    ctx.fill()

    // --- Indicador "N" (norte) ---
    ctx.fillStyle = 'rgba(180, 180, 180, 0.7)'
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    // Norte en mundo = -Z. Proyectamos (0, -200) para ver dónde cae.
    const n = project(playerPos.x, playerPos.z - 200, playerPos.x, playerPos.z, playerYaw)
    // Solo lo pintamos si está dentro del canvas.
    const ndx = n.x - HALF, ndy = n.z - HALF
    const dist = Math.hypot(ndx, ndy)
    if (dist < HALF - 4) {
      ctx.fillText('N', n.x, n.z + 3)
    }
  }

  function dispose() {
    // Nada que liberar (canvas 2D, sin recursos GPU).
  }

  return { canvas, update, dispose }
}
