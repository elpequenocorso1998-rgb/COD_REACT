# PLAN — Modern Warfare React → CoD-grade vendible

Roadmap ejecutable por fases. Cada fase es **independiente y shippable**.
Tras cada sub-fase: lint + tests + build + commit.

Estado de cada sub-fase: `[ ]` pendiente · `[~]` en progreso · `[x]` hecho.

> **Alcance ampliado (Fases 4-17)**: las Fases 1-3 entregan el esqueleto
> jugable web (procedural, zero-assets). Las Fases 4-17 llevan el
> proyecto a un **CoD real**: assets GLTF + animación esquelética, gunsmith
> completo, 5+ mapas, campaña SP, Warzone/BR, ranked/competitivo, netcode
> AAA, crossplay/móvil, backend de cuentas, live service, visuales/audio
> AAA, performance y QA profesional. Es ambicioso pero cada sub-fase es
> shippable por sí sola.

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

### 1.6 Interiores transitables + verticalidad `[x]`

**Problema actual**: las casas de `pamplona.js:161` son sólidas.

**Tareas**:
- Hacer al menos **4 edificios con interiores** en `pamplona.js`:
  planta baja + escalera + azotea. Collider solo en muros exteriores.
- Añadir escaleras y rampas al mapa.
- Azoteas transitables para combate vertical (snipers).
- Abrir algunas puertas como portales.

**Verificación**: entrar en una casa y disparar desde la ventana.

### 1.7 Visuales `[x]`

**Tareas**:
- **Cascaded Shadow Maps** (CSM) en `engine.js:64 sun` (ahora 1 sola
  shadow camera para 220u → sombras pixeladas lejos).
- **Screen-space reflections** para suelos mojados (charcos).
- Mejor agua en `pamplona.js:491` (refracción + oleaje).
- Mejores character models (PBR + normal maps) en `humanoid.js`.
- TAA opcional.

**Verificación**: sombras nítidas hasta 50u, suaves más allá.

### 1.8 UI/UX CoD-grade `[x]`

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

### 1.9 Calidad ship `[x]`

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

> **Estado**: base funcional implementada (servidor WebSocket + cliente +
> remote players + TDM + UI). Faltan: anti-cheat real (2.5), modos extra
> (2.2 más allá de TDM), matchmaking (2.3), voice chat (2.4).

### 2.1 Backend de juego `[x]`

- Servidor Node.js con WebSocket (`ws`) en `server/server.js`.
- Estado autoritativo: el servidor mantiene posiciones de todos los
  jugadores y broadcastea snapshots a 20Hz.
- Recibe inputs de clientes a 60Hz. Modelo "trusted client" de momento
  (Fase 2.5 añadirá validación real).
- TDM: 2 equipos (axis/allies), 75 kills gana, respawn tras 3s.
- Dockerizado en `Dockerfile.server` (puerto 9433).
- Script `npm run server` para arrancar en dev.

### 2.2 Modos de juego `[~]`

- [x] TDM (Team Deathmatch) — 75 kills gana.
- [ ] FFA (Free For All).
- [ ] Domination (3 puntos A/B/C).
- [ ] Search & Destroy (bomba, no respawn).
- [ ] Hardpoint (punto rotatorio).
- [ ] Kill Confirmed (recoger placas).

### 2.3 Matchmaking + lobbies `[ ]`

- [ ] lobby system: party de hasta 6, matchmaking por MMR + ping.
- [ ] server browser para partidas custom.
- [ ] dedicated servers regionales (EU/NA/SA/Asia).

### 2.4 UI de MP `[~]`

- [x] Pantalla de conexión (MultiplayerScreen con URL input).
- [x] Killfeed en HUD (últimos 5 kills).
- [x] Team scores en HUD (axis vs allies).
- [x] MatchOver screen con ganador y scores finales.
- [ ] Lobby UI con party y ready up.
- [ ] Final killcam.
- [ ] Spectator mode completo (cámara libre + follow).
- [ ] server browser.

### 2.5 Seguridad `[ ]`

- [ ] Anti-cheat server-side: validación de inputs imposibles.
- [ ] Rate limiting por IP.
- [ ] Reports & moderation.

---

## FASE 3 — Meta / Live service

Objetivo: monetización y retención a largo plazo.

> **Estado**: base implementada (weapon leveling, camos, battle pass,
> daily challenges, Barracks UI). Faltan: cuentas online (3.1),
> monetización real (3.2), prestige (3.3), seasons (3.4), mobile (3.5).

### 3.1 Cuentas y progresión cross-platform `[ ]`

