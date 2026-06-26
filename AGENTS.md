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
- `src/game/grenades.js` — granadas (frag, flash, smoke) con física de rebote.
- `src/game/decals.js` — decals de impacto de bala y splatter de sangre.
- `src/game/progression.js` — XP/niveles/unlocks con persistencia localStorage.
- `src/game/audio.js` — audio procedural + 3D posicional + música dinámica.
- `src/game/particles.js` — pool de partículas (sangre, chispas, humo).
- `k8s/` — manifiestos de Kubernetes.

## Convenciones

- `config.js` es la única fuente de verdad para balance. NO hardcodear
  valores de daño/munición/velocidad en otros ficheros (importa de config).
- Tiempos en `WEAPON` van en SEGUNDOS; `store.js` convierte a ms para
  `setTimeout`.
- Todo recurso Three.js (geometría/material/textura/envMap) debe disposal
  en su función `dispose()` correspondiente.
- `createEngine().mount()` es idempotente (StrictMode safe).
