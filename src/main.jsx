import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/rams-theme.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/preview-layout.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
if (import.meta.env.VITE_ENABLE_LEGACY_VISITOR_TRACKING === 'true') {
  import('./services/visitorTracker.js').then(({ trackVisitor }) => trackVisitor()).catch(() => {});
}

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