- [ ] Login: email + OAuth (Google/Steam/Discord).
- [ ] Backend de inventario (sustituir `progression.js:11 localStorage`).
- [ ] Cross-progression web/Steam/móvil.

> Nota: ahora mismo toda la progresión es local (localStorage). Para
> producción real necesitaría un backend de cuentas. El esqueleto de
> progression.js está listo para migrar a una API.

### 3.2 Monetización `[~]`

- [x] **Battle Pass** esqueleto: 100 tiers, XP por tier, premium flag.
- [x] Catálogo de recompensas BP por tier (BP_REWARDS en meta.js).
- [ ] In-game store: skins de arma, operator skins, calling cards.
- [ ] Integración con pasarela de pago (Stripe/Steam).
- [ ] Loot boxes (opcional, regulatorio).

### 3.3 Meta progression `[~]`

- [x] **Weapon leveling**: cada arma sube de nivel (max 30), unlocks
  attachments por arma (en progression.js: addWeaponXP, getWeaponLevel).
- [x] **Camos desbloqueables** por arma: spray, woodland, digital,
  dragon, gold, diamond (a nivel 5/10/15/20/25/30).
- [x] **Daily challenges**: 3 aleatorias por día, auto-claim con XP.
- [ ] Prestige tras nivel max.
- [ ] Season events.

### 3.4 Live ops `[ ]`

- [ ] Seasonal content drops cada 2-3 meses (mapa/arma/operator nuevo).
- [ ] Telemetry/analytics (qué armas se usan, win rates, churn).
- [ ] A/B testing de balance en `config.js`.
- [ ] Featured playlists rotatorios.

### 3.5 Mobile / cross-platform `[ ]`

- [ ] Touch controls con aim assist agresivo.
- [ ] Controller support en móvil.
- [ ] Performance budget para móvil (LOW en `quality.js`).

---

## FASES 4-17 — Hacia un CoD real

Las Fases 1-3 entregan el esqueleto jugable web (zero-assets, procedural).
Las siguientes lo convierten en un producto AAA. **Grafo de dependencias**:

```
4 (assets+anim) ──┬─→ 5 (gunsmith)   ──┐
                  ├─→ 6 (mapas)         ├─→ 8 (modos: Warzone/Ground War/Gunfight)
                  └─→ 14 (visuales AAA) ┤
                                       │
9 (netcode AAA) ──┬─→ 10 (ranked)      ├─→ 11 (crossplay/móvil) ──→ 12 (backend)
                  └─→ 8                │
7 (campaña SP) ← 4 + IA existente      │
13 (live service) ← 12                 │
15 (audio AAA) ← 4                     │
16 (performance) ← 14 + 11             │
17 (QA/polish) ← todo                  │
```

Orden sugerido: 4 → 5 + 6 + 7 (paralelizables) → 9 → 8 → 10 → 12 → 11
→ 13 → 14 + 15 → 16 → 17.

### FASE 4 — Asset pipeline real + animación esquelética

**Objetivo**: reemplazar primitivas por assets GLTF y audio samples, con
fallback procedural. Sin esto, el juego nunca se verá como CoD.

#### 4.1 Asset loader + manifest `[ ]`
- Crear `src/game/assets/loader.js` con `loadManifest(jsonUrl)` (URLs,
  hashes SHA-256, dependencias).
- Integrar `GLTFLoader` + `DRACOLoader` + `KTX2Loader` en `engine.js`.
- CDN vía Vite env `VITE_CDN_URL` con fallback a `/assets/`.
- Cache en IndexedDB (chunked) para no redescargar.
- Progress bar en `App.jsx` (extender `store.loading`).
- `AssetLoader.dispose()` libera geometries/materials/textures.

#### 4.2 Viewmodels GLTF `[ ]`
- Migrar `viewmodels.js` (primitivas) a modelos GLTF por arma.
- Mantener `buildViewModel(weaponId)` API para no romper `player.js`.
- Skeletal animations: idle, draw, reload, ADS in/out, inspect, sprint
  pose, fire (semi + auto), last shot.
- Hand rig (first-person hands) skinned mesh.
- Procedural fallback si el GLTF falla (lo actual se queda como backup).

#### 4.3 Character models GLTF `[ ]`
- Migrar `humanoid.js` (primitivas) a GLTF skinned mesh (operator base).
- Animaciones: idle/walk/run/crouch/prone/jump/slide/death ×4/flinch
  por zona (head/torso/limbs).
- `enemies.js` usa el mismo modelo con variantes de material (uniform,
  helmet, vest).
- `remote-players.js` usa el skinned mesh en MP.

