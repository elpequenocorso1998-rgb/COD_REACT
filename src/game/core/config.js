/* =========================================================================
   Configuración de balance de juego (data-driven).
   --------------------------------------------------------------------------
   Antes los valores de enemigos, movimiento del jugador y arma estaban
   hardcodeados en engine.js, player.js y enemies.js. Aquí se centralizan
   para que el balance sea fácil de ajustar sin tocar lógica.
   ========================================================================= */

// --- Jugador ---
export const PLAYER = {
  maxHealth: 100,
  bodyRadius: 0.45,
  standHeight: 1.7,
  crouchHeight: 1.1,
  // i-frames tras recibir daño (evita melts instantáneos por múltiples
  // enemigos golpeando en el mismo frame).
  invulnTime: 0.5,
  // Regen de vida (estilo CoD): tras no recibir daño durante un delay,
  // la vida sube gradualmente hasta el máximo. Sin esto, el chip damage
  // se acumula y el juego es injugable a partir de la oleada 3-4.
  regenDelay: 5,            // segundos sin daño antes de empezar a regenerar
  regenPerSec: 25           // vida recuperada por segundo
}

// --- Granadas tácticas y letales ---
// Count inicial y máximo por tipo. Sin esto, las granadas eran infinitas
// (solo había cooldown) y el daño por área perdía todo balance.
export const GRENADES = {
  maxPerType: 3,
  startCounts: { frag: 2, flash: 2, smoke: 1, knife: 2 },
  cooldown: 0.8              // segundos entre lanzamientos
}

// --- Movimiento ---
export const MOVEMENT = {
  walk: 5.5,
  sprint: 9.5,
  crouch: 2.5,
  jump: 6.8,
  gravity: 20,
  groundAccel: 80,
  airAccel: 12,
  friction: 10,
  // Sensibilidad de ratón (rad por pixel de movimiento).
  mouseSens: 0.0022,
  mouseSensSprintMul: 0.85,
  camSmooth: 0.35
}

// --- Stamina (Fase 1.5) ---
// Sprint consume stamina; al llegar a 0 no se puede sprintar hasta
// recuperarse. Marathon (perk) ignora el consumo. La respiración del
// sniper también consume stamina (mantener Shift derecho).
export const STAMINA = {
  max: 100,                  // stamina máxima
  sprintDrainPerSec: 20,     // cuánto consume sprintar
  regenPerSec: 15,           // cuánto recupera al no sprintar
  breathDrainPerSec: 25,     // cuánto consume mantener respiración (sniper)
  breathRegenDelay: 1.5,     // delay tras soltar respiración antes de regenerar
  minToSprint: 5             // mínimo necesario para iniciar sprint
}

