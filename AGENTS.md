# AGENTS.md — Guía para asistentes (opencode, etc.)

## Comandos clave

Este proyecto NO tiene Node instalado en el host; se ejecuta vía Docker.
Si tienes Node local, puedes usar los scripts de `package.json` directamente.

### Dev
```
npm run dev          # http://localhost:9432 (Vite + HMR)
# o con Docker:
docker run --rm -v "$PWD:/app" -w /app -p 9432:9432 node:20-alpine sh -c "npm install && npm run dev"
```

### Tests
```
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm test"
# watch:
docker run --rm -v "$PWD:/app" -w /app -p 5173:5173 -it node:20-alpine sh -c "npm run test:watch"
```
Entorno de test: `jsdom` (definido en `vitest.config.js`). Los tests que
toquen `document`/`canvas` necesitan el módulo `jsdom` (ya en devDeps).
Las texturas procedurales usan `document.createElement('canvas').getContext`
que jsdom no implementa: en tests, mockéalas con `vi.mock` (ver patrones abajo).

### Lint
```
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run lint"
```
ESLint con `--max-warnings 0`: cero warnings permitidos.

### Build
```
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run build"
```
Salida en `dist/`.

### Verificación completa (tras cada sub-fase)
```
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c \
  "npm run lint && npm test && npm run build"
```

### Docker (producción)
```
docker build -t modern-warfare-react:latest .
docker run -d --name modern_warfare -p 9432:9432 --restart unless-stopped \
  --security-opt no-new-privileges:true --cap-drop ALL --read-only \
  --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  modern-warfare-react:latest
```
El juego queda en http://localhost:9432

### Servidor multijugador (opcional)
```
npm run server                 # puerto 9433
# o con Docker:
docker build -f Dockerfile.server -t mw-server .
docker run -p 9433:9433 mw-server
```

### Kubernetes
```
kubectl apply -k k8s/
# o con el helper:
./k8s/deploy.sh
./k8s/deploy.sh --port-forward     # tunnel localhost:9432
./k8s/deploy.sh --no-build         # saltar build de imagen
```

## Estructura

### Núcleo del motor (`src/game/`)

- `engine.js` — motor Three.js + post-procesado (SSAO + bloom + god rays +
  chromatic aberration + film grain + SMAA) + game loop rAF.
- `player.js` — FPS controller (input kb/mouse/gamepad, cámara, disparo,
  ADS, slide, prone, lean, mantle, stamina, hold-breath).
- `viewmodels.js` — modelo 3D propio por arma (M4, AK, MP5, sniper, shotgun,
  LMG, pistol) con muzzle flash + sight dot.
- `enemies.js` — manager de enemigos (IA melee + shooters, hit-testing por
  zonas, wallbang, dispose).
- `humanoid.js` — humanoide anatómico con bone hierarchy + animación de caminar.
- `ragdoll.js` — simulación verlet (13 partículas, 3 iter constraints).
- `ai.js` — state machine táctica (8 estados: engage/flank/cover/suppress/
  retreat/advance/reload/dead).
- `navmesh.js` — pathfinding A* con MinHeap binary heap + string pulling.
- `store.js` — estado global Zustand (HUD + acciones de juego + MP state).
- `config.js` — balance data-driven (ÚNICA fuente de verdad) + catálogo
  WEAPONS / PERKS / ATTACHMENTS / ENEMY_TYPES / DEFAULT_LOADOUT.
- `constants.js` — constantes de render/motor (sun, fog, FOV, shadow map).
- `world.js` — mundo procedural Pamplona (plaza, casas, murallas, fuente,
  lámparas, árboles InstancedMesh) + SpatialGrid para colisiones.
- `pamplona.js` — builder de casas (con interiores), fuente, plaza de toros,
  murallas, banners San Fermín.
- `textures.js` — PBR textures procedurales (concrete, barrel, crate, gun
  metal, uniform, skin) vía canvas + mulberry32 PRNG.
- `shaders/sky.js` — sky shader + sun material.
- `spatial-grid.js` — hash 2D para broadphase de colisiones (O(k) lookups).
- `math.js` — `mulberry32`, `clamp`, `lerp`, `smoothstep` (con NaN guard),
  `deg2rad`, `dist2d`.
