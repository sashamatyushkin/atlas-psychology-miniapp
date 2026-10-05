import '@fontsource-variable/manrope';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles/global.css';
import './styles/components.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useApp } from './store/app';
import { initTelegram } from './telegram/webapp';

initTelegram((scheme) => useApp.getState().setScheme(scheme));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
