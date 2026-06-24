import { useEffect, useRef } from 'react'
import { useGameStore, GAME_STATES } from './game/store.js'
import { createEngine } from './game/engine.js'

/* =========================================================================
   Componente <App />: orquesta los menús y el motor 3D.
   ========================================================================= */
export default function App() {
  const gameState = useGameStore((s) => s.gameState)
  const loading = useGameStore((s) => s.loading)

  const engineRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    engine.mount(containerRef.current)
    return () => engine.dispose()
  }, [])

  return (
    <>
      <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />

      {loading && (
        <div className="loading">
          CARGANDO MOTORES...
          <div className="bar" />
        </div>
      )}

      {gameState === GAME_STATES.PLAYING && <HUD />}

      {gameState === GAME_STATES.MENU && (
        <MainMenu onStart={() => engineRef.current?.startGame()} />
      )}
      {gameState === GAME_STATES.PAUSED && (
        <PauseMenu
          onResume={() => engineRef.current?.resumeGame()}
          onQuit={() => engineRef.current?.quitToMenu()}
        />
      )}
      {gameState === GAME_STATES.GAMEOVER && (
        <GameOverMenu onRestart={() => engineRef.current?.startGame()} />
      )}
    </>
  )
}

/* =========================================================================
   HUD: vida, munición, crosshair, marcador, hitmarkers.
   ========================================================================= */
function HUD() {
  const health = useGameStore((s) => s.health)
  const maxHealth = useGameStore((s) => s.maxHealth)
  const ammo = useGameStore((s) => s.ammo)
  const reserve = useGameStore((s) => s.reserve)
  const reloading = useGameStore((s) => s.reloading)
  const score = useGameStore((s) => s.score)
  const wave = useGameStore((s) => s.wave)
  const enemiesRemaining = useGameStore((s) => s.enemiesRemaining)
  const firing = useGameStore((s) => s.firing)
  const hitmarkers = useGameStore((s) => s.hitmarkers)
  const killmarkers = useGameStore((s) => s.killmarkers)
  const damageFlash = useGameStore((s) => s.damageFlash)
  const damageDirections = useGameStore((s) => s.damageDirections)

  const hpPct = Math.max(0, (health / maxHealth) * 100)
  const lowHealth = hpPct <= 30
  const lowAmmo = ammo <= 5
  const warnReserve = reserve <= 10

  return (
    <div className="hud">
      {/* Crosshair en el centro. */}
      <div className={`crosshair ${firing ? 'firing' : ''}`}>
        <span className="top" />
        <span className="bottom" />
        <span className="left" />
        <span className="right" />
        <span className="dot" />
      </div>

      {/* Hitmarkers (aciertos) y killmarkers (bajas). */}
      {hitmarkers.map((id) => <div key={`h${id}`} className="hitmarker" />)}
      {killmarkers.map((id) => <div key={`k${id}`} className="killmarker" />)}

      {/* Indicadores direccionales de daño. */}
      {damageDirections.map((d) => (
        <div
          key={`d${d.id}`}
          className="damage-direction"
          style={{ transform: `translate(-50%, -50%) rotate(${d.angle}rad)` }}
        >
          <div className="damage-direction-arc" />
        </div>
      ))}

      {/* Viñeta roja al recibir daño. */}
      <div className={`damage-flash ${damageFlash ? 'active' : ''}`} />

      {/* Cabecera: oleada + enemigos + puntuación. */}
      <div className="hud-top">
        <div className="wave-block">
          <div className="label">Oleada</div>
          <div className="value">{wave}</div>
        </div>
        <div className="enemies-block">
          <div className="label">Enemigos</div>
          <div className="value">{enemiesRemaining}</div>
        </div>
        <div className="score-block">
          <div className="label">Puntuación</div>
          <div className="value score-value">{score.toLocaleString()}</div>
        </div>
      </div>

      {/* Indicador de recarga. */}
      {reloading && <div className="reload-indicator">Recargando...</div>}

      {/* Pie: vida (izquierda) y munición (derecha). */}
      <div className="hud-bottom">
        <div>
          <div className="label">Vida</div>
          <div className={`value ${lowHealth ? 'low' : ''}`}>{Math.ceil(health)}</div>
          <div className="health-bar">
            <div
              className={`fill ${lowHealth ? 'low' : ''}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        <div className="ammo-display">
          <div className="label">Munición</div>
          <div className={`value ${lowAmmo ? 'warn' : ''}`}>
            {ammo}<span className={`reserve ${warnReserve ? 'warn' : ''}`}>/ {reserve}</span>
          </div>
        </div>
      </div>
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
        WASD moverse · SHIFT correr · CTRL agacharse · SPACE saltar · R recargar · ESC pausa
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