#### 4.4 Animation graph `[ ]`
- `src/game/anim/graph.js`: state machine con blend trees y
  transiciones por parámetros (`speed`, `isAiming`, `isReloading`,
  `healthPct`, `stance`).
- IK procedural para hands sobre weapon (aim pose).
- Camera shake / weapon bob / sway (parcial en `player.js`, ampliar).
- Motion blur per-object (Three.js o aproximación velocity-buffer).
- `dispose()` de todos los `AnimationMixer` y tracks.

#### 4.5 Audio samples + 3D engine `[ ]`
- Cargar samples reales (fire, reload, footsteps, explosions,
  hitmarkers, ambient, foley).
- Migrar `audio.js` a sample-based con fallback procedural (lo actual).
- HRTF posicional + occlusion/obstruction vía raycast.
- Reverb zones (convolver con impulse responses por área del mapa).
- Música stem-based (calma / combate / clímax / death).

**Verificación**: cambiar M4→AK muestra GLTF real con animación de
recarga. Disparo suena a sample real. Enemigo muere con anim+ragdoll
transitional. Lint + tests + build.

---

### FASE 5 — Gunsmith avanzado + arsenal expandido

**Objetivo**: igualar MW2/WZ en variedad y customización.

#### 5.1 Arsenal 25+ armas `[ ]`
- Ampliar `WEAPONS` en `config.js` a todas las categorías:
  - **AR** (5+): M4, AK-47, Kilo 141, Grau 5.56, FR 5.56, Oden.
  - **SMG** (5+): MP5, MP7, P90, Uzi, AUG.
  - **LMG** (3+): M91, PKM, Holger.
  - **Shotgun** (3+): Model 680, R9-0, 725.
  - **Sniper** (3+): HDR, AX-50, Rytec.
  - **Marksman** (3+): EBR-14, MK2, Kar98k.
  - **Pistol** (4+): X16, 1911, Renetti, Deagle.
  - **Launcher** (3+): RPG, PILA, JOKR.
  - **Melee** (4+): knife, bat, katana, sai.
- Cada arma con GLTF viewmodel (Fase 4.2) y stats balanceadas.
- Unlock por nivel en `progression.js UNLOCK_CATALOG`.

#### 5.2 Platform / receiver system `[ ]`
- Armas comparten "receiver" (M4 platform: M4, M16, Grau — mismo
  receiver, diferencias en barrel/stock/grip).
- Reduce modelado: 1 receiver + N barrels/stocks/grips combinables.
- `WEAPON_PLATFORMS` en `config.js`.

#### 5.3 Attachments expandidos (60+) `[ ]`
- 5+ slots por arma: sight, barrel, underbarrel, mag, stock, muzzle,
  laser, perk.
- Cada attachment afecta ≥1 stat con tradeoff (no upgrades puros).
- Tuning visual: stats bars en UI (`App.jsx` loadout).

#### 5.4 Field upgrades `[ ]`
- 8+ field upgrades: Trophy System, Dead Silence (field), EMP,
  Deployable Cover, Recon Drone, Munitions Box, Recon Tower,
  Suppressing Drone.
- Charge timer, deployable entity con `update()` propio en
  `src/game/field-upgrades.js`.

#### 5.5 Tacticals + lethals ampliados `[ ]`
- Tacticals: stun, gas, smoke, flash, decoy, snapshot, stim, heartbreaker.
- Lethals: frag, semtex, thermite, molotov, C4, claymore, proximity
  mine, throwing knife, thermobaric, shuriken.
- `GRENADES` en `config.js` ampliado (sin mutar el catálogo base).

#### 5.6 Custom classes múltiples `[ ]`
- 10+ custom classes (save slots en `loadout.js`).
- UI para nombrar, duplicar, resetear.

#### 5.7 Firing range `[ ]`
- Mapa dedicado para testear armas/attachments.
- Targets con daño por zona visible.
- Dummies a varias distancias.

**Verificación**: crear clase con M4 + 5 attachments, ver stats cambiar
en UI, probar en firing range. Lint + tests + build.

---

### FASE 6 — Más mapas y entornos

**Objetivo**: 5-10 mapas distintos (Pamplona ya está).

#### 6.1 Map library `[ ]`
- Migrar `world.js` a `createWorld(mapId)` con mapas:
  - `pamplona` (actual).
  - `desert` (dunas, outpost militar).
  - `urban` (ciudad moderna destruida).
  - `snow` (base ártica).
  - `industrial` (fábrica + tanques).
  - `military_base` (hangares + barracas).
  - `coastal` (puerto + barcos).
