import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Punto de entrada de React.
// Montamos el componente raíz <App /> en el div #root del index.html.
// StrictMode re-activado: createEngine().mount() es ahora idempotente
// (ignora el segundo mount del double-invoke de StrictMode en dev).
// Antes estaba desactivado para esquivar bugs de cleanup de Three.js,
// lo que tapaba bugs reales y desactivaba los chequeos dev de React 18.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
