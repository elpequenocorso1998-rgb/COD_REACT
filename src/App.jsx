import { useEffect, useRef, Component } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore, GAME_STATES } from './game/store.js'
import { createEngine } from './game/engine.js'

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

  const engineRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Guard: si el contenedor ya no está (StrictMode double-invoke rápido),
    // no intentamos montar.
    if (!containerRef.current) return
    const engine = createEngine()
    engineRef.current = engine
    // El engine nos pasa el canvas del minimap cuando está listo; lo
    // adjuntamos al contenedor del HUD (imperativo, sin React re-render).
    // Usamos querySelector porque el contenedor vive en <HUD/>, que es un
    // componente hijo separado (no podemos pasarle un ref fácilmente).
    engine.onMinimapReady = (canvas) => {
      const container = document.querySelector('.minimap-container')
      if (container) {
        container.innerHTML = ''
        container.appendChild(canvas)
      }
    }
    try {
      engine.mount(containerRef.current)
    } catch (err) {
      console.error('Error montando el engine:', err)
      useGameStore.getState().setLoading(false)
    }
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return (
    <ErrorBoundary>
      <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />

      {loading && (
        <div className="loading">
          CARGANDO MOTORES...
          <div className="bar" />
        </div>
      )}

      {/* Solo mostramos el menú cuando ya no estamos cargando: antes el
          botón "Jugar" podía clickarse antes de que el engine montara. */}
      {!loading && gameState === GAME_STATES.MENU && (
        <MainMenu onStart={() => engineRef.current?.startGame()} />
      )}
      {gameState === GAME_STATES.PLAYING && <HUD />}
      {gameState === GAME_STATES.PAUSED && (
        <PauseMenu
          onResume={() => engineRef.current?.resumeGame()}
          onQuit={() => engineRef.current?.quitToMenu()}
        />
      )}
      {gameState === GAME_STATES.GAMEOVER && (
        <GameOverMenu onRestart={() => engineRef.current?.startGame()} />
      )}
    </ErrorBoundary>
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
    kills, deaths, currentWeapon
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
    kills: s.kills, deaths: s.deaths, currentWeapon: s.currentWeapon
  })))

  const hpPct = Math.max(0, (health / maxHealth) * 100)
  const lowHealth = hpPct <= 30
  const lowAmmo = ammo <= 5
  const warnReserve = reserve <= 10
  const xpPct = Math.min(100, (playerXP / playerXPNeeded) * 100)
  const streakLabels = { uav: 'UAV', airstrike: 'Airstrike', heli: 'Heli', gunship: 'Gunship' }
  const streakKeys = { uav: '4', airstrike: '5', heli: '6', gunship: '7' }

  return (
    <div className="hud">
      {/* --- Minimap (canvas inyectado imperativamente por el engine) --- */}
      <div className="minimap-container" aria-hidden="true" />

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
        </div>
        <div className="ammo-display" aria-live="polite">
          <div className="label">{currentWeapon ? currentWeapon.toUpperCase() : 'Arma'}</div>
          <div className={`value ${lowAmmo ? 'warn' : ''}`}>
            {ammo}<span className={`reserve ${warnReserve ? 'warn' : ''}`}>/ {reserve}</span>
          </div>
        </div>
      </div>

      {/* --- Scoreboard overlay (Tab hold) --- */}
      {scoreboardOpen && (
        <Scoreboard kills={kills} deaths={deaths} score={score} wave={wave} />
      )}
    </div>
  )
}

/* =========================================================================
   Scoreboard: tabla de puntuaciones (Tab hold).
   ========================================================================= */
function Scoreboard({ kills, deaths, score, wave }) {
  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)
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
function MainMenu({ onStart }) {
  return (
    <div className="menu">
      <h1>Modern Warfare</h1>
      <h2>React Edition</h2>
      <button onClick={onStart}>Jugar</button>
      <div className="stats">
        Sobrevive a oleadas infinitas de enemigos.<br />
        Apunta con el ratón, dispara con click izq., recarga con R.
      </div>
      <div className="controls">
        <strong>Movimiento:</strong> WASD · SHIFT correr · SHIFT×2 sprint táctico · CTRL agacharse/slide · Z prone · SPACE saltar<br />
        <strong>Lean:</strong> Q izquierda · E derecha<br />
        <strong>Combate:</strong> Click izq. disparar · Click der. apuntar (ADS) · R recargar<br />
        <strong>Armas:</strong> Shift+1-7 cambiar (M4/AK/MP5/Sniper/Shotgun/LMG/Pistol)<br />
        <strong>Granadas:</strong> G frag · X flash · C humo<br />
        <strong>Killstreaks:</strong> 4 UAV · 5 Airstrike · 6 Heli · 7 Gunship<br />
        <strong>UI:</strong> TAB scoreboard · ESC pausa
      </div>
    </div>
  )
}

function PauseMenu({ onResume, onQuit }) {
  return (
    <div className="menu">
      <h1>Pausa</h1>
      <button onClick={onResume}>Continuar</button>
      <button onClick={onQuit}>Salir al menú</button>
    </div>
  )
}

function GameOverMenu({ onRestart }) {
  const score = useGameStore((s) => s.score)
  const wave = useGameStore((s) => s.wave)
  return (
    <div className="menu">
      <h1>Misión fallida</h1>
      <h2>HAS CAÍDO EN COMBATE</h2>
      <div className="stats">
        Puntuación final: <strong style={{ color: '#ffd24d' }}>{score.toLocaleString()}</strong><br />
        Oleada alcanzada: <strong style={{ color: '#ffd24d' }}>{wave}</strong>
      </div>
      <button onClick={onRestart}>Reintentar</button>
    </div>
  )
}