- Cada mapa con `colliders`, `navmesh` propio, spawn points, sky config.

#### 6.2 Map voting + pre-game `[ ]`
- Vote screen en `App.jsx` (3 mapas aleatorios, veto).
- Map preview 3D orbit antes de empezar.

#### 6.3 Dynamic time/weather `[ ]`
- Day/night cycle (sol de `shaders/sky.js` rotando).
- Lluvia, niebla, nieve (particle system).
- Reflejos en suelo mojado (SSR ya en roadmap Fase 1.7).

#### 6.4 Map events `[ ]`
- Door breach (explosión + debris).
- Player-triggered events (alarma, lights off, reinforcements).

**Verificación**: jugar TDM en 3 mapas distintos sin reiniciar el server.
Lint + tests + build.

---

### FASE 7 — Campaña SP completa

**Objetivo**: story mode con misiones, no solo survival.

#### 7.1 Mission system `[ ]`
- `src/game/campaign/missions.js` con lista de misiones (8-12).
- Cada misión: `mapId`, `objectives[]`, `allies[]`, `enemies[]`,
  `cinematics[]`, `winCondition`.
- Objective types: `kill_target`, `reach_point`, `defend`, `extract`,
  `plant_explosive`, `follow_npc`, `survive_timer`.

#### 7.2 Ally NPCs `[ ]`
- Squadmates con IA aliada (cover, suppress, revive).
- Voice lines (callouts: "reloading", "enemy spotted", "down").
- `ai.js` extendido con `faction: 'player' | 'enemy'`.

#### 7.3 Cinematics `[ ]`
- `src/game/campaign/cinematics.js`: camera sequences con keyframes.
- Machinima (in-engine) o pre-rendered (video overlay).
- Skip button.

#### 7.4 Difficulty levels `[ ]`
- Recruit / Regular / Hardened / Veteran.
- Afecta HP enemigos, accuracy, HP jugador, AI aggression.
- `DIFFICULTY` en `config.js`.

#### 7.5 Vehicle sections `[ ]`
- Turret section (jeep/heli/tanque).
- Heli section (piloteable con WASD).
- Rail shooter sections.

#### 7.6 Mission UI `[ ]`
- Mission selector con capítulos.
- Briefing screen (text + map).
- Mission stats (time, accuracy, kills) al final.

**Verificación**: completar misión 1 "Operator" con cinematics + 2
objectives + extract. Lint + tests + build.

---

### FASE 8 — Modos de juego extras

**Objetivo**: igualar variedad de modos de MW.

#### 8.1 Battle Royale / Warzone `[ ]`
- Mapa grande (4 km²) con POIs.
- Contraction zone (gas, daño escalante).
- Loot system (ground loot + crates + supply drops).
- Squads: solo/duo/trio/quad.
- Gulag (1v1 respawn al inicio).
- Buy stations (cash + items).
- Loadout drops (event).
- 60-100 players.
- Resurgence mode (auto-respawn).

#### 8.2 Ground War `[ ]`
- 32v32, vehicles (jeeps, tanques, helis).
- Mapa grande con capturas.
- Vehicle physics + controls.

#### 8.3 Gunfight `[ ]`
- 2v2, rounds 40s, weapon rotation per round.
- Overtime capture flag.

#### 8.4 Search & Destroy competitive `[ ]`
- Bomb plant/defuse, no respawn.
- 6v6, best of 11.

#### 8.5 Hardcore mode `[ ]`
- No HUD, 1-shot kill (35 HP jugador), friendly fire.

#### 8.6 Party modes `[ ]`
- Infected (1 vs all, infectados son runners).
- Prop Hunt.
- Gun Game (arma cambia por kill).
- One in the Chamber.

#### 8.7 Free For All `[ ]`
- (Migrado de Fase 2.2.)
- 8 players, 30 kills gana.

#### 8.8 Domination / Hardpoint / Kill Confirmed `[ ]`
- (Migrados de Fase 2.2.)

**Verificación**: entrar a Warzone con 60 bots, jugar 1 partida completa
hasta último vivo. Lint + tests + build.

---

### FASE 9 — Netcode AAA

**Objetivo**: hit-reg consistente, sin desync, sin lag visible.

#### 9.1 Server-authoritative movement `[ ]`
- `server/server.js` valida posiciones (speed cap, noclip check).
- Client-side prediction + reconciliation (autoritativo).
- Input buffering (120 Hz) + snapshot interpolation (20 Hz snap).

#### 9.2 Lag compensation `[ ]`
- "Favor the shooter": rewind server world al tick del cliente al
  validar hit.