// --- Arsenal de armas ---
// IMPORTANTE: todos los tiempos en SEGUNDOS para consistencia interna.
// store.js convierte a ms al llamar setTimeout.
// Cada arma tiene sus stats propias para que el balance sea data-driven.
// category: 'ar' (assault rifle), 'smg', 'sniper', 'shotgun', 'lmg', 'pistol'
export const WEAPONS = {
  m4: {
    id: 'm4',
    name: 'M4 Carbine',
    category: 'ar',
    magSize: 30,
    reserveStart: 90,
    fireInterval: 0.1,      // 10 disparos/seg
    reloadTime: 1.5,
    bodyDamage: 34,
    headDamage: 100,
    raycastFar: 200,
    recoilPerShot: 0.045,
    recoilMax: 0.14,
    recoilRecover: 0.85,
    pitchKick: 0.012,
    yawKick: 0.008,
    // Fase 18.10: patrón de recoil determinista (vertical ligero derecha).
    recoilPattern: [
      [0, 1.0], [0.1, 1.0], [0.2, 0.9], [0.3, 0.9], [0.2, 0.8],
      [0.1, 0.8], [0, 0.7], [-0.1, 0.7], [-0.2, 0.6], [-0.3, 0.6],
      [-0.2, 0.5], [-0.1, 0.5], [0, 0.5], [0.1, 0.4], [0.2, 0.4],
      [0.3, 0.4], [0.2, 0.3], [0.1, 0.3], [0, 0.3], [-0.1, 0.3]
    ],
    adsTime: 0.25,           // tiempo de ADS (segundos)
    adsFov: 45,              // FOV al apuntar
    hipFireSpread: 1.0,      // multiplicador de spread hipfire
    adsSpread: 0.1,          // multiplicador de spread en ADS
    adsSensMul: 0.6,         // reducción de sensibilidad al apuntar
    moveSpeedMul: 1.0,       // multiplicador de velocidad al llevarla
    automatic: true,
    // Fase 18.11: damage dropoff por rango (distancia en metros, multiplicador).
    damageRange: [
      { min: 0, max: 30, mul: 1.0 },
      { min: 30, max: 60, mul: 0.85 },
      { min: 60, max: 999, mul: 0.7 }
    ],
    minWave: 1               // disponible desde el inicio
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    category: 'ar',
    magSize: 30,
    reserveStart: 90,
    fireInterval: 0.11,
    reloadTime: 1.8,
    bodyDamage: 40,
    headDamage: 120,
    raycastFar: 200,
    recoilPerShot: 0.06,
    recoilMax: 0.18,
    recoilRecover: 0.82,
    pitchKick: 0.016,
    yawKick: 0.011,
    // Fase 18.10: AK47 — vertical fuerte izquierda.
    recoilPattern: [
      [0, 1.3], [-0.1, 1.3], [-0.2, 1.2], [-0.3, 1.2], [-0.4, 1.1],
      [-0.3, 1.0], [-0.2, 0.9], [-0.1, 0.9], [0, 0.8], [0.1, 0.8],
      [0.2, 0.7], [0.3, 0.7], [0.2, 0.6], [0.1, 0.6], [0, 0.5],
      [-0.1, 0.5], [-0.2, 0.4], [-0.3, 0.4], [-0.2, 0.4], [-0.1, 0.4]
    ],
    adsTime: 0.28,
    adsFov: 45,
    hipFireSpread: 1.1,
    adsSpread: 0.12,
    adsSensMul: 0.6,
    moveSpeedMul: 0.97,
    automatic: true,
    minWave: 1
  },
  mp5: {
    id: 'mp5',
    name: 'MP5 SMG',
    category: 'smg',
    magSize: 30,
    reserveStart: 120,
    fireInterval: 0.08,      // 12.5 disparos/seg
    reloadTime: 1.2,
    bodyDamage: 25,
    headDamage: 75,
    raycastFar: 120,
    recoilPerShot: 0.03,
    recoilMax: 0.1,
    recoilRecover: 0.88,
    pitchKick: 0.008,
    yawKick: 0.006,
    // Fase 18.10: MP5 — saltos cortos horizontales.
    recoilPattern: [
      [0.2, 0.7], [-0.2, 0.7], [0.3, 0.6], [-0.3, 0.6], [0.2, 0.5],
      [-0.2, 0.5], [0.1, 0.5], [-0.1, 0.4], [0.2, 0.4], [-0.2, 0.4],
      [0.3, 0.3], [-0.3, 0.3], [0.1, 0.3], [-0.1, 0.3], [0.2, 0.3],
      [-0.2, 0.3], [0.1, 0.2], [-0.1, 0.2], [0, 0.2], [0, 0.2]
    ],
    adsTime: 0.18,
    adsFov: 50,
    hipFireSpread: 0.7,
    adsSpread: 0.08,
    adsSensMul: 0.65,
    moveSpeedMul: 1.1,
    automatic: true,
    minWave: 1
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Rifle',
    category: 'sniper',
    magSize: 5,
    reserveStart: 25,
    fireInterval: 1.2,       // bolt-action lento
    reloadTime: 2.5,
    bodyDamage: 150,
    headDamage: 500,         // headshot instantáneo
    raycastFar: 400,
    recoilPerShot: 0.2,
    recoilMax: 0.3,
    recoilRecover: 0.7,
    pitchKick: 0.05,
    yawKick: 0.02,
    // Fase 18.10: Sniper — kick fuerte single-shot.
    recoilPattern: [[0, 2.0]],
    adsTime: 0.4,
    adsFov: 20,              // zoom fuerte
    hipFireSpread: 3.0,      // muy impreciso sin apuntar
    adsSpread: 0.0,          // perfecta al apuntar
    adsSensMul: 0.3,
    moveSpeedMul: 0.85,
    automatic: false,        // bolt-action: un click = un disparo
    minWave: 1
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    category: 'shotgun',
    magSize: 7,
    reserveStart: 35,
    fireInterval: 0.7,
    reloadTime: 3.0,
    bodyDamage: 20,          // por pellet (8 pellets)
    headDamage: 40,
    raycastFar: 60,          // corto alcance
    recoilPerShot: 0.12,
    recoilMax: 0.25,
    recoilRecover: 0.75,
    pitchKick: 0.04,
    yawKick: 0.02,
    // Fase 18.10: Shotgun — spread horizontal amplio.
    recoilPattern: [[0.5, 1.5], [-0.5, 1.5], [0.3, 1.5], [-0.3, 1.5]],
    adsTime: 0.3,
    adsFov: 55,
    hipFireSpread: 0.5,
    adsSpread: 0.3,
    adsSensMul: 0.7,
    moveSpeedMul: 0.95,
    automatic: false,
    pellets: 8,              // dispara 8 rayos por disparo
    minWave: 1
  },
  lmg: {
    id: 'lmg',
    name: 'LMG',
    category: 'lmg',
    magSize: 100,
    reserveStart: 200,
    fireInterval: 0.09,
    reloadTime: 4.0,
    bodyDamage: 30,
    headDamage: 90,
    raycastFar: 250,
    recoilPerShot: 0.04,
    recoilMax: 0.16,
    recoilRecover: 0.83,
    pitchKick: 0.011,
    yawKick: 0.009,
    // Fase 18.10: LMG — vertical constante.
    recoilPattern: [
      [0, 0.9], [0, 0.9], [0.05, 0.9], [0.05, 0.9], [0.1, 0.8],
      [0.1, 0.8], [0.05, 0.8], [0.05, 0.8], [0, 0.7], [0, 0.7],
      [-0.05, 0.7], [-0.05, 0.7], [-0.1, 0.6], [-0.1, 0.6], [-0.05, 0.6],
      [-0.05, 0.6], [0, 0.6], [0, 0.6], [0.05, 0.6], [0.05, 0.6]
    ],
    adsTime: 0.35,
    adsFov: 48,
    hipFireSpread: 1.3,
    adsSpread: 0.15,
    adsSensMul: 0.55,
    moveSpeedMul: 0.8,
    automatic: true,
    minWave: 1
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    category: 'pistol',
    magSize: 12,
    reserveStart: 48,
    fireInterval: 0.15,
    reloadTime: 1.0,
    bodyDamage: 28,
    headDamage: 80,
    raycastFar: 100,
    recoilPerShot: 0.035,
    recoilMax: 0.1,
    recoilRecover: 0.9,
    pitchKick: 0.01,
    yawKick: 0.007,
    // Fase 18.10: Pistol — kick moderado.
    recoilPattern: [
      [0, 0.8], [0.1, 0.8], [-0.1, 0.7], [0.1, 0.7], [-0.1, 0.6],
      [0, 0.6], [0.1, 0.5], [-0.1, 0.5], [0, 0.5], [0.05, 0.4]
    ],
    adsTime: 0.15,
    adsFov: 55,
    hipFireSpread: 0.8,
    adsSpread: 0.1,
    adsSensMul: 0.7,
    moveSpeedMul: 1.15,
    automatic: false,
    minWave: 1
  },
  kilo141: {
    id: 'kilo141', name: 'Kilo 141', category: 'ar',
    magSize: 30, reserveStart: 120, fireInterval: 0.105, reloadTime: 1.6,
    bodyDamage: 32, headDamage: 96, raycastFar: 200,
    recoilPerShot: 0.035, recoilMax: 0.12, recoilRecover: 0.88,
    pitchKick: 0.01, yawKick: 0.006, adsTime: 0.26, adsFov: 45,
    hipFireSpread: 0.9, adsSpread: 0.1, adsSensMul: 0.6,
    moveSpeedMul: 1.0, automatic: true, minWave: 1
  },
  grau: {
    id: 'grau', name: 'Grau 5.56', category: 'ar',
    magSize: 30, reserveStart: 120, fireInterval: 0.095, reloadTime: 1.55,
    bodyDamage: 30, headDamage: 90, raycastFar: 220,
    recoilPerShot: 0.03, recoilMax: 0.1, recoilRecover: 0.9,
    pitchKick: 0.009, yawKick: 0.005, adsTime: 0.24, adsFov: 45,
    hipFireSpread: 0.95, adsSpread: 0.09, adsSensMul: 0.6,
    moveSpeedMul: 1.02, automatic: true, minWave: 1
  },
  fr556: {
    id: 'fr556', name: 'FR 5.56', category: 'ar',
    magSize: 30, reserveStart: 90, fireInterval: 0.12, reloadTime: 1.7,
    bodyDamage: 44, headDamage: 132, raycastFar: 200,
    recoilPerShot: 0.055, recoilMax: 0.16, recoilRecover: 0.84,
    pitchKick: 0.014, yawKick: 0.01, adsTime: 0.27, adsFov: 45,
    hipFireSpread: 1.0, adsSpread: 0.11, adsSensMul: 0.6,
    moveSpeedMul: 0.98, automatic: false, burst: 3, minWave: 1
  },
  oden: {
    id: 'oden', name: 'Oden', category: 'ar',
    magSize: 21, reserveStart: 84, fireInterval: 0.14, reloadTime: 2.0,
    bodyDamage: 55, headDamage: 165, raycastFar: 200,
    recoilPerShot: 0.07, recoilMax: 0.2, recoilRecover: 0.8,
    pitchKick: 0.018, yawKick: 0.012, adsTime: 0.32, adsFov: 45,
    hipFireSpread: 1.2, adsSpread: 0.13, adsSensMul: 0.55,
    moveSpeedMul: 0.94, automatic: true, minWave: 1
  },
  mp7: {
    id: 'mp7', name: 'MP7', category: 'smg',
    magSize: 40, reserveStart: 160, fireInterval: 0.07, reloadTime: 1.3,
    bodyDamage: 22, headDamage: 66, raycastFar: 110,
    recoilPerShot: 0.025, recoilMax: 0.08, recoilRecover: 0.9,
    pitchKick: 0.007, yawKick: 0.005, adsTime: 0.17, adsFov: 50,
    hipFireSpread: 0.65, adsSpread: 0.08, adsSensMul: 0.65,
    moveSpeedMul: 1.12, automatic: true, minWave: 1
  },
  p90: {
    id: 'p90', name: 'P90', category: 'smg',
    magSize: 50, reserveStart: 150, fireInterval: 0.075, reloadTime: 1.6,
    bodyDamage: 20, headDamage: 60, raycastFar: 110,
    recoilPerShot: 0.028, recoilMax: 0.09, recoilRecover: 0.88,
    pitchKick: 0.008, yawKick: 0.006, adsTime: 0.2, adsFov: 50,
    hipFireSpread: 0.7, adsSpread: 0.09, adsSensMul: 0.65,
    moveSpeedMul: 1.1, automatic: true, minWave: 1
  },
  uzi: {
    id: 'uzi', name: 'Uzi', category: 'smg',
    magSize: 32, reserveStart: 128, fireInterval: 0.08, reloadTime: 1.4,
    bodyDamage: 27, headDamage: 81, raycastFar: 115,
    recoilPerShot: 0.032, recoilMax: 0.1, recoilRecover: 0.87,
    pitchKick: 0.009, yawKick: 0.007, adsTime: 0.19, adsFov: 50,
    hipFireSpread: 0.75, adsSpread: 0.1, adsSensMul: 0.65,
    moveSpeedMul: 1.13, automatic: true, minWave: 1
  },
  aug: {
    id: 'aug', name: 'AUG', category: 'smg',
    magSize: 25, reserveStart: 100, fireInterval: 0.085, reloadTime: 1.5,
    bodyDamage: 29, headDamage: 87, raycastFar: 130,
    recoilPerShot: 0.029, recoilMax: 0.09, recoilRecover: 0.89,
    pitchKick: 0.008, yawKick: 0.006, adsTime: 0.21, adsFov: 50,
    hipFireSpread: 0.8, adsSpread: 0.1, adsSensMul: 0.64,
    moveSpeedMul: 1.08, automatic: true, minWave: 1
  },
  m91: {
    id: 'm91', name: 'M91', category: 'lmg',
    magSize: 100, reserveStart: 300, fireInterval: 0.085, reloadTime: 4.5,
    bodyDamage: 32, headDamage: 96, raycastFar: 250,
    recoilPerShot: 0.038, recoilMax: 0.15, recoilRecover: 0.84,
    pitchKick: 0.011, yawKick: 0.008, adsTime: 0.38, adsFov: 48,
    hipFireSpread: 1.2, adsSpread: 0.14, adsSensMul: 0.55,
    moveSpeedMul: 0.78, automatic: true, minWave: 1
  },
  pkm: {
    id: 'pkm', name: 'PKM', category: 'lmg',
    magSize: 100, reserveStart: 200, fireInterval: 0.1, reloadTime: 5.0,
    bodyDamage: 38, headDamage: 114, raycastFar: 260,
    recoilPerShot: 0.045, recoilMax: 0.17, recoilRecover: 0.82,
    pitchKick: 0.013, yawKick: 0.009, adsTime: 0.4, adsFov: 48,
    hipFireSpread: 1.3, adsSpread: 0.15, adsSensMul: 0.54,
    moveSpeedMul: 0.76, automatic: true, minWave: 1
  },
  model680: {
    id: 'model680', name: 'Model 680', category: 'shotgun',
    magSize: 6, reserveStart: 30, fireInterval: 0.8, reloadTime: 2.5,
    bodyDamage: 22, headDamage: 44, raycastFar: 55,
    recoilPerShot: 0.13, recoilMax: 0.26, recoilRecover: 0.74,
    pitchKick: 0.042, yawKick: 0.022, adsTime: 0.32, adsFov: 55,
    hipFireSpread: 0.5, adsSpread: 0.3, adsSensMul: 0.7,
    moveSpeedMul: 0.96, automatic: false, pellets: 8, minWave: 1
  },
  r90: {
    id: 'r90', name: 'R9-0', category: 'shotgun',
    magSize: 8, reserveStart: 32, fireInterval: 0.5, reloadTime: 3.2,
    bodyDamage: 18, headDamage: 36, raycastFar: 50,
    recoilPerShot: 0.1, recoilMax: 0.22, recoilRecover: 0.78,
    pitchKick: 0.035, yawKick: 0.018, adsTime: 0.28, adsFov: 55,
    hipFireSpread: 0.55, adsSpread: 0.32, adsSensMul: 0.72,
    moveSpeedMul: 0.98, automatic: false, pellets: 10, burst: 2, minWave: 1
  },
  hdr: {
    id: 'hdr', name: 'HDR', category: 'sniper',
    magSize: 7, reserveStart: 35, fireInterval: 1.4, reloadTime: 2.8,
    bodyDamage: 160, headDamage: 500, raycastFar: 450,
    recoilPerShot: 0.22, recoilMax: 0.32, recoilRecover: 0.68,
    pitchKick: 0.055, yawKick: 0.022, adsTime: 0.42, adsFov: 18,
    hipFireSpread: 3.2, adsSpread: 0.0, adsSensMul: 0.28,
    moveSpeedMul: 0.84, automatic: false, minWave: 1
  },
  ax50: {
    id: 'ax50', name: 'AX-50', category: 'sniper',
    magSize: 5, reserveStart: 25, fireInterval: 1.1, reloadTime: 2.6,
    bodyDamage: 145, headDamage: 500, raycastFar: 420,
    recoilPerShot: 0.19, recoilMax: 0.28, recoilRecover: 0.72,
    pitchKick: 0.048, yawKick: 0.02, adsTime: 0.38, adsFov: 20,
    hipFireSpread: 2.8, adsSpread: 0.0, adsSensMul: 0.3,
    moveSpeedMul: 0.86, automatic: false, minWave: 1
  },
  ebr14: {
    id: 'ebr14', name: 'EBR-14', category: 'marksman',
    magSize: 10, reserveStart: 40, fireInterval: 0.2, reloadTime: 2.0,
    bodyDamage: 70, headDamage: 210, raycastFar: 280,
    recoilPerShot: 0.08, recoilMax: 0.18, recoilRecover: 0.82,
    pitchKick: 0.02, yawKick: 0.01, adsTime: 0.3, adsFov: 35,
    hipFireSpread: 1.5, adsSpread: 0.05, adsSensMul: 0.5,
    moveSpeedMul: 0.95, automatic: false, minWave: 1
  },
  mk2: {
    id: 'mk2', name: 'MK2 Carbine', category: 'marksman',
    magSize: 8, reserveStart: 32, fireInterval: 0.4, reloadTime: 1.8,
    bodyDamage: 75, headDamage: 225, raycastFar: 250,
    recoilPerShot: 0.1, recoilMax: 0.2, recoilRecover: 0.8,
    pitchKick: 0.025, yawKick: 0.012, adsTime: 0.28, adsFov: 38,
    hipFireSpread: 1.4, adsSpread: 0.06, adsSensMul: 0.52,
    moveSpeedMul: 0.98, automatic: false, minWave: 1
  },
  kar98k: {
    id: 'kar98k', name: 'Kar98k', category: 'marksman',
    magSize: 5, reserveStart: 25, fireInterval: 0.6, reloadTime: 2.2,
    bodyDamage: 90, headDamage: 270, raycastFar: 300,
    recoilPerShot: 0.12, recoilMax: 0.22, recoilRecover: 0.78,
    pitchKick: 0.028, yawKick: 0.014, adsTime: 0.32, adsFov: 35,
    hipFireSpread: 1.6, adsSpread: 0.05, adsSensMul: 0.5,
    moveSpeedMul: 0.97, automatic: false, minWave: 1
  },
  x16: {
    id: 'x16', name: 'X16', category: 'pistol',
    magSize: 15, reserveStart: 60, fireInterval: 0.12, reloadTime: 1.1,
    bodyDamage: 26, headDamage: 78, raycastFar: 100,
    recoilPerShot: 0.03, recoilMax: 0.09, recoilRecover: 0.9,
    pitchKick: 0.009, yawKick: 0.006, adsTime: 0.16, adsFov: 55,
    hipFireSpread: 0.75, adsSpread: 0.1, adsSensMul: 0.7,
    moveSpeedMul: 1.16, automatic: false, minWave: 1
  },
  deagle: {
    id: 'deagle', name: 'Desert Eagle', category: 'pistol',
    magSize: 7, reserveStart: 28, fireInterval: 0.2, reloadTime: 1.4,
    bodyDamage: 55, headDamage: 165, raycastFar: 110,
    recoilPerShot: 0.06, recoilMax: 0.15, recoilRecover: 0.84,
    pitchKick: 0.018, yawKick: 0.012, adsTime: 0.2, adsFov: 50,
    hipFireSpread: 0.9, adsSpread: 0.12, adsSensMul: 0.65,
    moveSpeedMul: 1.12, automatic: false, minWave: 1
  },
  rpg: {
    id: 'rpg', name: 'RPG-7', category: 'launcher',
    magSize: 1, reserveStart: 3, fireInterval: 1.5, reloadTime: 3.5,
    bodyDamage: 200, headDamage: 200, raycastFar: 200,
    recoilPerShot: 0.3, recoilMax: 0.4, recoilRecover: 0.6,
    pitchKick: 0.08, yawKick: 0.04, adsTime: 0.5, adsFov: 60,
    hipFireSpread: 1.0, adsSpread: 0.0, adsSensMul: 0.6,
    moveSpeedMul: 0.85, automatic: false, projectile: true,
    explosionRadius: 6, explosionDamage: 200, minWave: 1
  },
  pila: {
    id: 'pila', name: 'PILA', category: 'launcher',
    magSize: 1, reserveStart: 2, fireInterval: 1.2, reloadTime: 3.0,
    bodyDamage: 180, headDamage: 180, raycastFar: 250,
    recoilPerShot: 0.25, recoilMax: 0.35, recoilRecover: 0.65,
    pitchKick: 0.07, yawKick: 0.03, adsTime: 0.45, adsFov: 55,
    hipFireSpread: 0.9, adsSpread: 0.0, adsSensMul: 0.6,
    moveSpeedMul: 0.88, automatic: false, projectile: true,
    explosionRadius: 5, explosionDamage: 180, lockOn: true, minWave: 1
  }
}

