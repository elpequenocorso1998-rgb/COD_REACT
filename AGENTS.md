# AGENTS.md — Guía para asistentes (opencode, etc.)

## Comandos clave

Este proyecto NO tiene Node instalado en el host; se ejecuta vía Docker.

### Tests
```
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm test"
```
Entorno de test: `jsdom` (definido en `vitest.config.js`). Los tests que
toquen `document`/`canvas` necesitan el módulo `jsdom` (ya en devDeps).
Las texturas procedurales usan `document.createElement('canvas').getContext`
que jsdom no implementa: en tests, mockéalas con `vi.mock`.

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
```

## Estructura

- `src/game/engine.js` — motor Three.js + post-procesado + game loop.
- `src/game/player.js` — FPS controller (input, cámara, disparo, ADS, slide, prone, lean).
- `src/game/enemies.js` — manager de enemigos (IA melee + shooters, hit-testing, dispose).
- `src/game/humanoid.js` — humanoide anatómico + animación de caminar.
- `src/game/store.js` — estado global (Zustand): vida, munición, score, killstreaks, XP.
- `src/game/config.js` — balance data-driven (ÚNICA fuente de verdad) + catálogo WEAPONS.
- `src/game/constants.js` — constantes de render/motor.
- `src/game/minimap.js` — minimap canvas 2D (rotate-with-player).
- `src/game/streaks.js` — killstreaks (UAV, airstrike, heli, gunship).
- `src/game/grenades.js` — granadas (frag, flash, smoke, knife) con física de rebote.
- `src/game/pickups.js` — sistema de drops (salud, munición, granadas) + scavenger.
- `src/game/decals.js` — decals de impacto de bala y splatter de sangre.
- `src/game/progression.js` — XP/niveles/unlocks con persistencia localStorage.
- `src/game/audio.js` — audio procedural + 3D posicional + música dinámica.
- `src/game/particles.js` — pool de partículas (sangre, chispas, humo).
- `src/game/ai.js` — state machine táctica (engage, flank, cover, suppress, retreat).
- `src/game/navmesh.js` — pathfinding A* con binary heap.
- `src/game/world.js` — mundo procedural (Pamplona: plaza, casas, murallas).
- `src/game/pamplona.js` — builder de casas, fuente, plaza de toros.
- `src/game/viewmodels.js` — modelo 3D propio por arma (M4, AK, MP5, etc).
- `src/game/ragdoll.js` — simulación verlet para caída de enemigos.
- `src/game/remote-players.js` — renderizado + hit detection de jugadores MP.
- `src/game/environment.js` — env map procedural (PMREM).
- `src/game/quality.js` — escalado de calidad dinámico por FPS.
- `src/game/loadout.js` — create-a-class (perks, attachments, secondary).
- `src/game/settings.js` — preferencias del jugador (FOV, sens, volúmenes).
- `src/game/meta.js` — stats, battle pass, weapon mastery, dailies.
- `src/net/client.js` — cliente WebSocket para MP.
- `src/i18n.js` — internacionalización (es/en).
- `server/server.js` — servidor WebSocket TDM.
- `k8s/` — manifiestos de Kubernetes.

## Convenciones

- `config.js` es la única fuente de verdad para balance. NO hardcodear
  valores de daño/munición/velocidad en otros ficheros (importa de config).
- Tiempos en `WEAPON` van en SEGUNDOS; `store.js` convierte a ms para
  `setTimeout`.
- Todo recurso Three.js (geometría/material/textura/envMap) debe disposal
  en su función `dispose()` correspondiente.
- `createEngine().mount()` es idempotente (StrictMode safe).
