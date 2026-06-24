import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Punto de entrada de React.
// Montamos el componente raíz <App /> en el div #root del index.html.
// StrictMode está desactivado a propósito: Three.js crea refs y bucles
// de animación que no toleran bien el doble-montaje de StrictMode.
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