export const WEAPON_PLATFORMS = {
  ar_m4: { name: 'M4 Platform', receiver: 'm4', members: ['m4', 'kilo141', 'grau', 'fr556'] },
  ar_ak: { name: 'AK Platform', receiver: 'ak47', members: ['ak47', 'oden'] },
  smg_mp5: { name: 'MP5 Platform', receiver: 'mp5', members: ['mp5', 'mp7', 'aug'] },
  smg_uzi: { name: 'Uzi Platform', receiver: 'uzi', members: ['uzi', 'p90'] },
  lmg_m91: { name: 'M91 Platform', receiver: 'm91', members: ['m91', 'pkm'] },
  shotgun_680: { name: 'Model 680 Platform', receiver: 'model680', members: ['model680', 'r90'] },
  sniper_hdr: { name: 'HDR Platform', receiver: 'hdr', members: ['hdr', 'ax50'] },
  marksman_ebr: { name: 'EBR Platform', receiver: 'ebr14', members: ['ebr14', 'mk2'] },
  marksman_kar: { name: 'Kar98k Platform', receiver: 'kar98k', members: ['kar98k'] },
  pistol_x16: { name: 'X16 Platform', receiver: 'x16', members: ['x16', 'deagle'] },
  launcher_rpg: { name: 'RPG Platform', receiver: 'rpg', members: ['rpg', 'pila'] }
}

