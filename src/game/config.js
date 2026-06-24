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
  invulnTime: 0.5
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

// --- Arma ---
export const WEAPON = {
  magSize: 30,
  reserveStart: 90,
  fireInterval: 0.1, // 10 disparos/seg
  reloadTime: 1500,  // ms
  bodyDamage: 34,
  headDamage: 100,
  raycastFar: 200,
  recoilPerShot: 0.045,
  recoilMax: 0.14,
  recoilRecover: 0.85,
  pitchKick: 0.012,
  yawKick: 0.008
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
