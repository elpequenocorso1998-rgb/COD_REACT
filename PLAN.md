# PLAN — Modern Warfare React → CoD-grade vendible

Roadmap ejecutable por fases. Cada fase es **independiente y shippable**.
Tras cada sub-fase: lint + tests + build + commit.

Estado de cada sub-fase: `[ ]` pendiente · `[~]` en progreso · `[x]` hecho.

---

## Convenciones (no negociables)

- `src/game/config.js` es la **única fuente de verdad** de balance. Cero
  hardcodeo de daño/munición/velocidad fuera de ahí.
- Tiempos en `WEAPON` van en **segundos**; `store.js` convierte a ms.
- Todo recurso Three.js (geometría/material/textura/envMap) debe tener
  `dispose()` propio.
- `createEngine().mount()` es **idempotente** (StrictMode safe).
- Lint con `--max-warnings 0`.
- Tests en `tests/` (vitest + jsdom). Texturas procedurales se mockean.
- No se añaden comentarios salvo que sean necesarios para no-ambigüedad.

---

## FASE 1 — Single-player CoD-grade pulido

Objetivo: convertir el survival actual en algo indistinguible de un CoD
single-player. Sin multijugador aún, pero base sólida para Fase 2.

### 1.1 Viewmodels por arma `[x]`

**Problema actual**: `player.js:74-141` construye UN solo rifle M4 que se
muestra para TODAS las armas (incluso pistol/sniper/shotgun). Inaceptable.

**Tareas**:
- Crear `src/game/viewmodels.js` con `buildViewModel(weaponId)` por cada
  una de las 7 armas de `config.js:41 WEAPONS`.
- Cada arma con geometría propia:
  - `m4` — rifle con stock táctico, rail, sight dot.
  - `ak47` — rifle con cañón curvo, mag curvo de madera.
  - `mp5` — SMG corto con stock retráctil.
  - `sniper` — rifle largo con scope cilíndrico.
  - `shotgun` — tubo + pump (corredera).
  - `lmg` — caja de munición + bípode.
  - `pistol` — corto, sin stock.
- `player.js` pasa a importar `buildViewModel(weaponId)` y a swap-ear
  el viewmodel al cambiar de arma (en `setWeapon`).
- Posiciones hipfire/ADS distintas por arma (más cerca para ADS de
  sniper, más lejos para LMG).
- Muzzle flash, shell eject, muzzle light ya existen en `player.js`;
  moverlos al constructor del viewmodel para que se ajusten por arma.
- `dispose()` del viewmodel anterior al cambiar.

**Verificación**: cambiar M4 → pistol → sniper → shotgun muestra modelos
distintos en pantalla. Lint + tests + build.

### 1.2 IA táctica + ragdoll `[x]`

**Problema actual**: `enemies.js:248 update()` = persecución recta + boids.
Parecen zombies, no soldados.

**Tareas**:
- Crear `src/game/navmesh.js` con pathfinding A* sobre triangulación del
  mapa (o grid de celdas walkable generado a partir de `world.colliders`).
- Refactor IA a behavior tree en `src/game/ai.js`:
  estados `Engage | Flank | TakeCover | Suppress | Retreat | Advance |
  Reload | Dead`.
- Cambiar composición de oleada en `engine.js:583 spawnWave`: 80%
  shooters armados, 20% melee runners (era al revés).
- Suppression: si el bot recibe fuego cerca (raycast del jugador dentro
  de 2m), entra en `TakeCover` por 2s.
- Cover system: raycasts horizontales desde el bot para encontrar
  coberturas cercanas.
- **Ragdoll al morir**: reemplazar `enemies.js:255` (rotar + hundir) por
  verlet sobre los huesos existentes de `humanoid.js:108`. Crear
  `src/game/ragdoll.js` con simulación simplificada.
- Hit reactions por zona (cabeza → muerto, pierna → cojea, brazo → suelta
  arma temporalmente).

**Verificación**: bots flanquean, se cubren, mueren con ragdoll natural.

### 1.3 Sistema de daño por zonas + ballistics `[x]`

**Problema actual**: `enemies.js:111 handleShot` solo distingue
head/body. Hitscan puro, sin penetración.

**Tareas**:
- Expandir `userData.part` en `humanoid.js:108` a: `head, neck, chest,
  stomach, leftArm, rightArm, leftLeg, rightLeg`.
- Añadir `DAMAGE_MULTIPLIERS` en `config.js`:
  `head×4, neck×2, chest×1, stomach×1.1, limbs×0.8`.
- `enemies.handleShot` aplica multiplier al daño del arma.
- **Bullet penetration**: raycast a través de `world.colliders` con
  reducción de daño según `type` (wall×0.3, crate×0.6).
- Bullet drop + travel time opcional para sniper/LMG (proyectil físico).
- Wallbang hitmarker (ya existe tipo `'wallbang'` en `audio.js:250`).