- `minimap.js` — minimap canvas 2D (rotate-with-player, UAV reveal).
- `streaks.js` — killstreaks (UAV, airstrike, heli orbit, gunship cámara aérea).
- `grenades.js` — granadas (frag, flash, smoke, knife) con física de rebote AABB.
- `pickups.js` — sistema de drops (salud, munición, granadas) + scavenger perk.
- `decals.js` — decals de impacto de bala y splatter de sangre (pool FIFO).
- `progression.js` — XP/niveles/unlocks/weapon mastery/camos/battle pass/
  dailies con persistencia localStorage (`mw_progress_v1`).
- `loadout.js` — create-a-class (perks, attachments, secondary) + persistencia
  (`mw_loadout_v1`) + `applyLoadoutToWeapon` (no muta el arma base).
- `settings.js` — preferencias del jugador (FOV, sens, volúmenes, quality,
  colorblind, aimAssist) en localStorage (`mw_settings_v1`).
- `meta.js` — stats, battle pass, weapon mastery, dailies para la UI Barracks.
- `audio.js` — audio 100% procedural (Web Audio API) + 3D posicional
  (PanerNode HRTF) + música dinámica (3 niveles de intensidad).
- `particles.js` — pool de partículas (sangre, chispas, humo, muzzle burst)
  con free-list O(1).
- `environment.js` — env map procedural PMREM (reflections PBR).
- `quality.js` — escalado de calidad dinámico por FPS (FpsSampler 60f warmup).
- `remote-players.js` — renderizado + hit detection de jugadores MP.

### UI / Net / Server

- `src/App.jsx` — UI root: menús (Main/Pause/GameOver/Settings/Barracks/
  Multiplayer/MatchOver) + HUD + wiring del engine.
- `src/main.jsx` — React StrictMode (safe porque `engine.mount()` es idempotente).
- `src/i18n.js` — internacionalización es/en (~45 keys).
- `src/net/client.js` — cliente WebSocket MP (event emitter `on/emit`).
- `server/server.js` — servidor WebSocket TDM (autoritativo, 20Hz snapshots,
  12 jugadores máx, 75 kills gana).
- `k8s/` — manifiestos Kubernetes (kustomize: deployment 3 réplicas,
  service, ingress, HPA, networkpolicy, PDB, quota).

### Soporte

- `tests/` — 14 ficheros, 151 tests (Vitest + jsdom).
- `Dockerfile` / `Dockerfile.dev` / `Dockerfile.server` — builds.
- `docker-compose.yml` — game + dev profile.
- `nginx.conf` — CSP + headers + SPA + cache.
- `vite.config.js` / `vitest.config.js` / `eslintrc.json` / `jsconfig.json`.

## Convenciones (no negociables)

1. **`config.js` es la única fuente de verdad de balance.** NO hardcodear
   valores de daño/munición/velocidad en otros ficheros (importa de config).
2. **Tiempos en `WEAPON` van en SEGUNDOS**; `store.js` convierte a ms para
   `setTimeout`.
3. **Todo recurso Three.js debe disposal.** Geometries, materials, textures,
   envMaps tienen su `dispose()` correspondiente. Recursos compartidos
   (humanoid, viewmodel) tienen `disposeXxxShared()`.
4. **`createEngine().mount()` es idempotente** (StrictMode safe). Reentrada
   protegida por flag `mounted`.
5. **Lint con `--max-warnings 0`**: cero warnings permitidos.
6. **Tests en `tests/`** (vitest + jsdom). Texturas procedurales se mockean
   con `vi.mock`. No testear rendering Three.js (solo lógica pura).
7. **Sin comentarios** salvo que sean necesarios para no-ambigüedad.
8. **`useShallow` en selectores Zustand de React** para evitar re-renders
   innecesarios (ver `App.jsx` HUD).
9. **Game loop lee store con `getState()`** (sin re-render); solo `set()`
   cuando el HUD debe reflejar el cambio.
10. **Scratch vectors pre-asignados** en hot paths (`const _tmp = new THREE.Vector3()`
    a nivel módulo/función) para evitar GC pressure.
11. **Material cloning por instancia** cuando se necesita emisivo/opacity
    independiente (hitFlash de enemigos, fade de decals/partículas).

## Patrones de la codebase