- Hit registration server-side (no trusted-client como ahora).
- Interp delay 100ms.

#### 9.3 Tickrate upgrade `[ ]`
- Snapshot 60 Hz (vs 20 actual).
- Input 120 Hz.
- Snapshot delta compression (solo cambios).

#### 9.4 Anti-cheat server-side `[ ]`
- Validation de inputs imposibles (velocidad, fire rate, FOV).
- Rate limiting por IP.
- Heuristics (HS rate, K/D ratio, tracking speed).
- Ban system (account + HWID).
- Replay upload en reportes.

#### 9.5 Reconnect + matchmaking drop-in `[ ]`
- Reconnect si DC < 30s (sin perder stats).
- Mid-match drop-in (respawn tras 5s).

**Verificación**: jugar con 100ms ping simulado y matar a alguien
corriendo sin queja de hit-reg. Lint + tests + build.

---

### FASE 10 — Competitivo / Ranked / Esports

**Objetivo**: igualar CDL.

#### 10.1 CDL ruleset `[ ]`
- Hardpoint, S&D, Control.
- Mapas restringidos (3 por modo).
- Armas/attachments/perks baneados.
- 4v4.

#### 10.2 Ranked ladder `[ ]`
- SR (Skill Rating) ELO-like.
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Crimson →
  Iridescent → Top 250.
- Seasons 1 mes.
- Rewards por tier.

#### 10.3 Spectator mode `[ ]`
- Cámara libre (fly).
- Follow player (1st/3rd person).
- Director mode (auto-cameras inteligente).
- X-ray (ver enemigos a través de walls).
- Picture-in-picture.

#### 10.4 Theater / replay `[ ]`
- Record demos (server-side).
- Replay UI con timeline, cámara libre.
- Share highlights (export video).

#### 10.5 Pause/dispute `[ ]`
- Pause tactical (1 por equipo, 30s).
- Dispute system (report resultado).

**Verificación**: subir de Bronze a Silver en 5 partidas. Lint + tests +
build.

---

### FASE 11 — Crossplay / Mobile / Native

**Objetivo**: jugar desde cualquier dispositivo con cualquier input.

#### 11.1 Touch controls `[ ]`
- Virtual sticks (move + look).
- Fire buttons (primary, ADS, lethal, tactical).
- Gestures (swipe para knife, drag para grenade arc).
- Gyro aim (con toggle).
- Aim assist agresivo (rotation + slowdown).

#### 11.2 Input-based matchmaking `[ ]`
- Pools: MnK only / Controller only / Mixed.
- Crossplay toggle.

#### 11.3 Native desktop `[ ]`
- Electron / Tauri wrapper.
- Steam integration (achievements, rich presence, workshop).
- Steam Deck verified.

#### 11.4 Mobile builds `[ ]`
- PWA (offline-first).
- iOS/Android via Capacitor.
- App Store / Play Store submission.

#### 11.5 Performance budget móvil `[ ]`
- LOW quality por defecto (en `quality.js`).
- 30 FPS target.
- Dynamic resolution scaling.
- Thermal throttling detect (reducir calidad si calienta).
- Memoria < 1GB.

**Verificación**: jugar partida MP en iPhone mid-range a 30fps estables.
Lint + tests + build.

---

### FASE 12 — Online services / Backend / Cuentas

**Objetivo**: reemplazar `localStorage` por backend real.

#### 12.1 Account system `[ ]`
- Login: email + password, OAuth (Google, Steam, Discord, Apple, Sony).
- JWT tokens + refresh.
- 2FA opcional.

#### 12.2 Inventario backend `[ ]`
- API REST/GraphQL para inventario (reemplaza `progression.js`
  localStorage).
- DB: Postgres (users, inventory, matches) + Redis (sessions,
  matchmaking).
- Migración: al primer login, sincronizar `localStorage` → backend.

#### 12.3 Matchmaking `[ ]`
- MMR + ping + input + party.
- Pool regions: EU, NA-E, NA-W, SA, Asia.
- Queue times < 30s.

#### 12.4 Dedicated servers regionales `[ ]`
- Game server binary deployable en cloud (AWS GameLift, GCP Agones).
- Auto-scaling por region.
- Server browser (custom games).

#### 12.5 Social `[ ]`
- Friends list + invites.
- Party system (6 jugadores, party chat).
- Clans/regiments.

#### 12.6 Voice chat `[ ]`
- WebRTC posicional (proximity chat).
- Party voice (no posicional).
- Push-to-talk + open mic.

#### 12.7 Rich presence + integrations `[ ]`
- Discord RPC.
- Steam rich presence.

