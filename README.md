# Modern Warfare React

FPS tipo **Call of Duty** para navegador, hecho en **React 18 + Three.js 0.169 + Zustand**.
Combate PvE por oleadas infinitas en una Pamplona procedural (Plaza del Castillo,
plaza de toros, murallas, casas con interiores transitables) y PvP online por
WebSocket (Team Deathmatch).

- **Zero assets**: todas las texturas, audio y modelos 3D se generan
  proceduralmente en runtime (canvas, Web Audio API y primitivas Three.js).
- **Data-driven**: todo el balance vive en `src/game/config.js` (única fuente
  de verdad).
- **Hardened**: imagen Docker no-root, read-only, cap-drop ALL; nginx con CSP,
  HSTS, headers de seguridad; manifiestos K8s listos para producción.
- **150+ tests** (Vitest + jsdom) cubriendo lógica pura.

---

## Tabla de contenidos

- [Quickstart](#quickstart)
- [Modos de juego](#modos-de-juego)
- [Controles](#controles)
- [Arsenal](#arsenal)
- [Enemigos](#enemigos)
- [Killstreaks](#killstreaks)
- [Perks](#perks)
- [Attachments](#attachments)
- [Progresión y meta](#progresión-y-meta)
- [Ajustes](#ajustes)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Módulos core](#módulos-core)
- [Configuración (config.js)](#configuración-configjs)
- [Protocolo multijugador](#protocolo-multijugador)
- [Performance y calidad](#performance-y-calidad)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Seguridad](#seguridad)
- [Navegadores compatibles](#navegadores-compatibles)
- [Licencia](#licencia)

---

## Quickstart

Requiere Node >= 20 (recomendado vía Docker para no instalar nada en el host).

### Opción A — Docker (recomendado)

```bash
docker build -t modern-warfare-react:latest .
docker run -d --name modern_warfare -p 9432:9432 --restart unless-stopped \
  --security-opt no-new-privileges:true --cap-drop ALL --read-only \
  --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  modern-warfare-react:latest
```

Juego en **http://localhost:9432**

### Opción B — Docker Compose

```bash
docker compose up --build              # producción
docker compose --profile dev up        # dev con hot-reload (Vite HMR)
```

### Opción C — Dev local (sin Docker)

```bash
npm install
npm run dev          # http://localhost:9432 (Vite + HMR)
```

### Opción D — Kubernetes

```bash
kubectl apply -k k8s/
# o con el helper (build + kind/minikube load + apply + rollout wait):
./k8s/deploy.sh
./k8s/deploy.sh --port-forward     # tunnel localhost:9432 -> service
```

### Servidor multijugador (opcional)

```bash
npm run server                         # puerto 9433
# o con Docker:
docker build -f Dockerfile.server -t mw-server .
docker run -p 9433:9433 mw-server
```

Conéctate desde el menú **Multiplayer** del juego a `ws://host:9433`.

---

## Modos de juego

### PvE — Survival por oleadas

- Oleadas infinitas con composición escalada: walkers al principio, después
  runners, tanks, shooters y bosses cada 5 oleadas.
- HP/velocidad/daño enemigos escala linealmente por oleada
  (`WAVE_SCALING` en `config.js`).
- Recarga parcial de munición y granadas entre oleadas (30% reserve + 1 frag).
- KillCam al morir (buffer circular de 5s @ 30 Hz).

### PvP — Team Deathmatch

- Servidor autoritativo WebSocket (`server/server.js`), 20 Hz snapshots,
  60 Hz inputs, 12 jugadores máx, 75 kills para ganar.
- 2 equipos (axis / allies), auto-balance por conteo, respawn tras 3s.
- Killfeed (últimos 5), scoreboard con K/D/ping, pantalla de Match Over.
- Trusted-client (anti-cheat real pendiente — ver roadmap en `PLAN.md`).

---

## Controles

| Acción                | Teclado       | Mando          |
|-----------------------|---------------|----------------|
| Moverse               | WASD          | Stick izq.     |
| Correr                | Shift         | L3             |
| Sprint táctico        | Shift ×2      | —              |
| Agacharse / Slide     | Ctrl          | —              |
| Prone                 | Z             | —              |
| Saltar                | Space         | A              |
| Mantle / vault        | F             | —              |
| Lean izq. / der.      | Q / E         | —              |
| Disparar              | Click izq.    | RT             |
| Apuntar (ADS)         | Click der.    | LT             |
| Hold breath (sniper)  | V             | —              |
| Recargar              | R             | —              |
| Cambiar arma          | Shift+1-7     | —              |
| Swap secondary        | Y             | —              |
| Frag                  | G             | —              |
| Flash                 | X             | —              |
| Smoke                 | C             | —              |
| Throwing knife        | B             | —              |
| Killstreaks           | 4-7 (sin Shift) | —            |
| Scoreboard            | Tab           | —              |
| Pausa                 | Esc           | —              |

Soporte de gamepad con deadzone 0.15 y aim assist ajustable desde Settings.

---

## Arsenal

7 armas, cada una con viewmodel 3D propio y stats balanceadas en `config.js`:

| Arma        | Categoría | Daño (body/head) | Cadencia | Mag | Reserve | Alcance | Recarga | ¿Automática? | Disp. desde |
|-------------|-----------|------------------|----------|-----|---------|---------|---------|--------------|-------------|
| M4 Carbine  | AR        | 34 / 100         | 10/s     | 30  | 90      | 200     | 1.5s    | Sí           | Oleada 1    |
| AK-47       | AR        | 40 / 120         | 9/s      | 30  | 90      | 200     | 1.8s    | Sí           | Oleada 1    |
| MP5         | SMG       | 25 / 75          | 12.5/s   | 30  | 120     | 120     | 1.3s    | Sí           | Nivel 2     |
| Sniper      | Sniper    | 80 / 240         | 0.8/s    | 5   | 25      | 400     | 2.5s    | No           | Nivel 7     |
| Shotgun     | Shotgun   | 20×8 pellets     | 1.4/s    | 7   | 35      | 60      | 2.2s    | No           | Nivel 10    |
| LMG         | LMG       | 30 / 90          | 11/s     | 100 | 300     | 250     | 3.5s    | Sí           | Nivel 15    |
| Pistol      | Pistol    | 28 / 84          | 6.7/s    | 12  | 48      | 100     | 1.2s    | No           | Nivel 20    |

Cada arma expone además: `recoilPerShot/Max/Recover`, `pitchKick/yawKick`,
`adsTime/adsFov/adsSensMul`, `hipFireSpread/adsSpread`, `moveSpeedMul`.

### Damage zones + ballistics

Multiplicadores de daño por zona (`DAMAGE_MULTIPLIERS` en `config.js`):

| Zona            | Multiplicador |
|-----------------|---------------|
| Head            | ×4.0          |
| Neck            | ×2.0          |
| Chest           | ×1.0          |
| Stomach         | ×1.1          |
| Arms / Legs     | ×0.8          |

**Penetración de balas** (wallbang): el raycast atraviesa colliders aplicando
reducción de daño por tipo de material (`PENETRATION`):

| Material | Daño transmitido |
|----------|------------------|
| Wall     | 30%              |
| Crate    | 60%              |

Hitmarker diferenciado para wallbang (sonido grave, 400 Hz).

---

## Enemigos

5 tipos definidos en `config.js` (`ENEMY_TYPES`):

| Tipo     | HP   | Velocidad | Daño | Range  | Aparece         |
|----------|------|-----------|------|--------|-----------------|
| Walker   | 50   | 2.0       | 8    | Melee  | Oleada 1        |
| Runner   | 30   | 4.0       | 6    | Melee  | Oleada 2        |
| Tank     | 150  | 1.3       | 18   | Melee  | Oleada 4        |
| Shooter  | 60   | 1.6       | 5    | 20m    | Oleada 6        |
| Boss     | 500  | 1.8       | 25   | Ranged | Cada 5 oleadas  |

Escalado por oleada (`WAVE_SCALING`): +15 HP, +0.15 vel, +2 daño, +10 puntos.

### IA táctica

State machine en `ai.js` con 8 estados:

- **ENGAGE** — avanza hacia el jugador con A*.
- **FLANK** — movimiento perpendicular a media distancia (30% probabilidad).
- **TAKE_COVER** — busca cobertura con raycasts en 8 direcciones.
- **SUPPRESS** — deviene al recibir fuego cerca (2s).
- **RETREAT** — al <25% HP si el jugador está cerca.
- **ADVANCE** — re-path cada 0.5s con `navmesh.findPath`.
- **RELOAD** — cada 5 disparos (shooters), 2s inmóvil.
- **DEAD** — ragdoll verlet.

Decisiones re-evaluadas cada 0.2s (no por frame) para evitar jitter.

### Ragdoll

Al morir, los huesos del humanoide se sueltan a simulación verlet (13 partículas,
3 iteraciones de constraints, colisión con suelo + colliders AABB). Impulso
inicial en dirección del disparo (cabeza recibe ×2). Limpieza a los 2.5s.

---

## Killstreaks

4 killstreaks configurables en el loadout (umbrales 3 / 5 / 7 / 11):

| Streak    | Umbral | Duración | Efecto                                                            |
|-----------|--------|----------|-------------------------------------------------------------------|
| UAV       | 3      | 30s      | Enemigos visibles en minimap.                                     |
| Airstrike | 5      | —        | 8 explosiones escalonadas (300ms) en el centroide enemigo, 6u, 40 dmg. |
| Heli      | 7      | 60s      | Hélice orbitando a 30m, dispara al enemigo más cercano cada 0.5s (25 dmg). |
| Gunship   | 11     | 30s      | Cámara aérea a 80m, click = explosión 8u / 100 dmg.               |

---

## Perks

3 categorías, hasta 3 activos (uno por color). Definidos en `config.js` (`PERKS`):

### Blue (defensivos)

| Perk         | Efecto                                       |
|--------------|----------------------------------------------|
| Scavenger    | Munición garantizada de cada enemigo muerto. |
| Ghost        | Invisible al UAV enemigo.                    |
| ColdBlooded  | Sin hitmarker rojo al recibir daño.          |
| Juggernaut   | +50 HP máximo (150 total).                   |

### Red (ofensivos)

| Perk           | Efecto                                          |
|----------------|-------------------------------------------------|
| Sleight of Hand| Recarga ×0.5.                                   |
| Marathon       | Sprint infinito (sin consumo de stamina).       |
| Lightweight    | Velocidad ×1.1.                                 |
| Steady Aim     | Hipfire spread ×0.7.                            |
| Stopping Power | Daño ×1.25.                                     |

### Green (utilidad)

| Perk        | Efecto                                |
|-------------|---------------------------------------|
| Dead Silence| Pasos silenciosos.                    |
| Ninja       | Sin sonido al cambiar de arma.        |
| Commando    | Melee range ×1.5.                     |

Los efectos se aplican en `loadout.js` (`applyLoadoutToWeapon`) sin mutar el
arma base (copia defensiva).

---

## Attachments

5 slots con 11 attachments. Cambian stats en runtime al equiparlos:

| Slot        | Attachment        | Efecto                              |
|-------------|-------------------|-------------------------------------|
| Sight       | Red Dot           | (cosmético, mejor visibilidad)      |
| Sight       | Holographic       | (cosmético)                         |
| Sight       | ACOG              | (cosmético, zoom)                   |
| Barrel     | Suppressor        | (sigilo, minimap oculto)            |
| Barrel     | Compensator       | reduce recoil                       |
| Barrel     | FMJ               | mayor penetración                   |
| Underbarrel | Foregrip          | reduce recoil                       |
| Underbarrel | Laser             | reduce hipfire spread               |
| Mag         | Extended Mags     | magSize ×1.5                        |
| Stock       | Quickdraw         | adsTime ×0.7                        |
| Stock       | Stock             | moveSpeedMul ×1.05                  |

Stacking multiplicativo para daño/recarga/velocidad/spread.

---

## Progresión y meta

Persistencia en `localStorage` (clave `mw_progress_v1`).

### Niveles de jugador

- Curva XP: `1000 + (level-1)*250` por nivel.
- Catálogo de unlocks por nivel (`UNLOCK_CATALOG` en `progression.js`):

| Nivel | Unlock        |
|-------|---------------|
| 2     | MP5           |
| 3     | Red Dot       |
| 4     | Scavenger     |
| 5     | AK-47         |
| 6     | Suppressor    |
| 7     | Sniper        |
| 8     | Sleight of Hand |
| 10    | Shotgun       |
| 12    | Marathon      |
| 15    | LMG           |
| 20    | Pistol        |

### Weapon mastery

- Cada arma sube de nivel independientemente (max 30, 500 XP/nivel).
- Camos desbloqueables por nivel de arma:

| Nivel arma | Camo     |
|------------|----------|
| 5          | Spray    |
| 10         | Woodland |
| 15         | Digital  |
| 20         | Dragon   |
| 25         | Gold     |
| 30         | Diamond  |

### Battle Pass

- 100 tiers, 1000 XP/tier.
- Catálogo de recompensas free/premium por tier (`BP_REWARDS` en `meta.js`).
- Flag `premium` (placeholder para Fase 3 — integración con pasarela).

### Dailies

- 3 retos aleatorios por día de 4 plantillas:
  `kills_50`, `headshots_10`, `waves_5`, `multikill`.
- Auto-claim al completar (otorga XP + BP XP).

### Barracks

UI en `App.jsx` que muestra: nivel/XP, K/D, oleada más alta, unlocks,
battle pass, dailies, weapon stats y camos.

---

## Ajustes

Pantalla de Settings completa (persistida en `localStorage` clave
`mw_settings_v1`):

| Ajuste          | Default | Rango           |
|-----------------|---------|-----------------|
| FOV             | 78      | 60–110          |
| Sensibilidad X  | 0.0022  | 0.0005–0.01     |
| Sensibilidad Y  | 0.0022  | 0.0005–0.01     |
| Master volume   | 0.5     | 0–1             |
| Music volume    | 0.4     | 0–1             |
| SFX volume      | 0.7     | 0–1             |
| Quality         | auto    | auto/low/med/high |
| Colorblind      | off     | off/protan/deutan/tritan |
| Aim assist      | 0.0     | 0–1             |
| Show FPS        | false   | bool            |
| Language        | auto    | es/en           |

---

## Arquitectura

Patrón general: **datos en `config.js` + motor Three.js imperativo +
UI Reactiva con Zustand**.

```
main.jsx
  └─ App.jsx (UI, menús, HUD)
       ├─ engine.js (createEngine) ← orquesta el game loop y wiring
       │    ├─ world.js (createWorld) ← Pamplona procedural
       │    │    ├─ pamplona.js (builders: casas, fuente, plaza de toros)
       │    │    ├─ textures.js (PBR textures via canvas)
       │    │    ├─ shaders/sky.js (sky shader)
       │    │    ├─ spatial-grid.js (collision broadphase)
       │    │    └─ math.js (mulberry32 PRNG)
       │    ├─ navmesh.js (NavMesh A*) → ai.js (state machine)
       │    ├─ environment.js (PMREM env map)
       │    ├─ particles.js (pool: sangre/chispas/humo)
       │    ├─ player.js (FPS controller) → viewmodels.js (por-arma 3D)
       │    ├─ audio.js (Web Audio procedural + música dinámica)
       │    ├─ enemies.js → humanoid.js + ai.js + ragdoll.js
       │    ├─ minimap.js (canvas 2D rotate-with-player)
       │    ├─ streaks.js (UAV/airstrike/heli/gunship)
       │    ├─ grenades.js (frag/flash/smoke/knife)
       │    ├─ decals.js (bullet holes / blood splats)
       │    ├─ pickups.js (drops + scavenger)
       │    ├─ remote-players.js (MP rendering + hit detection)
       │    ├─ store.js (Zustand: estado HUD + acciones de juego)
       │    │    └─ progression.js (XP/levels/BP/dailies)
       │    ├─ loadout.js (perks + attachments + apply)
       │    ├─ settings.js (FOV/sens/volumes)
       │    └─ quality.js (FpsSampler + applyQuality)
       ├─ config.js ← ÚNICA FUENTE DE VERDAD de balance
       ├─ constants.js (render constants)
       ├─ meta.js (Barracks summary)
       ├─ i18n.js (es/en)
       └─ net/client.js (WebSocket) ↔ server/server.js (TDM)
```

### Patrones clave

- **Store como single source of truth** para UI. El game loop Three.js lee
  con `useGameStore.getState()` (sin re-render) y escribe con `set()` solo
  cuando el HUD debe reflejar el cambio.
- **Factory pattern**: cada subsistema es `createXxx(scene, deps...)` que
  devuelve `{ update, dispose, reset, ... }`. Excepciones: `NavMesh`,
  `SpatialGrid`, `FpsSampler`, `MinHeap` (clases).
- **Wiring por callbacks**: el motor conecta subsistemas con setters
  (`enemies.onKilled = ...`, `player.onShoot = ...`, etc.). No hay event bus.
- **Disposal cascade**: `engine.dispose()` recorre todos los subsistemas en
  orden y libera geometries/materials/textures/envMaps Three.js. Recursos
  compartidos (humanoid/viewmodel textures) tienen su propio
  `disposeXxxShared()`.
- **Material cloning por instancia** para emisivos/opacity independientes
  (hitFlash de enemigos, fade de decals/partículas).
- **Object pooling**: partículas con free-list O(1).
- **Spatial hashing** (`SpatialGrid`) para broadphase de colisiones.
- **Binary heap A*** (`MinHeap`) para pathfinding.
- **Scratch vectors** pre-asignados en hot paths para evitar GC pressure.
- **Idempotent mount**: `engine.mount()` es seguro para React StrictMode
  (doble-invoke en dev).
- **Tracked timeouts**: `store.js` registra cada `setTimeout` en un Set y los
  cancela todos en `reset()` — evita feedback de partidas anteriores.

---

## Estructura del proyecto

```
modern_warfare_react/
├── src/
│   ├── App.jsx                  # UI root: menús + HUD + wiring engine
│   ├── main.jsx                 # React StrictMode + mount
│   ├── i18n.js                  # Internacionalización es/en
│   ├── game/
│   │   ├── engine.js            # Motor Three.js + post-pro + game loop
│   │   ├── player.js            # FPS controller (input/cámara/disparo)
│   │   ├── viewmodels.js        # Modelos 3D por arma (M4, AK, MP5, ...)
│   │   ├── enemies.js           # Manager de enemigos + hit testing
│   │   ├── humanoid.js          # Humanoide anatómico + anim walk
│   │   ├── ragdoll.js           # Verlet death physics
│   │   ├── ai.js                # State machine táctica
│   │   ├── navmesh.js           # A* con binary heap
│   │   ├── store.js             # Zustand: estado HUD + acciones
│   │   ├── config.js            # Balance data-driven (FUENTE DE VERDAD)
│   │   ├── constants.js         # Constantes de render/motor
│   │   ├── world.js             # Mundo Pamplona procedural
│   │   ├── pamplona.js          # Builders: casas, fuente, plaza toros
│   │   ├── textures.js          # PBR textures procedurales (canvas)
│   │   ├── shaders/sky.js       # Sky shader + sun material
│   │   ├── spatial-grid.js      # Hash 2D broadphase colisiones
│   │   ├── math.js              # mulberry32, clamp, lerp, smoothstep
│   │   ├── minimap.js           # Canvas 2D rotate-with-player
│   │   ├── streaks.js           # Killstreaks (UAV/airstrike/heli/gunship)
│   │   ├── grenades.js          # Frag/flash/smoke/knife con física
│   │   ├── pickups.js           # Drops + scavenger
│   │   ├── decals.js            # Bullet holes + blood splats
│   │   ├── particles.js         # Pool sangre/chispas/humo
│   │   ├── progression.js       # XP/niveles/unlocks/BP/dailies
│   │   ├── loadout.js           # Create-a-class (perks/attachments)
│   │   ├── settings.js          # Preferencias jugador
│   │   ├── meta.js              # Barracks summary
│   │   ├── audio.js             # Web Audio procedural + 3D posicional
│   │   ├── environment.js       # PMREM env map procedural
│   │   ├── quality.js           # Auto-escalado calidad por FPS
│   │   └── remote-players.js    # Renderizado + hit detection MP
│   └── net/
│       └── client.js            # Cliente WebSocket MP
├── server/
│   └── server.js                # Servidor WebSocket TDM
├── tests/                       # 14 ficheros, 151 tests (Vitest + jsdom)
├── k8s/                         # Manifiestos Kubernetes (kustomize)
├── public/                      # favicon.svg
├── Dockerfile                   # Build Vite → nginx-unprivileged
├── Dockerfile.dev               # Dev con HMR
├── Dockerfile.server            # Servidor MP
├── docker-compose.yml           # game + dev profile
├── nginx.conf                   # CSP + headers + SPA + cache
├── vite.config.js
├── vitest.config.js             # jsdom + coverage en src/game
├── eslintrc.json                # max-warnings 0
├── jsconfig.json                # alias @ -> ./src
└── package.json
```

---

## Módulos core

### `engine.js` — Orquestador (1,048 LOC)

`createEngine()` → `{ mount, dispose, startGame, startMPGame, resumeGame,
quitToMenu, spawnWave, applySettings, set onMinimapReady }`.

- Pipeline post-pro: `RenderPass → SSAOPass → UnrealBloomPass →
  CinematicShader (vignette + chromatic aberration + 16-sample god rays +
  film grain) → SMAAPass → OutputPass`.
- Game loop rAF con `MAX_DT = 0.05` (clamp anti-tunneling).
- Auto-pausa en `visibilitychange` / `pointerlockchange` (alt-tab safe).
- WebGL `contextlost`/`contextrestored` manejados.
- KillCam: buffer circular 150 muestras @ 30 Hz.
- Composición de oleadas depende del progreso (más shooters con el tiempo).
- Aim assist: soft snap al enemigo más cercano en cono ADS.
- Música dinámica: intensidad 0/1/2 según enemigos vivos y HP del jugador.

### `player.js` — FPS Controller (931 LOC)

`createPlayer(scene, camera, world, particles, renderer)` → `{ update, reset,
dispose, getPosition, getYaw, requestPointerLock, exitPointerLock, setWeapon,
applySettings, setGunshipActive, getStamina, getMaxStamina, get isAiming,
addYawDelta, set onShoot, set onFootstep }`.

- Estados: walk, sprint, tactical sprint, crouch, slide (0.6s impulse),
  prone, lean (con camera roll), mantle, slide-jump momentum.
- Stamina para sprint + hold breath (sniper).
- Auto-fire por acumulador en `update()` (no `setInterval` drift).
- Shotgun multi-pellet: N rayos con spread independiente.
- Recoil aplicado a `rifleGroup` entero; decay framerate-independent
  (`Math.pow(recover, dt*60)`).
- Camera smoothing: `1 - Math.pow(1 - SMOOTH, dt*60)` (consistente 60/144 Hz).
- Gamepad: deadzone 0.15, L3 sprint, RT fire, LT ADS, A jump.
- `dispose()` elimina los 8 listeners de document + window blur.

### `enemies.js` — Manager (560 LOC)

`createEnemyManager(scene, world, _particles, audio, navmesh)` → `{ spawn,
update, reset, dispose, handleShot, forEachAlive, markShot, suppress,
suppressNear, get count, get allCleared, set onKilled, set onReachPlayer,
set onShootPlayer }`.

- `userData.part` en cada mesh del humanoide (head/chest/stomach/arm/leg).
- `handleShot`: broadphase distance² cull + raycast por zona + multiplicadores.
- Wallbang: test de intersección con colliders aplicando `PENETRATION`.
- Boids separation (radio 2.0, distance² check).
- Shooters: 60% hit chance decayed por distancia, tracer Line 80ms fade.
- Ragdoll al morir (2.5s), luego `disposeEnemy`.

### `store.js` — Estado Zustand (617 LOC)

`useGameStore` + `GAME_STATES = { MENU, PLAYING, PAUSED, GAMEOVER, LOBBY,
MATCH_OVER }`.

24 acciones: `setState`, `setLoading`, `setStamina`, `setMpConnected`,
`setMpInit`, `setMpSnapshot`, `addMpKill`, `setMpMatchOver`, `clearMpKillfeed`,
`switchWeapon`, `getCurrentWeapon`, `fire`, `reload`, `regenHealth`,
`addHealth`, `addReserve`, `useGrenade`, `addGrenade`, `setGunshipActive`,
`flashPlayer`, `setFps`, `registerHit`, `registerKill`, `useStreak`,
`toggleScoreboard`, `takeDamage`, `startWave`, `reset`.

- `takeDamage` atómico (un solo `set()`).
- I-frames 0.5s tras daño.
- Killstreak thresholds `[3, 5, 7, 11]` mapeados al loadout.
- Multikill: ventana 3s, labels `DOUBLE/TRIPLE/MULTI/MEGA/MONSTER KILL`.
- XP: `registerKill` → `addXP(points*10)` + `addWeaponXP` +
  `addBattlePassXP` + `progressDaily`.

### `navmesh.js` — Pathfinding A* (298 LOC)

`class NavMesh(world, floorSize, cellSize = 2)`.

- Grid `Uint8Array` construido una vez desde `world.collidesAt`.
- 8 vecinos, heurística octile, diagonales no cruzan esquinas (L-walls).
- `MinHeap` binary heap para open set (O(log n)).
- Closed set + guard en `_reconstruct` (anti-ciclos infinitos).
- String pulling por DDA line-of-sight.
- `_nearestWalkable`: búsqueda espiral hasta 5 celdas.
- `maxIterations` 1000.

### `world.js` — Pamplona procedural (571 LOC)

`createWorld(scene)` → `{ colliders, sunMesh, sun, SUN_DIR, collidesAt,
forEachCollider, updateLamps, updateShadows, update, dispose }`.

- Iluminación: ambient + hemisphere + directional sun (VSM, sigue al
  jugador) + fill light.
- `collidesAt`: `SpatialGrid` (celdas 4u, hash FNV-ish) → O(k) lookups.
- Lámparas: solo 4 PointLights activas por frame (las más cercanas), resto
  emissive-only.
- Árboles y debris como `InstancedMesh` (2 draw calls vs 90+).
- Casa con interior: 4 muros + puerta + escalera a azotea + barandilla.

### `viewmodels.js` — Modelos por arma (623 LOC)

`buildViewModel(weaponId)` → `{ viewmodel, rifleGroup, muzzleLight,
muzzleSprite, sightDot, hipX, hipY, adsX, adsY, dispose }`.

7 builders (`buildM4`, `buildAK47`, `buildMP5`, `buildSniper`, `buildShotgun`,
`buildLMG`, `buildPistol`) con geometrías únicas (AK con mag curva, sniper
con scope y bipod, LMG con belt box, etc.). Cada uno registra sus
geometries en `geos[]` para disposal completo.

### `audio.js` — Audio 100% procedural (563 LOC)

`createAudioSystem()` → 21 métodos. Sin archivos de audio.

- `playShoot`: square click (1200Hz) + noise burst lowpass-filtered.
- `playEnemyShoot`: PannerNode HRTF con distancia exponencial.
- 4 hitmarker variants por frecuencia (body/headshot/kill/wallbang).
- Música dinámica: drone base + percusión sawtooth (ramp por intensidad).
- Footsteps throttled 0.3s, frecuencia por material (stone/wood/metal).
- Level up: arpeggio C-E-G-C.

---

## Configuración (config.js)

`src/game/config.js` es la **única fuente de verdad** de balance. Nadie más
debe hardcodear daño/munición/velocidad. Exporta 16 constantes:

| Constante              | Contenido                                                |
|------------------------|----------------------------------------------------------|
| `PLAYER`               | maxHealth, bodyRadius, standHeight, invulnTime, regen    |
| `GRENADES`             | maxPerType, startCounts, cooldown                        |
| `MOVEMENT`             | walk/sprint/crouch/jump/gravity/accel/sens               |
| `STAMINA`              | max, sprintDrain, regen, breathDrain, breathRegenDelay   |
| `WEAPONS`              | 7 armas con stats completas                              |
| `WEAPON`               | alias `WEAPONS.m4` (backwards-compat)                    |
| `DAMAGE_MULTIPLIERS`   | head×4, neck×2, chest×1, stomach×1.1, limbs×0.8          |
| `PENETRATION`          | wall 0.3, crate 0.6                                      |
| `PERKS`                | 12 perks en 3 categorías                                 |
| `ATTACHMENTS`          | 11 attachments en 5 slots                                |
| `ATTACHMENT_SLOTS`     | `['sight','barrel','underbarrel','mag','stock']`         |
| `DEFAULT_LOADOUT`      | primary/secondary/tactical/lethal/perks/killstreaks     |
| `ENEMY_TYPES`          | 5 tipos: walker/runner/tank/shooter/boss                 |
| `WAVE_SCALING`         | hpPerWave, speedPerWave, damagePerWave, pointsPerWave    |
| `SPAWN`                | edge, spread                                             |
| `PICKUPS`              | dropChance, types (health/ammo/grenade)                  |

**Convención**: todos los tiempos en `WEAPON` van en **segundos**;
`store.js` convierte a ms para `setTimeout`.

---

## Protocolo multijugador

WebSocket JSON. Trusted-client (pendiente anti-cheat en Fase 2.5).

### Cliente → Servidor

| `type`   | Campos                                                       |
|----------|--------------------------------------------------------------|
| `input`  | `pos, yaw, pitch, weapon, firing, alive, health` (60 Hz)    |
| `kill`   | `killer, victim, weapon, headshot`                           |
| `name`   | `name` (≤16 chars)                                           |

### Servidor → Cliente

| `type`       | Campos                                                                |
|--------------|-----------------------------------------------------------------------|
| `init`       | `clientId, team, spawn, scoreLimit, teams`                            |
| `snapshot`   | `time, teams, players[{id,name,team,pos,yaw,pitch,weapon,firing,alive,health,kills,deaths,score}]` (20 Hz) |
| `kill`       | `killer, killerName, victim, victimName, weapon, headshot`            |
| `respawn`    | `id, pos` (3s tras muerte)                                            |
| `matchOver`  | `winner, teams`                                                       |
| `playerLeft` | `id`                                                                  |
| `error`      | `message` (e.g. "Server full")                                        |

---

## Performance y calidad

Auto-escalado dinámico en `quality.js` (60 frames warmup):

| Quality | SSAO | Bloom | God rays | Shadow map | Pixel ratio |
|---------|------|-------|----------|------------|-------------|
| LOW     | off  | 0.4   | off      | 1024       | 1.5         |
| MEDIUM  | on   | 0.55  | 0.3      | 1536       | 2.0         |
| HIGH    | on   | 0.7   | 0.5      | 2048       | 2.0         |

Umbrales: HIGH ≥ 50 FPS, MEDIUM ≥ 30 FPS, LOW < 30 FPS.

Optimizaciones notables:

- `SpatialGrid` para broadphase de colisiones (O(k) vs O(n) con 100+ colliders).
- `MinHeap` para A* (O(log n) vs O(n) linear scan).
- `InstancedMesh` para árboles y debris (2 draw calls vs 90+).
- Object pooling para partículas con free-list O(1).
- Scratch vectors pre-asignados en hot paths.
- `forEachCandidate` zero-alloc iteration.
- Solo 4 PointLights activas por frame (lámparas).
- Cambios de calidad diferidos al siguiente frame (evita disposal mid-render).

---

## Desarrollo

```bash
# Dev server con HMR
npm run dev                # http://localhost:9432

# Lint (cero warnings permitidos)
npm run lint

# Tests
npm test                   # single run
npm run test:watch         # watch mode
npm run test:e2e           # Playwright (no tests aún)

# Build producción
npm run build              # salida en dist/
npm run preview            # sirve dist/ en :9432
```

### Vía Docker (sin Node en el host)

```bash
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run lint"
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm test"
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run build"
```

### Verificación completa tras cada cambio

```bash
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c \
  "npm run lint && npm test && npm run build"
```

---

## Testing

Entorno **Vitest + jsdom** (config en `vitest.config.js`). 14 ficheros,
**151 tests**, cubriendo lógica pura (no Three.js rendering).

| Fichero                  | Tests | Cubre                                                |
|--------------------------|-------|------------------------------------------------------|
| `store.test.js`          | 30    | fire/reload/hits/killstreaks/i-frames/multikill      |
| `progression.test.js`    | 18    | XP/levels/unlocks/persistencia/BP/dailies            |
| `spatial-grid.test.js`   | 14    | insert/query/multi-cell/forEachCandidate             |
| `math.test.js`           | 15    | mulberry32/clamp/lerp/smoothstep/deg2rad/dist2d      |
| `enemies.test.js`        | 12    | spawn/reset/dispose/hitFlash/wall-avoidance          |
| `navmesh.test.js`        | 9     | findPath/obstacles/no-path/cycles/regression         |
| `quality.test.js`        | 8     | classifyQuality/FpsSampler/warmup                    |
| `loadout.test.js`        | 8     | perks/attachments efectivos/juggernaut               |
| `humanoid.test.js`       | 7     | buildHumanoid/parts/idle resets/walk phase           |
| `streaks.test.js`        | 7     | airstrike/heli/gunship flag/dispose                  |
| `grenades.test.js`       | 7     | throw/physics/flashbang regression/knife             |
| `pickups.test.js`        | 6     | drop chance/scavenger/proximity/dispose              |
| `settings.test.js`       | 5     | defaults/save/merge/reset                            |
| `i18n.test.js`           | 5     | ES default/EN switch/fallback                        |

### Convenciones de test

- **Mock de texturas procedurales**: jsdom no implementa
  `canvas.getContext`. Usa `vi.mock('@/game/textures', ...)`.
- **Fake timers**: `vi.useFakeTimers()` + mock manual de `performance.now()`
  para tests de i-frames y feedback asíncrono.
- **`clearMocks` + `restoreMocks`** entre tests (config global) para evitar
  flakiness de timers mockeados.

---

## Despliegue

### Docker (producción)

Imagen 2-stage: Node 20 Alpine build → nginx-unprivileged (UID 101).

```bash
docker build -t modern-warfare-react:latest .
docker run -d --name modern_warfare -p 9432:9432 --restart unless-stopped \
  --security-opt no-new-privileges:true --cap-drop ALL --read-only \
  --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  modern-warfare-react:latest
```

### Docker Compose

```bash
docker compose up --build              # producción
docker compose --profile dev up        # dev con HMR
```

### Servidor multijugador

```bash
docker build -f Dockerfile.server -t mw-server .
docker run -p 9433:9433 mw-server
```

### Kubernetes

```bash
kubectl apply -k k8s/
# o con helper:
./k8s/deploy.sh
./k8s/deploy.sh --no-build         # usa imagen ya construida
./k8s/deploy.sh --port-forward     # tunnel localhost:9432
```

Manifiestos en `k8s/` (namespace `modern-warfare`):

| Fichero            | Kind             | Notas                                                  |
|--------------------|------------------|--------------------------------------------------------|
| `namespace.yaml`   | Namespace        | `modern-warfare`                                       |
| `deployment.yaml`  | Deployment       | 3 réplicas, RollingUpdate, non-root, readOnlyRootFS   |
| `service.yaml`     | Service          | ClusterIP :9432                                        |
| `ingress.yaml`     | Ingress          | nginx class, TLS opcional                              |
| `hpa.yaml`         | HPA              | 2–10 replicas, 70% CPU                                 |
| `networkpolicy.yaml` | NetworkPolicy  | ingress solo desde ingress-nginx, egress DNS+HTTPS    |
| `pdb.yaml`         | PDB              | minAvailable 2                                         |
| `quota.yaml`       | ResourceQuota    | CPU/mem/pods/services limits                           |
| `kustomization.yaml` | Kustomization  | labels estándar `app.kubernetes.io/*`                  |

---

## Seguridad

### Docker

- `no-new-privileges:true` — sin escalación de privilegios.
- `cap-drop ALL` — sin capabilities Linux.
- `read-only` rootfs con tmpfs en `/tmp`, `/var/cache/nginx`, `/var/run`.
- nginx-unprivileged (UID 101, no root).
- HEALTHCHECK vía `wget --spider`.

### nginx

Headers en `nginx.conf`:

- **CSP**: `default-src 'self'; script-src 'self'; style-src 'self'
  fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self'
  data:; connect-src 'self' ws: wss:; frame-ancestors 'none'` — sin
  inline/eval.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- gzip activado.
- Cache 1 año para `/assets/` (Vite usa hash en el nombre).
- SPA `try_files $uri $uri/ /index.html`.

> Nota: no se usa `upgrade-insecure-requests` (rompería acceso HTTP en LAN).

### Kubernetes

- `runAsNonRoot: true`, `readOnlyRootFilesystem: true`,
  `seccompProfile: RuntimeDefault`.
- `drop ALL` capabilities.
- Resources requests/limits (50m/32Mi → 250m/64Mi).
- Readiness + liveness + startup probes.
- NetworkPolicy aísla el namespace (solo ingress-nginx + DNS + HTTPS egress).
- PDB `minAvailable: 2` (con 3 réplicas, solo 1 disruptable).
- ResourceQuota previene explosions de recursos.

---

## Navegadores compatibles

- Chrome / Edge / Firefox / Safari recientes.
- WebGL2 (Three.js r169).
- Web Audio API.
- Pointer Lock API (requiere HTTPS o localhost — en LAN HTTP hay fallback
  con cursor capturado en ventana).
- Gamepad API (opcional).

---

## Licencia

MIT — ver [LICENSE](LICENSE).