// WEAPON: alias del arma por defecto (M4) para compatibilidad con código
// existente que importa WEAPON directamente.
export const WEAPON = WEAPONS.m4

// Fase 18.11: damage dropoff por rango por defecto (si el arma no define damageRange).
export const DEFAULT_DAMAGE_RANGE = [
  { min: 0, max: 30, mul: 1.0 },
  { min: 30, max: 60, mul: 0.85 },
  { min: 60, max: 999, mul: 0.7 }
]

// --- Multiplicadores de daño por zona (Fase 1.3) ---
// CoD usa head×4, neck×2, chest×1, stomach×1.1, limbs×0.8.
// Se aplican sobre el bodyDamage/headDamage del arma.
export const DAMAGE_MULTIPLIERS = {
  head: 4.0,
  neck: 2.0,
  chest: 1.0,
  stomach: 1.1,
  arm: 0.8,
  leg: 0.8
}

// --- Penetración de balas (Fase 1.3) ---
// Multiplicador de daño al atravesar un collider antes de golpear al enemío.
// wall = muro de piedra/sillar (poca penetración), crate = madera/metal.
export const PENETRATION = {
  wall: 0.3,
  crate: 0.6
}

// --- Perks (Fase 1.4) ---
// Cada perk tiene un id, name, descripción y un efecto data-driven.
// Los efectos se aplican en loadout.js (modifican stats del arma o del
// player en runtime).
export const PERKS = {
  scavenger: {
    id: 'scavenger',
    name: 'Scavenger',
    desc: 'Recoge munición de enemigos muertos',
    category: 'blue',
    // Sin efecto estadístico directo: lo maneja el engine al matar.
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    desc: 'Invisible al UAV enemigo',
    category: 'blue'
  },
  coldBlooded: {
    id: 'coldBlooded',
    name: 'Cold-Blooded',
    desc: 'Sin hitmarker rojo al recibir daño',
    category: 'blue'
  },
  sleightOfHand: {
    id: 'sleightOfHand',
    name: 'Sleight of Hand',
    desc: 'Recarga 2x más rápido',
    category: 'red',
    // Effect: reloadTime × 0.5
    reloadTimeMul: 0.5
  },
  marathon: {
    id: 'marathon',
    name: 'Marathon',
    desc: 'Sprint infinito (sin stamina)',
    category: 'red',
    infiniteSprint: true
  },
  lightweight: {
    id: 'lightweight',
    name: 'Lightweight',
    desc: 'Movimiento 10% más rápido',
    category: 'red',
    moveSpeedMul: 1.1
  },
  deadSilence: {
    id: 'deadSilence',
    name: 'Dead Silence',
    desc: 'Pasos silenciosos',
    category: 'green'
  },
  ninja: {
    id: 'ninja',
    name: 'Ninja',
    desc: 'Cambio de arma silencioso',
    category: 'green'
  },
  commando: {
    id: 'commando',
    name: 'Commando',
    desc: 'Mayor distancia de melee',
    category: 'green',
    meleeRangeMul: 1.5
  },
  steadyAim: {
    id: 'steadyAim',
    name: 'Steady Aim',
    desc: 'Hipfire más preciso',
    category: 'red',
    hipFireSpreadMul: 0.7
  },
  stoppingPower: {
    id: 'stoppingPower',
    name: 'Stopping Power',
    desc: 'Daño +25%',
    category: 'red',
    damageMul: 1.25
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'Juggernaut',
    desc: 'Vida +50',
    category: 'blue',
    healthBonus: 50
  },
  // Fase 18.19: 10 perks nuevos.
  restock: {
    id: 'restock',
    name: 'Restock',
    desc: 'Resupplies equipment over time',
    category: 'blue',
    restockInterval: 8
  },
  oneShot: {
    id: 'oneShot',
    name: 'One Shot',
    desc: 'Sniper body-shot kill if full health',
    category: 'blue',
    oneShotKill: true
  },
  highAlert: {
    id: 'highAlert',
    name: 'High Alert',
    desc: 'Vision pulses when enemy aims at you',
    category: 'blue',
    highAlert: true
  },
  tracker: {
    id: 'tracker',
    name: 'Tracker',
    desc: 'See enemy footprints',
    category: 'blue',
    tracker: true
  },
  battleHardened: {
    id: 'battleHardened',
    name: 'Battle Hardened',
    desc: 'Reduce flash/stun duration 50%',
    category: 'blue',
    flashResist: 0.5
  },
  eod: {
    id: 'eod',
    name: 'EOD',
    desc: 'Explosive damage reduction 50%',
    category: 'blue',
    explosiveResist: 0.5
  },
  doubleTime: {
    id: 'doubleTime',
    name: 'Double Time',
    desc: 'Tactical sprint duration x2',
    category: 'red',
    tacSprintMul: 2.0
  },
  overkill: {
    id: 'overkill',
    name: 'Overkill',
    desc: 'Carry two primary weapons',
    category: 'red',
    overkill: true
  },
  hardline: {
    id: 'hardline',
    name: 'Hardline',
    desc: 'Killstreaks cost 1 less kill',
    category: 'red',
    streakBonus: 1
  },
  killChain: {
    id: 'killChain',
    name: 'Kill Chain',
    desc: 'Kills count double toward streaks',
    category: 'red',
    streakKillMul: 2
  }
}