**Verificación**: tiro a la pierna no mata, a la cabeza sí. Disparar a
un enemigo detrás de una caja de madera le hace daño reducido.

### 1.4 Create-a-class + Perks + Attachments `[x]`

**Problema actual**: `progression.js:16 UNLOCK_CATALOG` son placeholders
vacíos.

**Tareas**:
- Definir `PERKS` en `config.js` con efectos:
  - `scavenger` — recoger munición de muertos.
  - `ghost` — invisible al UAV.
  - `coldBlooded` — sin hitmarker rojo al recibir daño.
  - `sleightOfHand` — `reloadTime × 0.5`.
  - `marathon` — sprint infinito.
  - `deadSilence` — pasos silenciosos.
  - `ninja` — sin sonido de equip al cambiar arma.
  - `commando` — mayor distancia de melee.
  - `lightweight` — `moveSpeedMul × 1.1`.
- Aplicar efectos en `player.js` y `store.js`.
- Definir `ATTACHMENTS` en `config.js` con efectos estadísticos:
  red dot, suppressor, foregrip, extended mags, laser, holographic,
  ACOG, compensator, stock.
- **Create-a-class UI** en `App.jsx`:
  primary + secondary + tactical + lethal + 3 perks + 3 killstreaks.
- Guardar loadout en `progression.js` (localStorage por ahora).
- Equipar attachment cambia stats del arma en runtime.

**Verificación**: equipar Sleight of Hand recarga 2x más rápido. Equipar
extended mags sube `magSize` a 45.

### 1.5 Movimiento moderno `[x]`

**Tareas**:
- **Mantling/vaulting**: raycasts en `player.js` detectan borde de
  obstáculo a altura de pecho; animar subida.
- **Mantener respiración** (sniper): Shift derecho reduce sway 5s.
- **Slide cancel + slide-jump**.
- **Stamina** para sprint (barra nueva en HUD, `App.jsx:244`).
- **Footstep audio por superficie**: `audio.js:439 playFootstep` existe
  pero no se llama. Detectar material bajo player y emitir pasos según
  cadencia.
- **Drop shot** (prone mientras disparas) y **jump shot**.

**Verificación**: saltar un bidón y ver mantle. Sprintar gasta stamina.

### 1.6 Interiores transitables + verticalidad `[ ]`

**Problema actual**: las casas de `pamplona.js:161` son sólidas.

**Tareas**:
- Hacer al menos **4 edificios con interiores** en `pamplona.js`:
  planta baja + escalera + azotea. Collider solo en muros exteriores.
- Añadir escaleras y rampas al mapa.
- Azoteas transitables para combate vertical (snipers).
- Abrir algunas puertas como portales.

**Verificación**: entrar en una casa y disparar desde la ventana.

### 1.7 Visuales `[ ]`

**Tareas**:
- **Cascaded Shadow Maps** (CSM) en `engine.js:64 sun` (ahora 1 sola
  shadow camera para 220u → sombras pixeladas lejos).
- **Screen-space reflections** para suelos mojados (charcos).
- Mejor agua en `pamplona.js:491` (refracción + oleaje).
- Mejores character models (PBR + normal maps) en `humanoid.js`.
- TAA opcional.

**Verificación**: sombras nítidas hasta 50u, suaves más allá.

### 1.8 UI/UX CoD-grade `[ ]`

**Tareas**:
- Refactorizar `App.jsx:309 MainMenu` a menú con tabs:
  **Play / Operators / Weapons / Barracks / Store / Settings**.
- **Settings** completo: FOV slider, sensibilidad X/Y separada,
  keybinding, volúmenes, calidad manual (ya existe auto en `quality.js`).
- **Killcam**: grabar últimos 5s del jugador en `engine.js` con frame
  buffer circular, reproducir al morir.
- **Spectator mode**: tras muerte, seguir a bots con cámara orbit.
- **Banner de scorestreak**: "ENEMY UAV SPOTTED" etc.
- **Scoreboard con assists/ping** en MP (placeholder para Fase 2).

**Verificación**: morir y ver killcam.

### 1.9 Calidad ship `[ ]`

**Tareas**:
- **i18n**: extraer strings de `App.jsx` y `styles.css` a `src/i18n.js`
  con es/en.
- **Gamepad support** con aim assist (lib `gamepad.js` estándar).
- **Accesibilidad**: colorblind mode, subtitles, aim assist slider.
- **E2E tests con Playwright** (ya en `package.json:18` pero sin tests).
- **Crash reporting** (Sentry SDK opcional).

**Verificación**: jugar con gamepad en inglés sin crashes.

---

## FASE 2 — Multijugador online

Objetivo: PvP real. Es lo que más vende de CoD.

### 2.1 Backend de juego `[ ]`

- Servidor Node.js con WebSocket (o **Colyseus**) en nuevo `server/`.
- Estado autoritativo: mover game state de `store.js` (local) al server.
  Cliente solo envía inputs.
