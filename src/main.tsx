import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerSW } from './pwa';
import { startRipples, startScrollReveal, startScrollState } from './motion';
import './styles.css';
registerSW();
startScrollReveal(); startScrollState(); startRipples();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
