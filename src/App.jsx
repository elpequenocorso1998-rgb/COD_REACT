import { useEffect, useRef, useState, Component } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore, GAME_STATES } from './game/store.js'
import { createEngine } from './game/engine.js'
import { WEAPONS, PERKS, ATTACHMENTS, ATTACHMENT_SLOTS } from './game/config.js'
import { getLoadout, saveLoadout, getCustomClasses, setActiveClassIndex, getActiveClassIndex, duplicateClass, resetClass, getMaxClasses } from './game/loadout.js'
import { getSettings, saveSettings } from './game/settings.js'
import { t, setLang, getLang } from './i18n.js'
import { createNetClient } from './net/client.js'
import { getMetaSummary, getWeaponStats, CAMO_CATALOG } from './game/meta.js'
import { DEFAULT_KEYBINDINGS } from './game/accessibility/index.js'
import { MAPS, MAP_IDS } from './game/maps/index.js'
import { GAME_MODES } from './game/modes/index.js'
import { getPrestige, canPrestige, prestige as doPrestige } from './game/backend/live-service.js'

/* =========================================================================
   ErrorBoundary: si WebGL falla o el engine crashea al montar, mostramos
   un fallback en lugar de una pantalla en blanco con loading=true para
   siempre. Antes no había boundary y un fallo de WebGL dejaba la app muerta.
   ========================================================================= */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Error desconocido' }
  }
  componentDidCatch(err) {
    console.error('ErrorBoundary capturó:', err)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="menu">
          <h1>Error</h1>
          <h2>No se pudo iniciar el motor</h2>
          <div className="stats">
            {this.state.message}<br />
            Puede que tu navegador no soporte WebGL o esté desactivado.
          </div>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )
    }
    return this.props.children
  }
}

/* =========================================================================
   Componente <App />: orquesta los menús y el motor 3D.
   ========================================================================= */