- Tick rate 60Hz server, 20Hz snapshot a clientes.
- **Lag compensation**: histórico de posiciones últimos 200ms para
  hit-reg "favor the shooter".
- **Client-side prediction**: cliente predice su movimiento (`player.js`
  se reaprovecha), server reconcilia.
- **Interpolación** de entidades remotas a 100ms.
- Dockerizar server (`Dockerfile.server`).

### 2.2 Modos de juego `[ ]`

En nuevo `src/game/modes/`:
- TDM (75 kills gana).
- FFA (30 kills).
- Domination (3 puntos A/B/C).
- Search & Destroy (bomba, no respawn).
- Hardpoint (punto rotatorio).
- Kill Confirmed (recoger placas).

### 2.3 Matchmaking + lobbies `[ ]`

- Lobby system: party de hasta 6, matchmaking por MMR + ping.
- server browser para partidas custom.
- dedicated servers regionales (EU/NA/SA/Asia) — extender `k8s/`.

### 2.4 UI de MP `[ ]`

- Lobby UI con party, chat de voz (WebRTC), loadout editor, ready up.
- Scoreboard con ping/MMR/assists.
- Final killcam + match summary.
- Spectator mode completo (cámara libre + follow).
- server browser.

### 2.5 Seguridad `[ ]`

- Anti-cheat server-side: validación de inputs imposibles.
- Rate limiting por IP.
- Reports & moderation.

---

## FASE 3 — Meta / Live service

Objetivo: monetización y retención a largo plazo.

### 3.1 Cuentas y progresión cross-platform `[ ]`

- Login: email + OAuth (Google/Steam/Discord).
- Backend de inventario (sustituir `progression.js:11 localStorage`).
- Cross-progression web/Steam/móvil.

### 3.2 Monetización `[ ]`

- **Battle Pass** seasonal (100 tiers, ~€10).
- **In-game store**: skins de arma, operator skins, calling cards,
  emblems, sprays, finishers.
- **Weapon cases** (opcional, regulatorio según región).
- Battle Pass con tiers gratis + premium.

### 3.3 Meta progression `[ ]`

- **Weapon leveling**: cada arma sube de nivel (no solo player), unlocks
  attachments por arma.
- **Prestige** tras nivel max.
- **Camos desbloqueables** por arma (gold, diamond, obsidian).
- **Daily/weekly challenges**.
- **Season events**.

### 3.4 Live ops `[ ]`

- Seasonal content drops cada 2-3 meses (mapa/arma/operator nuevo).
- Telemetry/analytics (qué armas se usan, win rates, churn).
- A/B testing de balance en `config.js`.
- Featured playlists rotatorios.

### 3.5 Mobile / cross-platform `[ ]`

- Touch controls con aim assist agresivo.
- Controller support en móvil.
- Performance budget para móvil (LOW en `quality.js`).

---

## Verificación global

| Fase | Cómo saber que está hecho |
|------|---------------------------|
| 1 | Cambiar M4→pistol muestra modelo distinto; bots flanquean y mueren con ragdoll; killcam al morir |
| 2 | Partida TDM 6v6 con amigos en distintos PCs, sin desync, hit-reg consistente |
| 3 | Usuario puede registrarse, comprar battle pass, subir nivel de arma, desbloquear camo |

Comando de verificación tras cada sub-fase:

```bash
docker run --rm -v "$PWD:/app" -w /app node:20-alpine sh -c "npm run lint && npm test && npm run build"
```

---

## Orden de ejecución dentro de Fase 1

1. **1.1 Viewmodels por arma** — impacto visual inmediato
2. **1.2 IA táctica + ragdoll** — mejora de "feel" más grande
3. **1.3 Damage zones + ballistics** — natural tras 1.2
4. **1.4 Create-a-class + perks** — meta sin backend
5. **1.5 Movimiento moderno**
6. **1.6 Interiores transitables**
7. **1.7 Visuales (CSM, SSR)**
8. **1.8 UI/UX (killcam + settings)**
9. **1.9 i18n + gamepad + accesibilidad**

---

## Progreso

- [x] PLAN.md escrito
- [x] Fase 1.1 — viewmodels por arma (m4, ak47, mp5, sniper, shotgun, lmg, pistol)
- [x] Fase 1.2 — IA táctica (state machine) + navmesh A* + ragdoll verlet + suppress
- [x] Fase 1.3 — daño por zonas (head/neck/chest/stomach/limbs) + wallbang
- [x] Fase 1.4 — create-a-class + perks + attachments (UI + persistencia)
- [x] Fase 1.5 — stamina + mantling + respiración (sniper) + footstep audio
- [ ] Fase 1.6
- [ ] Fase 1.7
- [ ] Fase 1.8
- [ ] Fase 1.9
- [ ] Fase 2
- [ ] Fase 3