#### 12.8 Telemetry / analytics `[ ]`
- Event tracking (armas, win rates, churn, accidents).
- A/B testing de balance en `config.js`.
- Crash reporting (Sentry).

#### 12.9 Reports & moderation `[ ]`
- In-game report (toxicidad, cheating, nombre).
- Chat moderation (filtros + ML).
- Ban infra (account + HWID + IP temporal).

**Verificación**: registrarse con Google, jugar 1 partida, ver progreso
sincronizado entre 2 dispositivos. Lint + tests + build.

---

### FASE 13 — Live service / Monetización / Seasons

**Objetivo**: monetización y retención a largo plazo.

#### 13.1 In-game store `[ ]`
- Bundles (operator + skin + blueprint + calling card).
- Weapon blueprints (cosmético, mismos stats).
- Operator skins (10+ operators).
- Calling cards, emblems, sprays.
- Finishing moves.

#### 13.2 COD Points `[ ]`
- Currency comprada con dinero real.
- Stripe / Steam IAP / Apple / Google.
- Anti-fraude.

#### 13.3 Battle Pass v2 `[ ]`
- 100+ tiers, free + premium track.
- Sector system (MW2-style: elegir path).
- 3-month seasons.
- Battle Pass Bundle (skip 20 tiers).

#### 13.4 Seasons `[ ]`
- Nuevo contenido cada 3 meses: 1-2 armas nueva, 1-2 mapas, 1 operator,
  1 mode, 1 Battle Pass.
- Season events (double XP, limited modes).
- Mid-season update.

#### 13.5 Prestige `[ ]`
- Tras lvl 55 (o 100), reset con icono.
- 10+ prestige levels.
- Prestige rewards (skins exclusivas).

#### 13.6 Challenges ampliados `[ ]`
- Daily (3), Weekly (5), Seasonal (10).
- Weapon challenges (50 kills, 50 HS, no-attachment, etc.).
- Camo challenges (Gold → Diamond → Orion/Platinum).

#### 13.7 Cosméticos `[ ]`
- Calling cards (50+).
- Emblems (50+).
- Sprays (20+).
- Finishing moves (10+).

**Verificación**: comprar BP premium, subir 10 tiers, desbloquear arma
nueva de la temporada. Lint + tests + build.

---

### FASE 14 — Visuales AAA

**Objetivo**: paridad con CoD moderno.

#### 14.1 WebGPU backend `[ ]`
- Migrar de WebGL2 a WebGPU (cuando esté widely supported).
- Compute shaders (GPU particles, GI).
- Bind groups para batches más grandes.

#### 14.2 Ray tracing `[ ]`
- RT shadows (sun + point lights).
- RT reflections (suelos mojados, mirrors).
- RT GI (diffuse interreflection).
- Hybrid rendering (raster + RT).

#### 14.3 Volumetric fog `[ ]`
- Froxel fog (3D texture).
- God rays volumétricos (mejorar los actuales en `engine.js`).

#### 14.4 Screen-space GI `[ ]`
- SSDO / RTGI approx.
- Light bleeding en esquinas.

#### 14.5 TAA + upscaling `[ ]`
- TAA (reemplazar SMAA actual).
- FSR/DLSS-equivalent (WebGPU upscalers).

#### 14.6 Depth of field + motion blur `[ ]`
- DoF cinematográfico (bokeh).
- Per-object motion blur.

#### 14.7 Color grading + LUTs `[ ]`
- LUT por mapa / modo / tiempo.
- HDR pipeline (float targets).

#### 14.8 Particle system upgrade `[ ]`
- GPU particles (compute).
- VFX library: explosions, smoke trails, muzzle flashes, sparks, debris.
- Soft particles.

#### 14.9 Weather + day/night `[ ]`
- Lluvia (con ripple en chars/suelos).
- Niebla volumétrica.
- Nieve.
- Storm.

**Verificación**: comparar screenshot side-by-side con MW2 (2022). Lint +
tests + build.

---

### FASE 15 — Audio AAA

#### 15.1 Audio engine `[ ]`
- 3D posicional HRTF (mejorar lo actual en `audio.js`).
- Occlusion/obstruction (raycast).
- Reverb zones (convolver con IR por área).
- Audio ducking (voice > SFX > music).

#### 15.2 Real weapon recordings `[ ]`
- Fire (close + distant + tail).
- Reload (per stage).
- Mechanical sounds (bolt, mag insertion, safety).

#### 15.3 Foley `[ ]`
- Footsteps por superficie + gear rattle.
- Gear movement (vest, pouches).
- Impact foley (body falls, ragdoll).