export default function App() {
  const gameState = useGameStore((s) => s.gameState)
  const loading = useGameStore((s) => s.loading)
  const [loadoutOpen, setLoadoutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mpOpen, setMpOpen] = useState(false)
  const [barracksOpen, setBarracksOpen] = useState(false)
  const netClientRef = useRef(null)

  const engineRef = useRef(null)
  const containerRef = useRef(null)
  // Fase 7: ref para el canvas del minimap (inyección diferida).
  const minimapCanvasRef = useRef(null)
  const minimapAttachRef = useRef(null)

  // Fase 6: aplicar filtro colorblind al canvas según settings.
  const settings = getSettings()
  useEffect(() => {
    document.body.className = settings.colorblind !== 'off' ? `colorblind-${settings.colorblind}` : ''
  }, [settings.colorblind])

  useEffect(() => {
    // Guard: si el contenedor ya no está (StrictMode double-invoke rápido),
    // no intentamos montar.
    if (!containerRef.current) return
    const engine = createEngine()
    engineRef.current = engine
    // El engine nos pasa el canvas del minimap cuando está listo; lo
    // adjuntamos al contenedor del HUD (imperativo, sin React re-render).
    // Fase 7: bug fixed — antes onMinimapReady se llamaba dentro de mount(),
    // antes de que el HUD existiera en el DOM, así que el canvas se perdía.
    // Ahora guardamos el canvas y lo inyectamos cuando el HUD aparezca.
    engine.onMinimapReady = (canvas) => {
      minimapCanvasRef.current = canvas
      attachMinimap()
    }
    const attachMinimap = () => {
      const canvas = minimapCanvasRef.current
      if (!canvas) return
      const container = document.querySelector('.minimap-container')
      if (container && !container.contains(canvas)) {
        container.innerHTML = ''
        container.appendChild(canvas)
      }
    }
    // Retry: el HUD puede no estar montado aún cuando onMinimapReady dispara.
    // Intentamos periódicamente hasta que el contenedor exista.
    minimapAttachRef.current = setInterval(attachMinimap, 500)
    try {
      engine.mount(containerRef.current)
    } catch (err) {
      console.error('Error montando el engine:', err)
      useGameStore.getState().setLoading(false)
    }
    return () => {
      clearInterval(minimapAttachRef.current)
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return (
    <ErrorBoundary>
      <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />

      {loading && (
        <div className="loading">
          {t('menu.loading')}
          <div className="bar" />
        </div>
      )}

      {/* Solo mostramos el menú cuando ya no estamos cargando: antes el
          botón "Jugar" podía clickarse antes de que el engine montara. */}
      {!loading && gameState === GAME_STATES.MENU && !loadoutOpen && !settingsOpen && !mpOpen && !barracksOpen && (
        <MainMenu
          onStart={(mapId, modeId) => {
            if (modeId) engineRef.current?.setMode(modeId)
            engineRef.current?.startGame(mapId)
          }}
          onOpenLoadout={() => setLoadoutOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMultiplayer={() => setMpOpen(true)}
          onOpenBarracks={() => setBarracksOpen(true)}
        />
      )}
      {!loading && gameState === GAME_STATES.MENU && loadoutOpen && (
        <CreateAClassScreen onClose={() => setLoadoutOpen(false)} />
      )}
      {!loading && gameState === GAME_STATES.MENU && settingsOpen && (
        <SettingsScreen
          onClose={() => setSettingsOpen(false)}
          onApply={(s) => engineRef.current?.applySettings(s)}
        />
      )}
      {!loading && gameState === GAME_STATES.MENU && mpOpen && (
        <MultiplayerScreen
          onClose={() => setMpOpen(false)}
          onConnect={(url, name) => {
            const client = createNetClient(url)
            netClientRef.current = client
            client.on('onInit', (msg) => {
              // Fase 9: enviar nombre al servidor tras init.
              if (name) client.sendName(name)
              useGameStore.getState().setMpInit(msg.clientId, msg.team, msg.scoreLimit, msg.teams)
              useGameStore.getState().setState(GAME_STATES.PLAYING)
              engineRef.current?.startMPGame(client)
              setMpOpen(false)
            })
            client.on('onSnapshot', ({ players, teams }) => {
              useGameStore.getState().setMpSnapshot(players, teams)
            })
            client.on('onKill', (msg) => {
              useGameStore.getState().addMpKill({
                killer: msg.killerName, victim: msg.victimName,
                weapon: msg.weapon, headshot: msg.headshot
              })
            })
            client.on('onMatchOver', (msg) => {
              useGameStore.getState().setMpMatchOver(msg.winner, msg.teams)
            })
            client.connect()
          }}
        />
      )}
      {!loading && gameState === GAME_STATES.MENU && barracksOpen && (
        <BarracksScreen onClose={() => setBarracksOpen(false)} />
      )}
      {gameState === GAME_STATES.MATCH_OVER && (
        <MatchOverScreen
          onQuit={() => {
            if (netClientRef.current) { netClientRef.current.disconnect(); netClientRef.current = null }
            useGameStore.getState().setState(GAME_STATES.MENU)
          }}
        />
      )}
      {gameState === GAME_STATES.PLAYING && <HUD />}
      {gameState === GAME_STATES.PLAYING && <ClickToPlayOverlay />}
      {gameState === GAME_STATES.PAUSED && (
        <PauseMenu
          onResume={() => engineRef.current?.resumeGame()}
          onQuit={() => engineRef.current?.quitToMenu()}
        />
      )}
      {gameState === GAME_STATES.GAMEOVER && (
        <GameOverMenu onRestart={() => engineRef.current?.startGame()} />
      )}
      {gameState === GAME_STATES.SPECTATING && (
        <SpectateOverlay />
      )}
    </ErrorBoundary>
  )
}

/* =========================================================================
   Fase 19.4: Click to play overlay — aparece cuando el pointer no está locked.
   ========================================================================= */
function ClickToPlayOverlay() {
  const pointerLocked = useGameStore((s) => s.pointerLocked)
  if (pointerLocked) return null
  const handleClick = () => {
    const canvas = document.querySelector('.game-canvas')
    if (canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock()
    }
  }
  return (
    <div className="click-to-play" onClick={handleClick}>
      <div className="click-to-play-text">Click to play</div>
    </div>
  )
}

/* =========================================================================
   Fase 18.5: Spectate overlay (MP death, respawn tras 3s).
   ========================================================================= */
function SpectateOverlay() {
  const { spectateTargetId, respawnAt } = useGameStore(useShallow((s) => ({
    spectateTargetId: s.spectateTargetId,
    respawnAt: s.respawnAt
  })))
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const remaining = Math.max(0, Math.ceil((respawnAt - now) / 1000))
  return (
    <div className="spectate-overlay">
      <div className="spectate-info">
        <div className="spectate-label">SPECTATING</div>
        {spectateTargetId && <div className="spectate-target">Player #{spectateTargetId}</div>}
        <div className="spectate-controls">[Q]/[E] cycle · [R] view mode</div>
        <div className="spectate-respawn">Respawn in {remaining}s</div>
      </div>
    </div>
  )
}

/* =========================================================================
   HUD: vida, munición, crosshair, marcador, hitmarkers, minimap,
   killstreaks, multikills, XP, scoreboard.
   ========================================================================= */
function HUD() {
  const {
    health, maxHealth, ammo, reserve, reloading, score, wave,
    enemiesRemaining, firing, hitmarkers, killmarkers,
    damageFlash, damageDirections,
    killStreak, availableStreaks, multikillLabel,
    playerLevel, playerXP, playerXPNeeded, levelUpFlash, scoreboardOpen,
    kills, deaths, currentWeapon, stamina, maxStamina,
    grenadeCounts, flashbanged,
    fps,
    mpConnected, mpRemotePlayers, mpTeamScores, mpTeam, mpScoreLimit, mpKillfeed,
    fieldUpgradeCharge, fieldUpgradeCooldown, activeFieldUpgrade,
    suppression, cookProgress
  } = useGameStore(useShallow((s) => ({
    health: s.health, maxHealth: s.maxHealth, ammo: s.ammo, reserve: s.reserve,
    reloading: s.reloading, score: s.score, wave: s.wave,
    enemiesRemaining: s.enemiesRemaining, firing: s.firing,
    hitmarkers: s.hitmarkers, killmarkers: s.killmarkers,
    damageFlash: s.damageFlash, damageDirections: s.damageDirections,
    killStreak: s.killStreak, availableStreaks: s.availableStreaks,
    multikillLabel: s.multikillLabel,
    playerLevel: s.playerLevel, playerXP: s.playerXP, playerXPNeeded: s.playerXPNeeded,
    levelUpFlash: s.levelUpFlash, scoreboardOpen: s.scoreboardOpen,
    kills: s.kills, deaths: s.deaths, currentWeapon: s.currentWeapon,
    stamina: s.stamina, maxStamina: s.maxStamina,
    grenadeCounts: s.grenadeCounts, flashbanged: s.flashbanged,
    fps: s.fps,
    mpConnected: s.mpConnected, mpRemotePlayers: s.mpRemotePlayers,
    mpTeamScores: s.mpTeamScores, mpTeam: s.mpTeam, mpScoreLimit: s.mpScoreLimit,
    mpKillfeed: s.mpKillfeed,
    fieldUpgradeCharge: s.fieldUpgradeCharge,
    fieldUpgradeCooldown: s.fieldUpgradeCooldown,
    activeFieldUpgrade: s.activeFieldUpgrade,
    suppression: s.suppression,
    cookProgress: s.cookProgress
  })))

  const hpPct = Math.max(0, (health / maxHealth) * 100)
  const lowHealth = hpPct <= 30
  const lowAmmo = ammo <= 5
  const warnReserve = reserve <= 10
  const xpPct = Math.min(100, (playerXP / playerXPNeeded) * 100)
  const staminaPct = Math.max(0, (stamina / maxStamina) * 100)
  const streakLabels = { uav: 'UAV', airstrike: 'Airstrike', heli: 'Heli', gunship: 'Gunship' }
  const streakKeys = { uav: '4', airstrike: '5', heli: '6', gunship: '7' }

  return (
    <div className="hud">
      {/* --- Minimap (canvas inyectado imperativamente por el engine) --- */}
      <div className="minimap-container" aria-hidden="true" />

      {/* Fase 6: FPS counter (si showFps activo en settings) */}
      {fps > 0 && (
        <div className="fps-counter" aria-hidden="true">{fps} FPS</div>
      )}

      {/* Fase 18.1: Killfeed MP (top-right, últimas 5 kills < 4s) */}
      {mpConnected && mpKillfeed && mpKillfeed.length > 0 && (
        <div className="killfeed" aria-label="Killfeed">
          {mpKillfeed
            .filter((k) => Date.now() - k.t < 4000)
            .slice(-5)
            .map((k, i) => (
              <div className="killfeed-row" key={`${k.t}-${i}`}>
                <span className="killer">{k.killer}</span>
                <span className="weapon">{k.weapon}{k.headshot ? ' ⊕' : ''}</span>
                <span className="victim">{k.victim}</span>
              </div>
            ))}
        </div>
      )}

      {/* --- Multikill callout (centro, efímero) --- */}
      {multikillLabel && (
        <div className="multikill-callout" aria-live="polite">{multikillLabel}</div>
      )}

      {/* --- Level up flash (centro, efímero) --- */}
      {levelUpFlash && (
        <div className="levelup-flash" aria-live="polite">
          <div className="levelup-title">LEVEL UP!</div>
          <div className="levelup-level">Nivel {levelUpFlash.level}</div>
          {levelUpFlash.unlocks.length > 0 && (
            <div className="levelup-unlocks">
              {levelUpFlash.unlocks.map((u) => (
                <div key={u.id} className="levelup-unlock">
                  Desbloqueado: {u.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Crosshair en el centro (decorativo, oculto a lectores). */}
      <div className={`crosshair ${firing ? 'firing' : ''}`} aria-hidden="true">
        <span className="top" />
        <span className="bottom" />
        <span className="left" />
        <span className="right" />
        <span className="dot" />
      </div>

      {/* Hitmarkers (aciertos) y killmarkers (bajas) — decorativos.
          Los hitmarkers ahora son {id, type} con variantes de color. */}
      {hitmarkers.map((h) => (
        <div key={`h${h.id}`} className={`hitmarker ${h.type}`} aria-hidden="true" />
      ))}
      {killmarkers.map((id) => <div key={`k${id}`} className="killmarker" aria-hidden="true" />)}

      {/* Indicadores direccionales de daño — decorativos. */}
      {damageDirections.map((d) => (
        <div
          key={`d${d.id}`}
          className="damage-direction"
          aria-hidden="true"
          style={{ transform: `translate(-50%, -50%) rotate(${d.angle}rad)` }}
        >
          <div className="damage-direction-arc" />
        </div>
      ))}

      {/* Viñeta roja al recibir daño — decorativa. */}
      <div className={`damage-flash ${damageFlash ? 'active' : ''}`} aria-hidden="true" />

      {/* --- Killstreaks disponibles (esquina inf-derecha) --- */}
      {availableStreaks.length > 0 && (
        <div className="streaks-panel" aria-live="polite">
          {availableStreaks.map((s) => (
            <div key={s.id} className="streak-badge">
              <span className="streak-key">{streakKeys[s.type]}</span>
              <span className="streak-name">{streakLabels[s.type]}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- Indicador de killstreak actual --- */}
      {killStreak > 0 && (
        <div className="killstreak-counter" aria-hidden="true">
          Streak: {killStreak}
        </div>
      )}

      {/* Cabecera: oleada + enemigos + puntuación + XP bar. */}
      <div className="hud-top">
        <div className="wave-block" aria-live="polite">
          <div className="label">Oleada</div>
          <div className="value">{wave}</div>
        </div>
        <div className="enemies-block" aria-live="polite">
          <div className="label">Enemigos</div>
          <div className="value">{enemiesRemaining}</div>
        </div>
        <div className="score-block" aria-live="polite">
          <div className="label">Puntuación</div>
          <div className="value score-value">{score.toLocaleString()}</div>
          {/* XP bar debajo del score. */}
          <div className="xp-bar" aria-hidden="true">
            <div className="xp-fill" style={{ width: `${xpPct}%` }} />
            <span className="xp-label">LV {playerLevel}</span>
          </div>
        </div>
      </div>

      {/* Indicador de recarga. */}
      {reloading && <div className="reload-indicator" role="status">Recargando...</div>}

      {/* Pie: vida (izquierda) y munición (derecha). */}
      <div className="hud-bottom">
        <div aria-live="polite">
          <div className="label">Vida</div>
          <div className={`value ${lowHealth ? 'low' : ''}`}>{Math.ceil(health)}</div>
          <div className="health-bar" aria-hidden="true">
            <div
              className={`fill ${lowHealth ? 'low' : ''}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          {/* Fase 1.5: barra de stamina (sprint). */}
          <div className="stamina-bar" aria-hidden="true">
            <div
              className={`stamina-fill ${staminaPct < 20 ? 'low' : ''}`}
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>
        <div className="ammo-display" aria-live="polite">
          <div className="label">{currentWeapon ? currentWeapon.toUpperCase() : 'Arma'}</div>
          <div className={`value ${lowAmmo ? 'warn' : ''}`}>
            {ammo}<span className={`reserve ${warnReserve ? 'warn' : ''}`}>/ {reserve}</span>
          </div>
          {/* Fase 4: contador de granadas por tipo */}
          <div className="grenade-counts" aria-label="Granadas">
            <span className="grenade-count" title="Frag (G)">F:{grenadeCounts?.frag ?? 0}</span>
            <span className="grenade-count" title="Flash (X)">X:{grenadeCounts?.flash ?? 0}</span>
            <span className="grenade-count" title="Smoke (C)">S:{grenadeCounts?.smoke ?? 0}</span>
          </div>
          {/* Fase 18.4: field upgrade charge indicator */}
          {activeFieldUpgrade && (
            <div className="field-upgrade-indicator" title={`Field Upgrade (T): ${activeFieldUpgrade}`}>
              <div className={`field-upgrade-charge ${fieldUpgradeCharge >= 100 && fieldUpgradeCooldown <= 0 ? 'ready' : ''}`}>
                {fieldUpgradeCooldown > 0
                  ? `${Math.ceil(fieldUpgradeCooldown)}s`
                  : `${Math.floor(fieldUpgradeCharge)}%`}
              </div>
              <div className="field-upgrade-bar" aria-hidden="true">
                <div
                  className="field-upgrade-fill"
                  style={{ width: `${fieldUpgradeCooldown > 0 ? 100 - (fieldUpgradeCooldown / 60) * 100 : fieldUpgradeCharge}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fase 4: overlay blanco de flashbang */}
      {flashbanged > 0 && (
        <div className="flashbang-overlay" aria-hidden="true" />
      )}

      {/* Fase 18.13: suppression vignette (bullets pasando cerca) */}
      {suppression > 0.1 && (
        <div
          className="suppression-overlay"
          aria-hidden="true"
          style={{ opacity: Math.min(0.7, suppression) }}
        />
      )}

      {/* Fase 19.3: cook grenade progress ring (centro, sobre crosshair) */}
      {cookProgress > 0 && (
        <div className="cook-progress" aria-hidden="true">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" />
            <circle
              cx="30" cy="30" r="26" fill="none"
              stroke={cookProgress > 0.8 ? '#ff4040' : '#ffd24d'}
              strokeWidth="4"
              strokeDasharray={`${cookProgress * 163.36} 163.36`}
              transform="rotate(-90 30 30)"
            />
          </svg>
        </div>
      )}

      {/* --- Scoreboard overlay (Tab hold) --- */}
      {scoreboardOpen && (
        <Scoreboard kills={kills} deaths={deaths} score={score} wave={wave}
          mpConnected={mpConnected} mpRemotePlayers={mpRemotePlayers}
          mpTeamScores={mpTeamScores} mpTeam={mpTeam} mpScoreLimit={mpScoreLimit}
        />
      )}
    </div>
  )
}

/* =========================================================================
   Scoreboard: tabla de puntuaciones (Tab hold).
   Fase 9: en MP muestra equipos reales con scores del servidor.
   ========================================================================= */
function Scoreboard({ kills, deaths, score, wave, mpConnected, mpRemotePlayers, mpTeamScores, mpTeam, mpScoreLimit }) {
  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)

  if (mpConnected && mpTeamScores) {
    // Scoreboard MP: dos equipos con jugadores reales.
    const axisPlayers = mpRemotePlayers.filter((p) => p.team === 'axis')
    const alliesPlayers = mpRemotePlayers.filter((p) => p.team === 'allies')
    const renderTeam = (name, players, score, isMyTeam) => (
      <div className="scoreboard-team">
        <div className="scoreboard-team-name">{name} — {score}/{mpScoreLimit}</div>
        <div className="scoreboard-row scoreboard-header-row">
          <span>Jugador</span><span>Alive</span><span>Firing</span>
        </div>
        {isMyTeam && (
          <div className="scoreboard-row">
            <span>Tú</span><span>✓</span><span>-</span>
          </div>
        )}
        {players.map((p) => (
          <div key={p.id} className="scoreboard-row">
            <span>Player {p.id}</span>
            <span>{p.alive !== false ? '✓' : '✗'}</span>
            <span>{p.firing ? '🔫' : '-'}</span>
          </div>
        ))}
      </div>
    )
    return (
      <div className="scoreboard" role="dialog" aria-label="Scoreboard">
        <div className="scoreboard-header">Team Deathmatch</div>
        <div className="scoreboard-teams">
          {renderTeam('AXIS', axisPlayers, mpTeamScores.axis, mpTeam === 'axis')}
          {renderTeam('ALLIES', alliesPlayers, mpTeamScores.allies, mpTeam === 'allies')}
        </div>
        <div className="scoreboard-hint">Mantén Tab para ver el scoreboard</div>
      </div>
    )
  }

  // Scoreboard PvE (fallback original).
  return (
    <div className="scoreboard" role="dialog" aria-label="Scoreboard">
      <div className="scoreboard-header">
        Wave Survival — Oleada {wave}
      </div>
      <div className="scoreboard-teams">
        <div className="scoreboard-team">
          <div className="scoreboard-team-name">Tu equipo</div>
          <div className="scoreboard-row scoreboard-header-row">
            <span>Jugador</span><span>K</span><span>D</span><span>K/D</span><span>Score</span>
          </div>
          <div className="scoreboard-row">
            <span>Tú</span><span>{kills}</span><span>{deaths}</span><span>{kd}</span><span>{score.toLocaleString()}</span>
          </div>
        </div>
        <div className="scoreboard-team">
          <div className="scoreboard-team-name">Enemigos</div>
          <div className="scoreboard-row scoreboard-header-row">
            <span>Unidad</span><span>K</span><span>D</span><span>-</span><span>-</span>
          </div>
          <div className="scoreboard-row">
            <span>Bot squad</span><span>{deaths}</span><span>{kills}</span><span>-</span><span>-</span>
          </div>
        </div>
      </div>
      <div className="scoreboard-hint">Mantén Tab para ver el scoreboard</div>
    </div>
  )
}

/* =========================================================================
   Menús: principal, pausa y game over.
   ========================================================================= */
function MainMenu({ onStart, onOpenLoadout, onOpenSettings, onOpenMultiplayer, onOpenBarracks }) {
  const [selectedMap, setSelectedMap] = useState(() => {
    try { return localStorage.getItem('mw_selected_map') || 'pamplona' } catch { return 'pamplona' }
  })
  const [selectedMode, setSelectedMode] = useState(() => {
    try { return localStorage.getItem('mw_selected_mode') || 'survival' } catch { return 'survival' }
  })
  const handleStart = () => {
    try {
      localStorage.setItem('mw_selected_map', selectedMap)
      localStorage.setItem('mw_selected_mode', selectedMode)
    } catch {}
    onStart(selectedMap, selectedMode)
  }
  const pveModes = Object.values(GAME_MODES).filter((m) => m.type === 'pve')
  return (
    <div className="menu menu-main">
      <div className="menu-header">
        <h1>{t('menu.title')}</h1>
        <h2>{t('menu.subtitle')}</h2>
      </div>
      <div className="menu-body">
        <div className="menu-col menu-col-actions">
          <button className="menu-btn-primary" onClick={handleStart}>{t('menu.play')}</button>
          <button onClick={onOpenMultiplayer}>Multiplayer</button>
          <button onClick={onOpenLoadout}>{t('menu.loadout')}</button>
          <button onClick={onOpenBarracks}>Barracks</button>
          <button onClick={onOpenSettings}>{t('menu.settings')}</button>
        </div>
        <div className="menu-col menu-col-selectors">
          {/* Fase 18.33: selector de modo de juego */}
          <div className="menu-selector">
            <div className="loadout-section-title">Modo</div>
            <div className="map-grid">
              {pveModes.map((m) => (
                <button
                  key={m.id}
                  className={`loadout-item ${selectedMode === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMode(m.id)}
                  title={m.desc}
                >
                  <div className="map-name">{m.name}</div>
                  <div className="map-biome">{m.type}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Fase 18.6: selector de mapa */}
          <div className="menu-selector">
            <div className="loadout-section-title">Mapa</div>
            <div className="map-grid">
              {MAP_IDS.map((id) => (
                <button
                  key={id}
                  className={`loadout-item ${selectedMap === id ? 'selected' : ''}`}
                  onClick={() => setSelectedMap(id)}
                  title={MAPS[id].desc}
                >
                  <div className="map-name">{MAPS[id].name}</div>
                  <div className="map-biome">{MAPS[id].biome}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="menu-controls">
        <strong>WASD</strong> mover · <strong>SHIFT</strong> correr · <strong>CTRL</strong> slide · <strong>Z</strong> prone · <strong>SPACE</strong> saltar · <strong>F</strong> mantle · <strong>Q/E</strong> lean · <strong>Click izq.</strong> disparar · <strong>Click der.</strong> ADS · <strong>R</strong> recarga · <strong>G/X/C</strong> granadas · <strong>T</strong> field upgrade · <strong>4-7</strong> killstreaks · <strong>TAB</strong> scoreboard · <strong>ESC</strong> pausa
      </div>
    </div>
  )
}

function PauseMenu({ onResume, onQuit }) {
  return (
    <div className="menu">
      <h1>{t('menu.pause')}</h1>
      <button onClick={onResume}>{t('menu.resume')}</button>
      <button onClick={onQuit}>{t('menu.quit')}</button>
    </div>
  )
}

function GameOverMenu({ onRestart }) {
  const score = useGameStore((s) => s.score)
  const wave = useGameStore((s) => s.wave)
  return (
    <div className="menu">
      <div className="killcam-banner">{t('menu.killcam')}</div>
      <h1>{t('menu.gameover')}</h1>
      <h2>{t('menu.gameover.subtitle')}</h2>
      <div className="stats">
        {t('menu.gameover.score')}: <strong style={{ color: '#ffd24d' }}>{score.toLocaleString()}</strong><br />
        {t('menu.gameover.wave')}: <strong style={{ color: '#ffd24d' }}>{wave}</strong>
      </div>
      <button onClick={onRestart}>{t('menu.gameover.retry')}</button>
    </div>
  )
}

/* =========================================================================
   Settings — preferencias del jugador (Fase 1.8).
   FOV, sensibilidad X/Y, volúmenes, calidad, colorblind, aim assist.
   ========================================================================= */
function SettingsScreen({ onClose, onApply }) {
  const [settings, setSettingsState] = useState(() => getSettings())
  const [keybindTab, setKeybindTab] = useState(false)
  const [rebindingAction, setRebindingAction] = useState(null)

  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettingsState(next)
    saveSettings(next)
    onApply(next)
  }

  const startRebind = (action) => setRebindingAction(action)

  useEffect(() => {
    if (!rebindingAction) return
    const handler = (e) => {
      e.preventDefault()
      let key
      if (e.type === 'mousedown') {
        key = `Mouse${e.button}`
      } else {
        key = e.code
      }
      if (key === 'Escape') {
        setRebindingAction(null)
        return
      }
      const nextBindings = { ...(settings.keybindings || DEFAULT_KEYBINDINGS), [rebindingAction]: key }
      update({ keybindings: nextBindings })
      setRebindingAction(null)
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('mousedown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('mousedown', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebindingAction, settings.keybindings])

  const resetKeybinds = () => {
    update({ keybindings: { ...DEFAULT_KEYBINDINGS } })
  }

  const formatKey = (code) => {
    if (!code) return '—'
    if (code.startsWith('Mouse')) return `Mouse ${code.slice(5)}`
    if (code.startsWith('Key')) return code.slice(3)
    if (code.startsWith('Digit')) return code.slice(5)
    if (code.startsWith('Arrow')) return code
    return code
  }

  const keybindLabels = {
    forward: 'Move Forward', backward: 'Move Backward', left: 'Strafe Left', right: 'Strafe Right',
    sprint: 'Sprint', crouch: 'Crouch', prone: 'Prone', jump: 'Jump', mantle: 'Mantle',
    leanLeft: 'Lean Left', leanRight: 'Lean Right', fire: 'Fire', ads: 'ADS', reload: 'Reload',
    switchWeapon: 'Switch Weapon', tactical: 'Tactical', lethal: 'Lethal', smoke: 'Smoke',
    knife: 'Knife', holdBreath: 'Hold Breath', uav: 'UAV', airstrike: 'Airstrike',
    heli: 'Heli', gunship: 'Gunship', scoreboard: 'Scoreboard', pause: 'Pause'
  }

  return (
    <div className="menu settings-screen">
      <h1>{t('settings.title')}</h1>
      <div className="settings-tabs">
        <button
          className={!keybindTab ? 'active' : ''}
          onClick={() => setKeybindTab(false)}
        >Game</button>
        <button
          className={keybindTab ? 'active' : ''}
          onClick={() => setKeybindTab(true)}
        >Keybinds</button>
      </div>
      {!keybindTab ? (
        <div className="settings-content">
          <div className="settings-row">
            <label>{t('settings.fov')}</label>
            <input
              type="range" min="60" max="110" step="1"
              value={settings.fov}
              onChange={(e) => update({ fov: Number(e.target.value) })}
            />
            <span className="settings-value">{settings.fov}°</span>
          </div>
          <div className="settings-row">
            <label>{t('settings.sensX')}</label>
            <input
              type="range" min="0.0005" max="0.006" step="0.0001"
              value={settings.mouseSensX}
              onChange={(e) => update({ mouseSensX: Number(e.target.value) })}
            />
            <span className="settings-value">{settings.mouseSensX.toFixed(4)}</span>
          </div>
          <div className="settings-row">
            <label>{t('settings.sensY')}</label>
            <input
              type="range" min="0.0005" max="0.006" step="0.0001"
              value={settings.mouseSensY}
              onChange={(e) => update({ mouseSensY: Number(e.target.value) })}
            />
            <span className="settings-value">{settings.mouseSensY.toFixed(4)}</span>
          </div>
          <div className="settings-row">
            <label>{t('settings.masterVolume')}</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.masterVolume}
              onChange={(e) => update({ masterVolume: Number(e.target.value) })}
            />
            <span className="settings-value">{Math.round(settings.masterVolume * 100)}%</span>
          </div>
          <div className="settings-row">
            <label>{t('settings.quality')}</label>
            <select
              value={settings.quality}
              onChange={(e) => update({ quality: e.target.value })}
            >
              <option value="auto">{t('settings.quality.auto')}</option>
              <option value="low">{t('settings.quality.low')}</option>
              <option value="medium">{t('settings.quality.medium')}</option>
              <option value="high">{t('settings.quality.high')}</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t('settings.colorblind')}</label>
            <select
              value={settings.colorblind}
              onChange={(e) => update({ colorblind: e.target.value })}
            >
              <option value="off">{t('settings.colorblind.off')}</option>
              <option value="protanopia">Protanopia</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="tritanopia">Tritanopia</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t('settings.aimAssist')}</label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.aimAssist}
              onChange={(e) => update({ aimAssist: Number(e.target.value) })}
            />
            <span className="settings-value">{Math.round(settings.aimAssist * 100)}%</span>
          </div>
          <div className="settings-row">
            <label>{t('settings.showFps')}</label>
            <input
              type="checkbox"
              checked={settings.showFps}
              onChange={(e) => update({ showFps: e.target.checked })}
            />
          </div>
          {/* Fase 6: selector de idioma */}
          <div className="settings-row">
            <label>Idioma / Language</label>
            <select
              value={getLang()}
              onChange={(e) => { setLang(e.target.value); update({}) }}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="settings-content keybinds-list">
          {Object.keys(DEFAULT_KEYBINDINGS).map((action) => (
            <div className="settings-row keybind-row" key={action}>
              <label>{keybindLabels[action] || action}</label>
              <button
                className={`keybind-btn ${rebindingAction === action ? 'rebinding' : ''}`}
                onClick={() => startRebind(action)}
              >
                {rebindingAction === action
                  ? 'Press key...'
                  : formatKey((settings.keybindings || DEFAULT_KEYBINDINGS)[action])}
              </button>
            </div>
          ))}
          <button className="keybind-reset" onClick={resetKeybinds}>Reset to defaults</button>
        </div>
      )}
      <button onClick={onClose}>{t('menu.back')}</button>
    </div>
  )
}

/* =========================================================================
   Barracks — stats, weapon mastery, battle pass (Fase 3).
   ========================================================================= */
function BarracksScreen({ onClose }) {
  const [summary] = useState(() => getMetaSummary())
  const [selectedWeapon, setSelectedWeapon] = useState('m4')
  const [prestigeInfo, setPrestigeInfo] = useState(() => getPrestige())
  const [prestigeMsg, setPrestigeMsg] = useState(null)
  const weaponStats = getWeaponStats(selectedWeapon)

  const handlePrestige = () => {
    const result = doPrestige()
    if (result.ok) {
      setPrestigeInfo(getPrestige())
      setPrestigeMsg(`Prestige ${result.newLevel} unlocked! XP reset.`)
    } else {
      setPrestigeMsg(`Cannot prestige: ${result.reason}`)
    }
  }

  const canPlayerPrestige = canPrestige(summary.playerLevel)

  return (
    <div className="menu barracks-screen">
      <h1>Barracks</h1>
      <div className="barracks-content">
        {/* Stats del jugador */}
        <div className="barracks-section">
          <div className="loadout-section-title">Player Stats</div>
          <div className="barracks-stats">
            <div className="barracks-stat">
              <span className="stat-label">Level</span>
              <span className="stat-value">{summary.playerLevel}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">Kills</span>
              <span className="stat-value">{summary.totalKills}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">Deaths</span>
              <span className="stat-value">{summary.totalDeaths}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">K/D</span>
              <span className="stat-value">{summary.kd}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">Highest wave</span>
              <span className="stat-value">{summary.highestWave}</span>
            </div>
          </div>
        </div>

        {/* Fase 18.49: Prestige */}
        <div className="barracks-section">
          <div className="loadout-section-title">Prestige — Level {prestigeInfo.level}/10</div>
          <div className="barracks-stats">
            <div className="barracks-stat">
              <span className="stat-label">Prestige Level</span>
              <span className="stat-value">{prestigeInfo.level}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">Tokens</span>
              <span className="stat-value">{prestigeInfo.tokens}</span>
            </div>
            <div className="barracks-stat">
              <span className="stat-label">Icon</span>
              <span className="stat-value">{prestigeInfo.icon || '—'}</span>
            </div>
          </div>
          {canPlayerPrestige ? (
            <button className="prestige-btn" onClick={handlePrestige}>
              PRESTIGE (reset XP for token)
            </button>
          ) : (
            <div className="stats">
              {prestigeInfo.level >= 10
                ? 'Max prestige reached.'
                : 'Reach level 55 to prestige.'}
            </div>
          )}
          {prestigeMsg && <div className="stats">{prestigeMsg}</div>}
        </div>

        {/* Battle Pass */}
        <div className="barracks-section">
          <div className="loadout-section-title">Battle Pass — Tier {summary.battlePass.tier}/{summary.battlePass.maxTier}</div>
          <div className="bp-progress">
            <div className="bp-fill" style={{ width: `${(summary.battlePass.tier / summary.battlePass.maxTier) * 100}%` }} />
          </div>
          <div className="barracks-stat">
            <span className="stat-label">XP to next tier</span>
            <span className="stat-value">{summary.battlePass.xp} / {summary.battlePass.xpNeeded}</span>
          </div>
          <div className="barracks-stat">
            <span className="stat-label">Premium</span>
            <span className="stat-value">{summary.battlePass.premium ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {/* Daily challenges */}
        <div className="barracks-section">
          <div className="loadout-section-title">Daily Challenges</div>
          {summary.dailies.map((c) => (
            <div key={c.id} className="barracks-stat">
              <span className="stat-label">{c.desc}</span>
              <span className="stat-value">{c.progress}/{c.target} {c.claimed ? '✓' : ''}</span>
            </div>
          ))}
        </div>

        {/* Weapon mastery */}
        <div className="barracks-section">
          <div className="loadout-section-title">Weapon Mastery</div>
          <div className="loadout-grid">
            {Object.keys(WEAPONS).map((id) => (
              <button
                key={id}
                className={`loadout-item ${selectedWeapon === id ? 'selected' : ''}`}
                onClick={() => setSelectedWeapon(id)}
              >
                {WEAPONS[id].name}
              </button>
            ))}
          </div>
          <div className="barracks-stat" style={{ marginTop: 12 }}>
            <span className="stat-label">Weapon level</span>
            <span className="stat-value">{weaponStats.level} / {weaponStats.maxLevel}</span>
          </div>
          <div className="bp-progress">
            <div className="bp-fill" style={{ width: `${(weaponStats.xp / weaponStats.xpNeeded) * 100}%` }} />
          </div>
          <div className="loadout-section-title" style={{ marginTop: 12, fontSize: 12 }}>Camos</div>
          <div className="camos-grid">
            {CAMO_CATALOG.map((c) => {
              const unlocked = weaponStats.camos.includes(c.id)
              return (
                <div key={c.id} className={`camo ${unlocked ? 'unlocked' : 'locked'}`}>
                  <div className="camo-swatch" style={{ background: `#${c.color.toString(16).padStart(6, '0')}` }} />
                  <span>{c.name}</span>
                  {!unlocked && <span className="camo-lock">Lv {c.level}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <button onClick={onClose}>{t('menu.back')}</button>
    </div>
  )
}

/* =========================================================================
   Multiplayer — pantalla de conexión al servidor MP (Fase 2).
   ========================================================================= */
function MultiplayerScreen({ onClose, onConnect }) {
  const [url, setUrl] = useState('ws://localhost:9433')
  // Fase 9: input de nombre de jugador (antes era Player${id} del servidor).
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('mw_player_name') || '' } catch { return '' }
  })
  // Fase 18.6: selector de mapa.
  const [selectedMap, setSelectedMap] = useState(() => {
    try { return localStorage.getItem('mw_selected_map') || 'pamplona' } catch { return 'pamplona' }
  })

  const handleConnect = () => {
    try {
      localStorage.setItem('mw_player_name', name)
      localStorage.setItem('mw_selected_map', selectedMap)
    } catch {}
    onConnect(url, name)
  }

  return (
    <div className="menu">
      <h1>Multiplayer</h1>
      <h2>Team Deathmatch</h2>
      <div className="stats">
        Conéctate a un servidor para jugar TDM 6v6.<br />
        Primero arranque el servidor: <code>npm run server</code>
      </div>
      <div className="mp-connect">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="mp-url-input"
          maxLength={16}
        />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://host:9433"
          className="mp-url-input"
        />
        <button onClick={handleConnect}>Conectar</button>
      </div>
      {/* Fase 18.6: selector de mapa */}
      <div className="map-selector">
        <div className="loadout-section-title">Mapa</div>
        <div className="map-grid">
          {MAP_IDS.map((id) => (
            <button
              key={id}
              className={`loadout-item ${selectedMap === id ? 'selected' : ''}`}
              onClick={() => setSelectedMap(id)}
              title={MAPS[id].desc}
            >
              <div className="map-name">{MAPS[id].name}</div>
              <div className="map-biome">{MAPS[id].biome}</div>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onClose}>{t('menu.back')}</button>
    </div>
  )
}

/* =========================================================================
   MatchOver — pantalla de fin de partida MP (Fase 2).
   ========================================================================= */
function MatchOverScreen({ onQuit }) {
  const winner = useGameStore((s) => s.mpWinner)
  const scores = useGameStore((s) => s.mpTeamScores)
  return (
    <div className="menu">
      <h1>{winner === 'axis' ? 'AXIS WINS' : 'ALLIES WINS'}</h1>
      <h2>Match Over</h2>
      <div className="stats">
        Axis: <strong style={{ color: '#ff8080' }}>{scores.axis}</strong> kills<br />
        Allies: <strong style={{ color: '#6aa0ff' }}>{scores.allies}</strong> kills
      </div>
      <button onClick={onQuit}>Volver al menú</button>
    </div>
  )
}

/* =========================================================================
   CreateAClass — editor de loadout (Fase 1.4).
   Permite elegir primary, attachments por slot, secondary, y 3 perks.
   Se persiste en localStorage via loadout.js.
   ========================================================================= */
function CreateAClassScreen({ onClose }) {
  const [activeIdx, setActiveIdx] = useState(() => getActiveClassIndex())
  const [classes, setClasses] = useState(() => getCustomClasses())
  const [loadout, setLoadoutState] = useState(() => getLoadout())

  const selectClass = (idx) => {
    setActiveClassIndex(idx)
    setActiveIdx(idx)
    setClasses(getCustomClasses())
    setLoadoutState(getLoadout())
  }

  const duplicate = (fromIdx) => {
    let toIdx = -1
    for (let i = 0; i < getMaxClasses(); i++) {
      if (classes[i] == null) { toIdx = i; break }
    }
    if (toIdx === -1) return
    duplicateClass(fromIdx, toIdx)
    setClasses(getCustomClasses())
  }

  const reset = (idx) => {
    resetClass(idx)
    setClasses(getCustomClasses())
    if (idx === activeIdx) setLoadoutState(getLoadout())
  }

  const update = (patch) => {
    const next = { ...loadout, ...patch }
    setLoadoutState(next)
    saveLoadout(next)
    setClasses(getCustomClasses())
  }

  const updatePrimaryAttachments = (slot, attId) => {
    const next = { ...loadout }
    next.primaryAttachments = { ...loadout.primaryAttachments }
    if (attId === null) delete next.primaryAttachments[slot]
    else next.primaryAttachments[slot] = attId
    setLoadoutState(next)
    saveLoadout(next)
    setClasses(getCustomClasses())
  }

  const updatePerk = (slot, perkId) => {
    const next = {
      ...loadout,
      perks: { ...loadout.perks, [slot]: perkId }
    }
    setLoadoutState(next)
    saveLoadout(next)
    setClasses(getCustomClasses())
  }

  const weaponIds = Object.keys(WEAPONS)
  const perkList = Object.values(PERKS)
  const perksByCategory = {
    blue: perkList.filter((p) => p.category === 'blue'),
    red: perkList.filter((p) => p.category === 'red'),
    green: perkList.filter((p) => p.category === 'green')
  }

  return (
    <div className="menu loadout-screen">
      <h1>{t('loadout.title')}</h1>
      {/* Fase 18.3: selector de 10 custom classes */}
      <div className="class-slots">
        {Array.from({ length: getMaxClasses() }, (_, i) => (
          <div key={i} className={`class-slot ${i === activeIdx ? 'active' : ''} ${classes[i] ? 'filled' : 'empty'}`}>
            <button className="class-slot-btn" onClick={() => selectClass(i)}>
              {i + 1}
            </button>
            {classes[i] && i !== activeIdx && (
              <>
                <button className="class-slot-action" title="Duplicate" onClick={() => duplicate(i)}>⧉</button>
                <button className="class-slot-action" title="Reset" onClick={() => reset(i)}>↺</button>
              </>
            )}
            {i === activeIdx && (
              <button className="class-slot-action" title="Reset" onClick={() => reset(i)}>↺</button>
            )}
          </div>
        ))}
      </div>
      <div className="loadout-content">
        {/* Primary weapon */}
        <div className="loadout-section">
          <div className="loadout-section-title">{t('loadout.primary')}</div>
          <div className="loadout-grid">
            {weaponIds.map((id) => (
              <button
                key={id}
                className={`loadout-item ${loadout.primary === id ? 'selected' : ''}`}
                onClick={() => update({ primary: id })}
              >
                {WEAPONS[id].name}
              </button>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="loadout-section">
          <div className="loadout-section-title">{t('loadout.attachments')}</div>
          <div className="loadout-attachments">
            {ATTACHMENT_SLOTS.map((slot) => {
              const current = loadout.primaryAttachments[slot]
              const options = Object.values(ATTACHMENTS).filter((a) => a.slot === slot)
              return (
                <div key={slot} className="loadout-attachment-slot">
                  <div className="loadout-attachment-label">{slot}</div>
                  <div className="loadout-attachment-options">
                    <button
                      className={`loadout-item small ${!current ? 'selected' : ''}`}
                      onClick={() => updatePrimaryAttachments(slot, null)}
                    >
                      —
                    </button>
                    {options.map((a) => (
                      <button
                        key={a.id}
                        className={`loadout-item small ${current === a.id ? 'selected' : ''}`}
                        onClick={() => updatePrimaryAttachments(slot, a.id)}
                        title={a.desc || a.name}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Secondary */}
        <div className="loadout-section">
          <div className="loadout-section-title">{t('loadout.secondary')}</div>
          <div className="loadout-grid">
            {weaponIds.map((id) => (
              <button
                key={id}
                className={`loadout-item ${loadout.secondary === id ? 'selected' : ''}`}
                onClick={() => update({ secondary: id })}
              >
                {WEAPONS[id].name}
              </button>
            ))}
          </div>
        </div>

        {/* Perks */}
        <div className="loadout-section">
          <div className="loadout-section-title">{t('loadout.perks')}</div>
          {['blue', 'red', 'green'].map((cat) => (
            <div key={cat} className="loadout-perk-row">
              <div className={`loadout-perk-cat ${cat}`}>{cat.toUpperCase()}</div>
              <div className="loadout-grid">
                {perksByCategory[cat].map((p) => (
                  <button
                    key={p.id}
                    className={`loadout-item ${loadout.perks[cat] === p.id ? 'selected' : ''}`}
                    onClick={() => updatePerk(cat, p.id)}
                    title={p.desc}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onClose}>{t('menu.back')}</button>
    </div>
  )
}
