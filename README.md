# Modern Warfare React

FPS tipo Call of Duty para navegador, hecho en React + Three.js. Sobrevive a oleadas infinitas en una Pamplona procedural.

## Quickstart

### Con Docker (recomendado)

```bash
docker build -t modern-warfare-react:latest .
docker run -d --name modern_warfare -p 9432:9432 --restart unless-stopped \
  --security-opt no-new-privileges:true --cap-drop ALL --read-only \
  --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  modern-warfare-react:latest
```

El juego queda en **http://localhost:9432**

### Con Docker Com

```bash
docker compose up --build      # producción
docker compose --profile dev up # dev con hot-reload
```

### Servidor multijugador (opcional)

```bash
npm run server                 # puerto 9433
# o con Docker:
docker build -f Dockerfile.server -t mw-server .
docker run -p 9433:9433 mw-server
```

Conéctate desde el menú Multiplayer del juego a `ws://host:9433`.

## Controles

| Acción | Teclado | Mando |
|--------|---------|-------|
| Moverse | WASD | Stick izq. |
| Correr | Shift | L3 / bumper izq. |
| Sprint táctico | Shift×2 | — |
| Agacharse/Slide | Ctrl | — |
| Prone | Z | — |
| Saltar | Space | A |
| Lean izq./der. | Q / E | — |
| Disparar | Click izq. | RT |
| Apuntar (ADS) | Click der. | LT |
| Recargar | R | — |
| Cambiar arma | Shift+1-7 | — |
| Swap secondary | Y | — |
| Frag | G | — |
| Flash | X | — |
| Smoke | C | — |
| Throwing knife | B | — |
| Mantle | F | — |
| Hold breath (sniper) | V | — |
| Killstreaks | 4-7 (sin Shift) | — |
| Scoreboard | Tab | — |
| Pausa | Esc | — |

## Armas

| Arma | Categoría | Daño | Cadencia | Mag | Alcance |
|------|-----------|------|----------|-----|---------|
| M4 Carbine | AR | 34 | 10/s | 30 | 200 |
| AK-47 | AR | 40 | 9/s | 30 | 200 |
| MP5 | SMG | 25 | 12.5/s | 30 | 120 |
| Sniper | Sniper | 150 | 0.8/s | 5 | 400 |
| Shotgun | Shotgun | 20×8 | 1.4/s | 7 | 60 |
| LMG | LMG | 30 | 11/s | 100 | 250 |
| Pistol | Pistol | 28 | 6.7/s | 12 | 100 |

## Desarrollo

```bash
# Tests (jsdom)
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm test"

# Lint (0 warnings)
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run lint"

# Build
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run build"
```

## Despliegue

### Docker

Ver Quickstart arriba. La imagen usa nginx-unprivileged (no-root, read-only, cap-drop).

### Kubernetes

```bash
kubectl apply -k k8s/
# o con el helper:
./k8s/deploy.sh
```

Manifests en `k8s/`: deployment (3 réplicas), service, ingress, HPA, networkpolicy, PDB.

## Estructura

- `src/game/engine.js` — motor Three.js + post-procesado + game loop.
- `src/game/player.js` — FPS controller (input, cámara, disparo, ADS, slide, prone, lean).
- `src/game/enemies.js` — manager de enemigos (IA, hit-testing, dispose).
- `src/game/store.js` — estado global (Zustand): vida, munición, score, killstreaks.
- `src/game/config.js` — balance data-driven (ÚNICA fuente de verdad).
- `src/game/navmesh.js` — pathfinding A* con binary heap.
- `src/game/ai.js` — state machine táctica (engage, flank, cover, suppress).
- `src/game/pickups.js` — sistema de drops (salud, munición, granadas).
- `src/game/streaks.js` — killstreaks (UAV, airstrike, heli, gunship).
- `src/game/grenades.js` — granadas (frag, flash, smoke, knife).
- `server/server.js` — servidor WebSocket TDM.
- `k8s/` — manifiestos de Kubernetes.

## Licencia

MIT