### Factory + dispose

Cada subsistema es `createXxx(scene, deps...)` que devuelve un objeto con
`{ update, dispose, reset, ... }`. Excepciones (clases): `NavMesh`,
`SpatialGrid`, `FpsSampler`, `MinHeap`.

```js
const enemies = createEnemyManager(scene, world, particles, audio, navmesh)
// ...
enemies.update(dt)
// ...
enemies.dispose()
```

### Wiring por callbacks

El motor conecta subsistemas con setters (no hay event bus):

```js
enemies.onKilled = (enemy, hitInfo) => {
  store.registerKill(enemy.points)
  audio.playKill()
  pickups.onEnemyKilled(enemy.group.position)
}
enemies.onReachPlayer = (dmg, relAngle) => store.takeDamage(dmg, relAngle)
player.onShoot = (origin, dir, freeShot) => {
  store.fire()
  audio.playShoot()
  enemies.handleShot(origin, dir, weapon, freeShot)
}
player.onFootstep = (speed, material) => audio.playFootstep(speed, material)
```

### Tracked timeouts

`store.js` envuelve cada `setTimeout` en `trackTimeout()` que registra el id
en un `Set`; `reset()` los cancela todos. Evita que feedback de una partida
anterior (timers de killstreaks, multikill, regen) se cuele en la nueva.

### Disposal cascade

`engine.dispose()` recorre todos los subsistemas en orden: player, enemies,
particles, world, audio, minimap, streaks, grenades, decals, pickups,
remotePlayers, composer, envMap, renderer + DOM. Cada uno dispara su propia
cascade de geometries/materials/textures. Recursos compartidos se liberan
al final con `disposeXxxShared()`.

### SpatialGrid broadphase

`world.collidesAt(x, z)` consulta un hash 2D (celdas 4u, clave FNV-ish) en
O(k) en vez de iterar 100+ colliders. `forEachCandidate(x, z, radius, fn)`
evita allocation al no construir array.

### Object pooling

`particles.js` mantiene free-list con índice `_idx` para acquire/release
O(1) (no `indexOf` O(n)). Cada partícula tiene su propio material cloned
para fade independiente.

## Testing patterns

### Mock de texturas

jsdom no implementa `canvas.getContext`. Cualquier módulo que llame a
`textures.js` debe mockease:

```js
vi.mock('@/game/textures', () => ({
  makeConcreteTextures: () => ({ map: {}, normalMap: {}, roughnessMap: {} }),
  makeUniformTexture: () => ({}),
  makeSkinTexture: () => ({}),
  makeGunMetalTexture: () => ({}),
}))
```

### Mock de Three.js (cuando hace falta)

Para tests que no necesitan meshes reales, mockea `three` con stubs
mínimos (Vector3 con `set/add/copy/clone`, etc.). En otros casos se importa
`three` real (vitest lo resuelve, pero las APIs de WebGL fallarán).

### Fake timers

Para i-frames, killstreaks, multikill windows, ragdoll cleanup:

```js
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
```

`vitest.config.js` ya tiene `clearMocks: true` y `restoreMocks: true`
globales, pero los timers hay que gestionarlos a mano.

### Convenciones

- Un `describe` por función/método o por concepto.
- Nombres de test: `'<situación> → <resultado esperado>'` o `'<función> hace X'`.
- Cubre edge cases: empty input, NaN, off-by-one, cycles, regressions.

## Cómo añadir contenido nuevo

### Nueva arma

1. Añade entrada en `WEAPONS` (en `src/game/config.js`) con todos los campos
   (ver `m4` como plantilla). Indica `minWave` o nivel de unlock.
2. Si quieres modelo propio: añade `buildXxx` en `src/game/viewmodels.js`
   con `track()` para registrar geometries. Añade caso en `buildViewModel`.
3. Si es unlocks por nivel: añade entrada en `UNLOCK_CATALOG`
   (`src/game/progression.js`).
4. Si tiene comportamiento especial (proyectil físico, etc.): modifica
   `player.js` `onShoot` con `freeShot` o tipo de munición distinto.
5. Test: añade caso en `loadout.test.js` si tiene perk/attachment interactions.

### Nuevo perk

1. Añade entrada en `PERKS` (`config.js`) con categoría (`blue/red/green`)
   y campo de efecto.