// --- Attachments (Fase 1.4) ---
// Cada attachment modifica stats del arma equipada. Se aplican en
// loadout.js al equipar el arma (combinando WEAPON base + attachments).
export const ATTACHMENTS = {
  reddot: {
    id: 'reddot', name: 'Red Dot Sight', slot: 'sight',
    adsSpreadMul: 0.5, adsTimeMul: 0.9
  },
  holographic: {
    id: 'holographic', name: 'Holographic Sight', slot: 'sight',
    adsSpreadMul: 0.4
  },
  acog: {
    id: 'acog', name: 'ACOG Scope', slot: 'sight',
    adsFovMul: 0.7, adsTimeMul: 1.2
  },
  vlk: {
    id: 'vlk', name: 'VLK 3.0x Optic', slot: 'sight',
    adsFovMul: 0.6, adsSpreadMul: 0.3, adsTimeMul: 1.25
  },
  cronen: {
    id: 'cronen', name: 'Cronen Mini Pro', slot: 'sight',
    adsSpreadMul: 0.45, adsTimeMul: 0.95
  },
  sniperScope: {
    id: 'sniperScope', name: 'Sniper Scope', slot: 'sight',
    adsFovMul: 0.5, adsSpreadMul: 0.0, adsTimeMul: 1.4
  },
  thermal: {
    id: 'thermal', name: 'Thermal Scope', slot: 'sight',
    adsFovMul: 0.7, adsSpreadMul: 0.2, adsTimeMul: 1.3, thermal: true
  },
  suppressor: {
    id: 'suppressor', name: 'Suppressor', slot: 'barrel',
    damageMul: 0.9, raycastFarMul: 0.95
  },
  compensator: {
    id: 'compensator', name: 'Compensator', slot: 'barrel',
    recoilMul: 0.6
  },
  muzzleBrake: {
    id: 'muzzleBrake', name: 'Muzzle Brake', slot: 'barrel',
    recoilMul: 0.7, yawKickMul: 0.6
  },
  flashGuard: {
    id: 'flashGuard', name: 'Flash Guard', slot: 'barrel',
    muzzleFlashReduction: 0.8
  },
  fmj: {
    id: 'fmj', name: 'FMJ', slot: 'barrel',
    penetrationMul: 1.5
  },
  longBarrel: {
    id: 'longBarrel', name: 'Long Barrel', slot: 'barrel',
    raycastFarMul: 1.15, damageMul: 1.05, adsTimeMul: 1.1
  },
  shortBarrel: {
    id: 'shortBarrel', name: 'Short Barrel', slot: 'barrel',
    raycastFarMul: 0.85, moveSpeedMul: 1.05, adsTimeMul: 0.9
  },
  foregrip: {
    id: 'foregrip', name: 'Foregrip', slot: 'underbarrel',
    recoilMul: 0.7, hipFireSpreadMul: 0.8
  },
  laser: {
    id: 'laser', name: 'Laser Sight', slot: 'underbarrel',
    hipFireSpreadMul: 0.6
  },
  tacLaser: {
    id: 'tacLaser', name: 'Tac Laser', slot: 'underbarrel',
    adsSpreadMul: 0.5, adsTimeMul: 0.9
  },
  bipod: {
    id: 'bipod', name: 'Bipod', slot: 'underbarrel',
    recoilMul: 0.5, adsSpreadMul: 0.5, requiresCrouch: true
  },
  grenadeLauncher: {
    id: 'grenadeLauncher', name: 'Grenade Launcher', slot: 'underbarrel',
    secondaryFire: 'frag'
  },
  extendedmags: {
    id: 'extendedmags', name: 'Extended Mags', slot: 'mag',
    magSizeMul: 1.5, reloadTimeMul: 1.1
  },
  fastMag: {
    id: 'fastMag', name: 'Fast Mag', slot: 'mag',
    reloadTimeMul: 0.6, magSizeMul: 1.1
  },
  drumMag: {
    id: 'drumMag', name: 'Drum Mag', slot: 'mag',
    magSizeMul: 2.0, reloadTimeMul: 1.3, moveSpeedMul: 0.95
  },
  quickdraw: {
    id: 'quickdraw', name: 'Quickdraw Handle', slot: 'stock',
    adsTimeMul: 0.7
  },
  stock: {
    id: 'stock', name: 'Stock', slot: 'stock',
    moveSpeedMul: 1.05
  },
  noStock: {
    id: 'noStock', name: 'No Stock', slot: 'stock',
    moveSpeedMul: 1.1, adsSpreadMul: 1.2
  },
  heavyStock: {
    id: 'heavyStock', name: 'Heavy Stock', slot: 'stock',
    recoilMul: 0.85, moveSpeedMul: 0.92
  },
  rubberized: {
    id: 'rubberized', name: 'Rubberized Grip Tape', slot: 'stock',
    recoilMul: 0.9, adsSpreadMul: 0.9
  },
  perkSleightOfHand: {
    id: 'perkSleightOfHand', name: 'Sleight of Hand (perk)', slot: 'perk',
    reloadTimeMul: 0.7
  },
  perkFrangible: {
    id: 'perkFrangible', name: 'Frangible - Wounding', slot: 'perk',
    damageMul: 1.05, slowOnHit: true
  },
  perkHeavy: {
    id: 'perkHeavy', name: 'Heavy Hitter', slot: 'perk',
    damageMul: 1.1, recoilMul: 1.1
  },
  perkFastHands: {
    id: 'perkFastHands', name: 'Fast Hands', slot: 'perk',
    reloadTimeMul: 0.8, adsTimeMul: 0.9
  },
  perkRecon: {
    id: 'perkRecon', name: 'Recon', slot: 'perk',
    markOnHit: true
  },
  perkMoMoney: {
    id: 'perkMoMoney', name: "Mo' Money", slot: 'perk',
    scoreMul: 1.5
  },
  perkFMJ: {
    id: 'perkFMJ', name: 'FMJ (perk)', slot: 'perk',
    penetrationMul: 1.5
  },
  perkBurst: {
    id: 'perkBurst', name: 'Burst', slot: 'perk',
    burst: 3, fireIntervalMul: 0.6
  }
}

