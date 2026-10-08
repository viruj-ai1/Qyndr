import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1a1a35',
          color: '#f1f5f9',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '10px',
          fontSize: '0.85rem',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#1a1a35' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#1a1a35' } },
      }}
    />
  </React.StrictMode>
)
