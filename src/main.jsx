import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/rams-theme.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { trackVisitor } from './services/visitorTracker.js'

trackVisitor()

// Register service worker for offline/PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