2. Implementa el efecto en `loadout.js` `applyLoadoutToWeapon` o en el
   subsistema correspondiente (`player.js` para marathon, `enemies.js`
   para coldBlooded, etc.).
3. Test en `loadout.test.js`.

### Nuevo attachment

1. Añade entrada en `ATTACHMENTS` (`config.js`) con `slot` y efecto.
2. Implementa el cálculo en `applyLoadoutToWeapon` (multiplicativo para
   daño/reload/speed/spread, aditivo para HP).
3. Test en `loadout.test.js`.

### Nuevo tipo de enemigo

1. Añade entrada en `ENEMY_TYPES` (`config.js`) con HP/velocidad/daño/range.
2. Si es shooter: marca `ranged: true` y configura `fireCooldown`.
3. Modifica `spawnWave` en `engine.js` para incluirlo en la composición.
4. Si tiene comportamiento IA distinto: añade estado en `ai.js`.
5. Test en `enemies.test.js` (spawn/count/dispose).

### Nueva killstreak

1. Reserva un slot (umbrales 3/5/7/11 — modifica si necesitas más).
2. Añade caso en `streaks.js` `activate(type)`.
3. Si es UI (como gunship): marca flag en `store.js` (`setGunshipActive`)
   y en `player.js` (`setGunshipActive`) para deshabilitar cámara normal.
4. Test en `streaks.test.js`.

## Trampas comunes / gotchas

- **No uses `Date.now()+Math.random()` para IDs**: usa `store.nextId()`
  (contador monotónico). Hubo bug de colisiones bajo fuego rápido.
- **`setTimeout` sin tracking**: si lo añades en `store.js`, usa `trackTimeout`.
  Si lo añades en otro módulo, asegúrate de cancelarlo en `reset()` o `dispose()`.
- **Material compartido + opacidad variable**: si necesitas fade/emissivo
  por instancia, CLONA el material (ver `decals.js`, `particles.js`,
  `enemies.js hitFlash`). Material compartido = flicker para todos.
- **`smoothstep` con edge0 === edge1**: NaN. La versión de `math.js` ya
  tiene guard, no reimplementes.
- **Diagonales A* que cruzan esquinas**: el navmesh las rechaza para evitar
  atravesar L-walls. Si añades un nuevo pathfinder, mantén el check.
- **Casas con rotación**: recalcula colliders DESPUÉS de
  `group.updateMatrixWorld(true)` (ver `world.js`).
- **Quality change mid-frame**: NO dispone shadow maps entre update y render.
  Marca `sun.shadow.needsUpdate = true` y aplica el cambio al inicio del
  siguiente frame (ver `engine.js` `pendingQuality`).
- **Pointer Lock requiere HTTPS o localhost**: en HTTP LAN hay fallback con
  cursor capturado en ventana. No rompas este fallback.
- **WebGL context loss**: el motor maneja `contextlost`/`contextrestored`.
  No añadas lógica que asuma que el renderer está siempre vivo.
- **StrictMode double-mount**: `engine.mount()` es idempotente. No rompas
  esta propiedad con flags de módulo que no se reseten en `dispose()`.
- **`config.js` no se muta en runtime**: `applyLoadoutToWeapon` devuelve
  una copia. No mutar el original o afecta a todas las armas del mismo tipo.
- **Tests con timers fake + mocks**: SIEMPRE `vi.runOnlyPendingTimers()`
  antes de `useRealTimers()`, si no quedan timers colgados que explotan
  en el siguiente test.

## Flujo recomendado al tocar código

1. Lee `config.js` primero: si lo que tocas es balance, modifícalo ahí.
2. Identifica el subsistema dueño de la lógica (ver mapa de archivos arriba).
3. Mira sus tests existentes antes de cambiar comportamiento.
4. Haz el cambio mínimo. Sigue el patrón factory + dispose si es recurso.
5. Lint + test + build antes de commit:
   ```bash
   docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c \
     "npm run lint && npm test && npm run build"
   ```
6. Si añadiste recurso Three.js: comprueba que `dispose()` lo libera.
7. Si añadiste estado en `store.js`: comprueba que `reset()` lo limpia.
8. Si añadiste timeout: wrap en `trackTimeout`.
