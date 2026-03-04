import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// StrictMode removed to prevent double-mount WebSocket issues in dev
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