#### 15.4 Music `[ ]`
- Stem-based dynamic music (calma / combate / clímax / death).
- Licensed tracks para menús (opcional).
- Composer integration.

#### 15.5 Voice over `[ ]`
- Operator callouts (reloading, enemy spotted, downed, etc.).
- Multi-language VO (es, en, fr, de, it, ja, ko, zh, pt, ru).
- Announcer (match start, last enemy, victory, defeat).
- Campaign dialogue + subtitles.

#### 15.6 Voice chat `[ ]`
- WebRTC posicional (proximity).
- Push-to-talk + open mic.
- Mute/report UI.

**Verificación**: disparar M4 en exterior vs interior suena distinto
(reverb). Lint + tests + build.

---

### FASE 16 — Performance / Scalability

#### 16.1 Profiling infra `[ ]`
- In-game overlay (FPS, frame time, draw calls, memory).
- Capture frame (Chrome Trace).
- Regression tests en CI.

#### 16.2 Worker threads `[ ]`
- Pathfinding (A*) en Worker.
- Physics (ragdoll) en Worker (opcional).
- Audio mix en AudioWorklet.

#### 16.3 Streaming `[ ]`
- Async chunk load (mapa se carga en background).
- Texture streaming (KTX2 + LOD).
- Mesh streaming (LOD).

#### 16.4 LOD system `[ ]`
- Geometry LOD por distancia (3-4 niveles).
- Material LOD (simplificar shaders lejos).
- Impostor billboard para muy lejos.

#### 16.5 Memory budget `[ ]`
- Mobile: < 1GB.
- Desktop: < 4GB.
- Pool everything (partículas ya, extender a bullets/tracers/decals).

#### 16.6 Frame budget `[ ]`
- Mobile: 33ms (30fps).
- Desktop: 8ms (120fps).
- Auto quality (mejorar `quality.js`).

**Verificación**: perfil Chrome trace de 1 frame sin spikes > 50ms. Lint
+ tests + build.

---

### FASE 17 — QA / Polish / Accesibilidad / i18n

#### 17.1 Testing `[ ]`
- Unit tests coverage > 80% (actual: ~60% en lógica pura).
- Integration tests (engine mount + 1 frame + dispose sin leaks).
- E2E Playwright (play 1 partida MP).
- Visual regression tests (screenshots).
- Performance regression (frame time per map).

#### 17.2 Accesibilidad (WCAG 2.1 AA) `[ ]`
- Subtitles + captions (audio cues textuales).
- Colorblind (3 modos, ya parcial).
- Contrast modes.
- Input remapping completo.
- Aim assist slider.
- FOV slider (60-120).
- Motion sickness options (FOV, bob, blur off).
- Screen reader (menús).
- Keyboard navigation en UI.

#### 17.3 Localización `[ ]`
- 10+ idiomas: es, en, fr, de, it, ja, ko, zh-CN, zh-TW, pt-BR, ru, pl.
- Extracción completa de strings (no hardcoded).
- VO multi-idioma (parcial).
- RTL support (árabe/hebreo) si procede.

#### 17.4 Bug tracking `[ ]`
- Issue templates (bug, feature, balance).
- Triage workflow (P0/P1/P2/P3).
- Repro steps + logs.

#### 17.5 Crash reporting `[ ]`
- Sentry SDK.
- Source maps.
- Client-side error boundary.
- Server-side crash logs.

#### 17.6 Playtesting infra `[ ]`
- Feedback form in-game.
- Heatmaps (muertes, posiciones).
- Telemetría de dificultad.

**Verificación**: pasar WCAG AA audit, jugar 1 partida con screen reader
+ subtitles + colorblind + key remap. Lint + tests + build.

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
- [x] Fase 1.6 — casas con interior transitables + azoteas para combate vertical
- [x] Fase 1.7 — sombras dinámicas (sun sigue al jugador) + agua con oleaje
- [x] Fase 1.8 — settings (FOV/sensibilidad/volumen/colorblind) + killcam
- [x] Fase 1.9 — i18n (es/en) + gamepad support + tests (122 tests)
- [~] Fase 2 — MP base (servidor + cliente + TDM + killfeed); faltan modos extra, matchmaking, anti-cheat
- [~] Fase 3 — meta base (weapon levels, camos, battle pass, dailies, Barracks); faltan cuentas online, monetización real, seasons
- [x] Fase 4 — bugfixes críticos (vida, munición, granadas, gunship, flashbang)
- [x] Fase 5 — sistema de pickups + scavenger
- [x] Fase 6 — wiring config muerta (secondary, tactical/lethal, dailies, settings, idioma)
- [x] Fase 7 — calidad (input, gamepad, leaks, minimap, decals)
- [x] Fase 8 — performance (A* heap, boids hash, raycast, allocs)
- [x] Fase 9 — MP funcional (kill chain, hit detection, scoreboard)
- [x] Fase 10 — tests (navmesh, grenades, pickups, streaks — 151 tests)
- [x] Fase 11 — documentación (README, AGENTS, repo hygiene)
- [x] Fase 12 — orden del repo + commits por fase