export const ATTACHMENT_SLOTS = ['sight', 'barrel', 'underbarrel', 'mag', 'stock', 'perk']

export const FIELD_UPGRADES = {
  trophySystem: {
    id: 'trophySystem', name: 'Trophy System',
    desc: 'Destruye hasta 3 granadas/proyectiles enemigos en 8m',
    cooldown: 60, duration: 30, charges: 3, radius: 8
  },
  deadSilenceField: {
    id: 'deadSilenceField', name: 'Dead Silence',
    desc: 'Pasos silenciosos para todo el equipo durante 30s',
    cooldown: 90, duration: 30, teamWide: true
  },
  emp: {
    id: 'emp', name: 'EMP',
    desc: 'Desactiva electrónicos enemigos (UAV, killstreaks) en 12s',
    cooldown: 120, duration: 12, radius: 50
  },
  deployableCover: {
    id: 'deployableCover', name: 'Deployable Cover',
    desc: 'Despliega un escudo balístico portátil',
    cooldown: 45, duration: 60, hp: 200
  },
  reconDrone: {
    id: 'reconDrone', name: 'Recon Drone',
    desc: 'Pilotea un drone que marca enemigos en 20m',
    cooldown: 90, duration: 15, radius: 20
  },
  munitionsBox: {
    id: 'munitionsBox', name: 'Munitions Box',
    desc: 'Caja que reabastece munición y granadas al equipo',
    cooldown: 60, duration: 30, radius: 5
  },
  reconTower: {
    id: 'reconTower', name: 'Recon Tower',
    desc: 'Torre que revela enemigos en el minimap durante 20s',
    cooldown: 100, duration: 20, radius: 40
  },
  suppressingDrone: {
    id: 'suppressingDrone', name: 'Suppressing Drone',
    desc: 'Drone que suprime a enemigos cercanos (10m) durante 15s',
    cooldown: 80, duration: 15, radius: 10
  }
}

