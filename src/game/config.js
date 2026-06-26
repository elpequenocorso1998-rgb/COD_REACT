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
    adsTime: 0.25,           // tiempo de ADS (segundos)
    adsFov: 45,              // FOV al apuntar
    hipFireSpread: 1.0,      // multiplicador de spread hipfire
    adsSpread: 0.1,          // multiplicador de spread en ADS
    adsSensMul: 0.6,         // reducción de sensibilidad al apuntar
    moveSpeedMul: 1.0,       // multiplicador de velocidad al llevarla
    automatic: true,
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
    adsTime: 0.15,
    adsFov: 55,
    hipFireSpread: 0.8,
    adsSpread: 0.1,
    adsSensMul: 0.7,
    moveSpeedMul: 1.15,
    automatic: false,
    minWave: 1
  }
}

// WEAPON: alias del arma por defecto (M4) para compatibilidad con código
// existente que importa WEAPON directamente.
export const WEAPON = WEAPONS.m4

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
  suppressor: {
    id: 'suppressor', name: 'Suppressor', slot: 'barrel',
    // No aparece en minimap enemigo al disparar (futuro MP). Reduce daño.
    damageMul: 0.9, raycastFarMul: 0.95
  },
  foregrip: {
    id: 'foregrip', name: 'Foregrip', slot: 'underbarrel',
    recoilMul: 0.7, hipFireSpreadMul: 0.8
  },
  extendedmags: {
    id: 'extendedmags', name: 'Extended Mags', slot: 'mag',
    magSizeMul: 1.5, reloadTimeMul: 1.1
  },
  laser: {
    id: 'laser', name: 'Laser Sight', slot: 'underbarrel',
    hipFireSpreadMul: 0.6
  },
  compensator: {
    id: 'compensator', name: 'Compensator', slot: 'barrel',
    recoilMul: 0.6
  },
  fmj: {
    id: 'fmj', name: 'FMJ', slot: 'barrel',
    // Aumenta penetración de paredes.
    penetrationMul: 1.5
  },
  quickdraw: {
    id: 'quickdraw', name: 'Quickdraw Handle', slot: 'stock',
    adsTimeMul: 0.7
  },
  stock: {
    id: 'stock', name: 'Stock', slot: 'stock',
    moveSpeedMul: 1.05
  }
}

// Slots válidos para attachments (un attachment por slot).
export const ATTACHMENT_SLOTS = ['sight', 'barrel', 'underbarrel', 'mag', 'stock']

// --- Loadout por defecto (Fase 1.4) ---
// El loadout inicial del jugador cuando empieza una partida nueva sin
// haber configurado nada. Se puede cambiar en el menú Create-a-class.
export const DEFAULT_LOADOUT = {
  primary: 'm4',
  primaryAttachments: {}, // { slot: attachmentId }
  secondary: 'pistol',
  tactical: 'frag',
  lethal: 'flash',
  perks: {
    blue: 'sleightOfHand',
    red: 'stoppingPower',
    green: 'deadSilence'
  },
  killstreaks: ['uav', 'airstrike', 'heli']
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