### Fases 4-17 (CoD real) — implementadas como esqueletos funcionales

- [x] Fase 4 (assets) — createAssetLoader (GLTF/DRACO/KTX2 + IndexedDB cache
  + fallback procedural), createAnimGraph (state machine + blend trees),
  audio sample bank + reverb IR. Manifest ejemplo en public/assets/.
- [x] Fase 5 (arsenal) — 28 armas (7 originales + 21 nuevas: kilo/grau/fr556/
  oden/mp7/p90/uzi/aug/m91/pkm/model680/r90/hdr/ax50/ebr14/mk2/kar98k/x16/
  deagle/rpg/pila), WEAPON_PLATFORMS (11), 35 attachments en 6 slots, 8 field
  upgrades, 15 grenade types, multi-class (10 slots), UNLOCK_CATALOG 55 niveles.
- [x] Fase 6 (mapas) — 5 mapas (pamplona + desert/urban/snow/industrial),
  MAPS registry con metadata por bioma (fog/sun/ambient/hemi), createWorld
  acepta mapId, engine.setMap/getMap.
- [x] Fase 7 (campaña) — 5 misiones (Operator/Blackout/Cold Front/Iron Works/
  Pamplona) en 3 actos, 8 objective types, allies NPCs, cinemáticas, 4
  dificultades (recruit/regular/hardened/veteran), persistencia + unlock chain.
- [x] Fase 8 (modos) — 14 modos: survival, campaign, tdm, ffa, domination,
  hardpoint, killConfirmed, searchDestroy, gunfight, gunGame, infected,
  groundWar, warzone, hardcore. API getGameMode/isPvP/isPvE/getMaxPlayers.
- [x] Fase 9 (netcode) — createInputValidator (speed/teleport/aimbot/fire rate
  detection, shouldBan), createLagCompensator (history buffer + rewind for
  "favor the shooter"), createSnapshotDelta (delta compression),
  createRateLimiter (per-IP buckets), createAntiCheat (HS rate/accuracy/KD
  tracking, bans, reports). Config 60Hz tick / 30Hz snapshot / 120Hz input.
- [x] Fase 10 (ranked) — CDL ruleset (3 modos, 4 mapas, banned list), 8 tiers
  Bronze→Top250, SR ELO-like (K=32, MVP bonus, quit penalty, weekly decay),
  placements (10 matches), rewards per tier, persistencia. Spectator (4 modos:
  free/follow 1st-3rd/director) + X-ray + PiP. Theater (record/playback demos).
- [x] Fase 11 (crossplay/móvil) — createTouchControls (virtual sticks, 10
  botones, gyro aim, aim assist slider), isTouchDevice/isMobile/detectInputType,
  MATCHMAKING_POOLS (mnk/controller/touch/mixed), getMatchmakingPool.
- [x] Fase 12 (backend) — createApiClient (26 métodos: auth email+OAuth 6
  providers, inventory sync, matchmaking, friends, party, voice, reports,
  matches, leaderboard, telemetry). DB_SCHEMA Postgres (16 tablas + índices).
- [x] Fase 13 (live service) — STORE_ITEMS (11 bundles/blueprints/operators/
  cards/emblems/sprays/finishing moves), COD Points, Battle Pass v2 (100 tiers,
  premium, bundle skip 20), Prestige (11 niveles), Seasons (90 días),
  Challenges (daily 3/6, weekly 5/5, seasonal 3, weapon 6 con camo rewards).
- [x] Fase 14-17 (perf/a11y) — createFrameProfiler (FPS/frame time/draw calls/
  memory), createLODSystem (4 niveles HIGH/MEDIUM/LOW/IMPOSTOR),
  createMemoryTracker (snapshots, budget check, leak detection),
  createQualityScaler (dynamic pixel ratio). Accessibility: COLORBLIND_TYPES
  (4 con matrices), subtítulos, screen reader, key remapping (25+ acciones),
  motion sickness presets, aim assist/FOV sliders, keyboard nav.
- [x] Verificación: lint limpio, 471 tests, build OK.