export const GRENADE_TYPES = {
  tactical: {
    frag: { id: 'frag', name: 'Frag', type: 'lethal', damage: 150, radius: 5, fuse: 3 },
    semtex: { id: 'semtex', name: 'Semtex', type: 'lethal', damage: 140, radius: 4.5, fuse: 2.5, sticky: true },
    thermite: { id: 'thermite', name: 'Thermite', type: 'lethal', damage: 30, radius: 3, fuse: 1, dotDuration: 5 },
    molotov: { id: 'molotov', name: 'Molotov', type: 'lethal', damage: 25, radius: 4, fuse: 1, dotDuration: 8, fireSpread: true },
    c4: { id: 'c4', name: 'C4', type: 'lethal', damage: 180, radius: 5, fuse: 0, remote: true },
    claymore: { id: 'claymore', name: 'Claymore', type: 'lethal', damage: 200, radius: 5, fuse: 0, trigger: 'proximity' },
    throwingKnife: { id: 'throwingKnife', name: 'Throwing Knife', type: 'lethal', damage: 130, radius: 0, fuse: 0, retrievable: true },
    shuriken: { id: 'shuriken', name: 'Shuriken', type: 'lethal', damage: 80, radius: 0, fuse: 0, retrievable: true, chargeable: true },
    flash: { id: 'flash', name: 'Flashbang', type: 'tactical', damage: 0, radius: 8, fuse: 1.5, effect: 'flash', duration: 3 },
    stun: { id: 'stun', name: 'Stun Grenade', type: 'tactical', damage: 0, radius: 7, fuse: 1.5, effect: 'stun', duration: 4 },
    gas: { id: 'gas', name: 'Gas Grenade', type: 'tactical', damage: 5, radius: 6, fuse: 1.5, effect: 'gas', duration: 8 },
    smoke: { id: 'smoke', name: 'Smoke Grenade', type: 'tactical', damage: 0, radius: 6, fuse: 1.5, effect: 'smoke', duration: 15 },
    decoy: { id: 'decoy', name: 'Decoy Grenade', type: 'tactical', damage: 0, radius: 3, fuse: 1.5, effect: 'decoy', duration: 10 },
    snapshot: { id: 'snapshot', name: 'Snapshot Grenade', type: 'tactical', damage: 0, radius: 8, fuse: 1.5, effect: 'snapshot', duration: 2 },
    stim: { id: 'stim', name: 'Stim', type: 'tactical', damage: 0, radius: 0, fuse: 0, effect: 'heal', healAmount: 50 }
  }
}

