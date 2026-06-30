# Modern Warfare React

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![React](https://img.shields.io/badge/React-18-61dafb)
![Three.js](https://img.shields.io/badge/Three.js-0.169-black)
![Tests](https://img.shields.io/badge/tests-473%20passing-brightgreen)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

> FPS tipo **Call of Duty** para navegador. React 18 + Three.js + Zustand.
> PvE por oleadas + PvP online (TDM). **Zero assets** — todo procedural.

## Quickstart

```bash
# Opción 1: Node local
npm install && npm run dev  # → http://localhost:9432

# Opción 2: Docker (recomendado)
docker run --rm -v "$PWD:/app" -w /app -p 9432:9432 node:20-alpine \
  sh -c "npm install && npm run dev"

# Opción 3: Producción
docker build -t mw-react . && docker run -p 9432:9432 mw-react
```

**Servidor multijugador** (puerto 9433):
```bash
npm run server  # o: docker build -f Dockerfile.server -t mw-server . && docker run -p 9433:9433 mw-server
```

## Features

| Categoría | Detalle |
|-----------|---------|
| **Mapas** | 5 mapas procedurales (Pamplona, Desert, Urban, Snow, Industrial) |
| **Armas** | 28 armas en 8 categorías (AR, SMG, LMG, Sniper, Marksman, Shotgun, Pistol, Launcher) |
| **Perks** | 22 perks en 3 categorías (blue/red/green) |
| **Attachments** | 35+ attachments en 6 slots |
| **Enemigos** | 5 tipos (walker, runner, tank, shooter, boss) con IA táctica A* |
| **Killstreaks** | 14 streaks (UAV, Airstrike, Heli, Gunship, AC130, Nuke...) |
| **Granadas** | 15 tipos (frag, flash, smoke, semtex, thermite, C4, claymore...) |
| **Field Upgrades** | 8 desplegables (Trophy, Recon, Munitions Box...) |
| **Game Modes** | 14 modos definidos (Survival, TDM, Dom, Hardpoint, S&D...) |
| **Progresión** | XP 1-55+, weapon levels, 6 camos, battle pass 100 tiers, prestige 10 |
| **MP** | WebSocket server, killfeed, spectator, spawn protection |
| **Visuales** | PBR textures, normal/roughness maps, SSAO, bloom, god rays, SMAA, ACES tone mapping, Preetham sky |
| **Audio** | 100% procedural (Web Audio API), 3D posicional HRTF, música dinámica |

## Controles

<details>
<summary>Ver todos los controles</summary>

| Tecla | Acción |
|-------|--------|
| WASD | Mover |
| SHIFT | Sprint |
| SHIFT×2 | Sprint táctico |
| CTRL | Agacharse / Slide |
| Z | Prone |
| SPACE | Saltar |
| F | Mantle |
| Q / E | Lean izq / der |
| V | Mantener respiración (sniper) |
| Click izq. | Disparar |
| Click der. | ADS |
| R | Recargar |
| Y | Cambiar arma |
| SHIFT+1-7 | Seleccionar arma |
| G | Granada letal (cook) |
| X | Granada táctica (cook) |
| C | Humo |
| B | Cuchillo |
| T | Field upgrade |
| 4-7 | Killstreaks |
| TAB | Scoreboard |
| ESC | Pausa |
| F8 | Profiler |

</details>

## Arquitectura

```
src/
  game/
    engine.js          Motor Three.js + post-procesado + game loop
    player.js          FPS controller (input, cámara, disparo, movement)
    enemies.js         Manager de enemigos (IA, hit-testing, ragdoll)
    ai.js              State machine táctica (8 estados)
    navmesh.js         Pathfinding A* con MinHeap
    config.js          ÚNICA fuente de verdad de balance
    store.js           Estado global Zustand (HUD + game state)
    world.js           Mundo procedural + SpatialGrid
    pamplona.js        Builder de casas, fuente, plaza de toros
    textures.js        PBR textures procedurales (color + normal + roughness)
    shaders/sky.js     Sky Preetham (atmospheric scattering)
    maps/              5 mapas (pamplona, desert, urban, snow, industrial)
    modes/             14 game modes definidos
    accessibility/     Keybinds, colorblind, subtitles
    performance/       Frame profiler, LOD, memory tracker
    backend/           Live service, store, prestige, seasons
    competitive/       Ranked, spectator, theater
    campaign/          5 misiones SP
  App.jsx              UI: menús + HUD + wiring del engine
  net/client.js        Cliente WebSocket MP
server/
  server.js            Servidor TDM (WebSocket, 20Hz)
  netcode.js           Anti-cheat, lag comp, delta snapshots
k8s/                   Manifiestos Kubernetes (kustomize)
```

## Development

```bash
npm run lint          # ESLint (0 warnings)
npm test              # 473 tests (Vitest + jsdom)
npm run build         # Vite build → dist/
```

Ver **[CONTRIBUTING.md](CONTRIBUTING.md)** para guía completa.

## Roadmap

Ver **[PLAN.md](PLAN.md)** para el roadmap completo (Fases 1-19).

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1-3 | ✅ Hecho | Base jugable: viewmodels, IA, MP, progresión |
| 4-17 | ✅ Esqueletos | Assets, arsenal, mapas, campaña, modos, netcode, ranked, backend |
| 18 | ✅ Hecho | Cablear código muerto + gameplay improvements (55 sub-fases) |
| 19 | 🔄 En progreso | Bug fixes + visuales + repo AAA |

## Tech Stack

- **React 18** + **Zustand** — UI y estado
- **Three.js 0.169** — renderizado WebGL2
- **Vite 5** — bundler y dev server
- **Vitest** — testing (jsdom)
- **ws** — servidor WebSocket MP
- **Docker** + **nginx** — deploy hardened
- **Kubernetes** — orchestration (kustomize)

## Licencia

[MIT](LICENSE)
