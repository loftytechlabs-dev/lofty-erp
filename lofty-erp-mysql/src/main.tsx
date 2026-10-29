import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register Service Worker safely for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.info('Lofty ERP ServiceWorker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Lofty ERP ServiceWorker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