// --- Killstreaks catálogo (Fase 18.28) ---
// cost = kills necesarias, category = assault (resetea en death) | support (no resetea)
export const STREAKS = {
  uav: { id: 'uav', name: 'UAV', cost: 3, category: 'assault' },
  cuav: { id: 'cuav', name: 'Counter UAV', cost: 4, category: 'assault' },
  personalRadar: { id: 'personalRadar', name: 'Personal Radar', cost: 4, category: 'assault' },
  airstrike: { id: 'airstrike', name: 'Airstrike', cost: 5, category: 'assault' },
  carePackage: { id: 'carePackage', name: 'Care Package', cost: 5, category: 'assault' },
  hunterKiller: { id: 'hunterKiller', name: 'Hunter Killer', cost: 5, category: 'assault' },
  heli: { id: 'heli', name: 'Attack Heli', cost: 7, category: 'assault' },
  predator: { id: 'predator', name: 'Predator Missile', cost: 7, category: 'assault' },
  sentryGun: { id: 'sentryGun', name: 'Sentry Gun', cost: 8, category: 'assault' },
  emp: { id: 'emp', name: 'EMP', cost: 9, category: 'assault' },
  gunship: { id: 'gunship', name: 'Gunship', cost: 11, category: 'assault' },
  ac130: { id: 'ac130', name: 'AC130', cost: 12, category: 'assault' },
  juggernaut: { id: 'juggernaut', name: 'Juggernaut', cost: 12, category: 'assault' },
  tacticalNuke: { id: 'tacticalNuke', name: 'Tactical Nuke', cost: 25, category: 'assault' }
}

// --- Loadout por defecto (Fase 1.4) ---
// El loadout inicial del jugador cuando empieza una partida nueva sin
// haber configurado nada. Se puede cambiar en el menú Create-a-class.
export const DEFAULT_LOADOUT = {
  primary: 'm4',
  primaryAttachments: {},
  secondary: 'pistol',
  secondaryAttachments: {},
  tactical: 'flash',
  lethal: 'frag',
  perks: {
    blue: 'sleightOfHand',
    red: 'stoppingPower',
    green: 'deadSilence'
  },
  fieldUpgrade: 'trophySystem',
  killstreaks: ['uav', 'airstrike', 'heli', 'gunship']
}

// --- Tipos de enemigo ---
// Cada oleada mezcla tipos según el progreso. Antes todos los enemigos
// eran melee caminantes idénticos; ahora hay variedad.
export const ENEMY_TYPES = {
  walker: {
    name: 'walker',
    baseHp: 50,
    baseSpeed: 2.0,
    baseDamage: 8,
    color: 0x4a3320,
    scale: 1.0,
    ranged: false,
    points: 100,
    // A partir de qué oleada aparece.
    minWave: 1
  },
  runner: {
    name: 'runner',
    baseHp: 30,
    baseSpeed: 4.0,
    baseDamage: 6,
    color: 0x6a2a2a,
    scale: 0.9,
    ranged: false,
    points: 150,
    minWave: 2
  },
  tank: {
    name: 'tank',
    baseHp: 150,
    baseSpeed: 1.3,
    baseDamage: 18,
    color: 0x2a2f24,
    scale: 1.3,
    ranged: false,
    points: 250,
    minWave: 4
  },
  shooter: {
    name: 'shooter',
    baseHp: 60,
    baseSpeed: 1.6,
    baseDamage: 5, // por proyectil
    color: 0x2a3a4a,
    scale: 1.0,
    ranged: true,
    points: 200,
    minWave: 6
  },
  boss: {
    name: 'boss',
    baseHp: 500,
    baseSpeed: 1.8,
    baseDamage: 25,
    color: 0x4a1a1a,
    scale: 1.8,
    ranged: true,
    points: 1000,
    minWave: 5 // cada 5 oleadas
  },
  // --- Fase 18.26: roles especializados ---
  grenadier: {
    name: 'grenadier',
    baseHp: 70,
    baseSpeed: 1.5,
    baseDamage: 8,
    color: 0x3a2a4a,
    scale: 1.0,
    ranged: true,
    points: 250,
    minWave: 4,
    role: 'grenadier',
    grenadeCooldown: 8.0,
    grenadeType: 'frag'
  },
  sniper: {
    name: 'sniper',
    baseHp: 50,
    baseSpeed: 1.2,
    baseDamage: 35,
    color: 0x2a3a2a,
    scale: 0.95,
    ranged: true,
    points: 350,
    minWave: 5,
    role: 'sniper',
    fireCooldown: 4.0,
    minRange: 30
  },
  shotgunner: {
    name: 'shotgunner',
    baseHp: 90,
    baseSpeed: 2.6,
    baseDamage: 14,
    color: 0x4a3a2a,
    scale: 1.1,
    ranged: true,
    points: 220,
    minWave: 3,
    role: 'shotgunner',
    fireCooldown: 1.5,
    maxRange: 12,
    pellets: 6
  },
  medic: {
    name: 'medic',
    baseHp: 80,
    baseSpeed: 1.7,
    baseDamage: 4,
    color: 0x2a4a3a,
    scale: 1.0,
    ranged: true,
    points: 300,
    minWave: 6,
    role: 'medic',
    healCooldown: 6.0,
    healAmount: 30,
    healRadius: 8
  }
}

// --- Escalado por oleada ---
// Multiplicadores aplicados a los valores base de cada tipo de enemigo.
export const WAVE_SCALING = {
  hpPerWave: 15,
  speedPerWave: 0.15,
  damagePerWave: 2,
  pointsPerWave: 10
}

// --- Spawn ---
// Bordes del mapa donde aparecen enemigos.
export const SPAWN = {
  edge: 90,
  spread: 180 // variación a lo largo del borde
}

// --- Pickups ---
// Probabilidad de drop al matar un enemigo.
export const PICKUPS = {
  dropChance: 0.3,
  types: {
    health: { weight: 0.4, amount: 25 },
    ammo: { weight: 0.5, amount: 15 },
    grenade: { weight: 0.1, amount: 1 }
  }
}
